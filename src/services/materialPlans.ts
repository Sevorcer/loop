import "server-only";

import type { KitTemplate } from "@/features/inventory/types/kits";
import type { JobMaterialLine } from "@/features/job-materials/types/jobMaterials";
import type {
  JobMaterialPlanView,
  KitSnapshot,
  MaterialLineEvent,
  MaterialPlan,
  NeedsSkuRow,
  PlanGenerationSummary,
} from "@/features/job-materials/types/materialPlan";
import {
  MaterialPlanValidationError,
  buildCatalogMatchIndex,
  buildPlanCandidates,
  countNeedsSku,
  parseAdjustmentPatch,
  parseReason,
  type KitRequest,
  patchToRpc,
  planOriginFor,
  requireReasonFor,
  toGenerateRpcLines,
  toRefreshRpcLines,
} from "@/features/job-materials/utils/materialPlan";
import { isUuid } from "@/features/job-materials/utils/jobMaterials";
import { createJobActivity } from "@/repositories/jobs";
import { listJobMaterialLines } from "@/repositories/jobMaterials";
import { getKitTemplate } from "@/repositories/kitTemplates";
import {
  getJobEstimateId,
  getJobKitAttachment,
  getMaterialPlan,
  getPlanLineRef,
  listCatalogAliases,
  listJobKitAttachments,
  listMatchableCatalogItems,
  listMaterialLineEvents,
  listNeedsSkuLines,
  listSourceLineItems,
  rpcAdjustMaterialLine,
  rpcGenerateMaterialPlan,
  rpcLinkMaterialLineSku,
  rpcRefreshJobKit,
  rpcRemoveMaterialLine,
  setMaterialPlanStatus,
} from "@/repositories/materialPlans";
import { createKit } from "./kitTemplates";

import { afterPlanChange } from "./inventoryReservations";

// ---------------------------------------------------------------------------
// Job material plans (Inventory Lane 4, PR B).
//
// A plan is generated from the job's estimate lines and/or attached kits, merged by
// the D7 rule (see utils/materialPlan.ts), and persisted atomically by the
// generate_material_plan RPC. Draft plans never reserve stock; reservations arrive
// with PR C. Every line change writes a history event in the database; the job's
// activity feed gets one summary row per plan change.
// ---------------------------------------------------------------------------

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function notFound(message: string): never {
  throw Object.assign(new Error(message), { status: 404 });
}

function assertId(value: unknown, label: string): string {
  if (!isUuid(value)) badRequest(`${label} must be a valid id.`);
  return value as string;
}

/** The activity feed is a courtesy; a failure there must never undo the plan change. */
async function logPlanActivity(jobId: string, actorId: string | undefined, title: string, description: string) {
  try {
    await createJobActivity({ jobId, actorId, type: "edited", title, description });
  } catch (error) {
    console.warn("material plan activity not recorded", error instanceof Error ? error.message : error);
  }
}

// -- Read -------------------------------------------------------------------

export async function getMaterialPlanView(jobId: string): Promise<JobMaterialPlanView> {
  assertId(jobId, "Job id");
  const [plan, lines, kits] = await Promise.all([
    getMaterialPlan(jobId),
    listJobMaterialLines(jobId),
    listJobKitAttachments(jobId),
  ]);
  return { plan, lines, kits, needsSkuCount: countNeedsSku(lines) };
}

export async function getMaterialPlanHistory(jobId: string): Promise<MaterialLineEvent[]> {
  assertId(jobId, "Job id");
  return listMaterialLineEvents(jobId);
}

export async function getNeedsSkuQueue(): Promise<NeedsSkuRow[]> {
  return listNeedsSkuLines();
}

// -- Generate / kits ---------------------------------------------------------

function kitToSnapshot(kit: KitTemplate, multiplier: number): { snapshot: KitSnapshot; skipped: number } {
  // Lines whose catalog item was deactivated since the kit was built are left out.
  const usable = kit.lines.filter((line) => line.itemActive);
  return {
    skipped: kit.lines.length - usable.length,
    snapshot: {
      kitId: kit.id,
      version: kit.version,
      multiplier,
      lines: usable.map((line) => ({
        catalogItemId: line.catalogItemId,
        name: line.itemName,
        unit: line.unit,
        quantity: line.quantity,
        isOptional: line.isOptional,
      })),
    },
  };
}

async function loadKitSnapshot(request: KitRequest): Promise<{ snapshot: KitSnapshot; name: string; skipped: number }> {
  const kit = await getKitTemplate(request.kitId);
  if (!kit) notFound("Kit not found.");
  if (kit.status !== "active") badRequest(`"${kit.name}" is archived. Restore it before attaching it to a job.`);
  return { name: kit.name, ...kitToSnapshot(kit, request.multiplier) };
}

export interface GenerateOptions {
  /** Read the job's / estimate's product lines. Default true. */
  includeEstimate?: boolean;
  kits?: KitRequest[];
}

export async function generateMaterialPlan(
  jobId: string,
  options: GenerateOptions,
  actorId?: string,
): Promise<PlanGenerationSummary> {
  assertId(jobId, "Job id");
  const includeEstimate = options.includeEstimate !== false;
  const kitRequests = options.kits ?? [];
  if (!includeEstimate && kitRequests.length === 0) {
    badRequest("Pick the estimate, a kit, or both.");
  }

  const attached = new Set((await listJobKitAttachments(jobId)).map((kit) => kit.kitId));
  const kitLoads = await Promise.all(kitRequests.map(loadKitSnapshot));

  let sourceLines: Awaited<ReturnType<typeof listSourceLineItems>> = [];
  if (includeEstimate) {
    const estimateId = await getJobEstimateId(jobId);
    sourceLines = await listSourceLineItems(jobId, estimateId);
  }

  const [items, aliases] = await Promise.all([listMatchableCatalogItems(), listCatalogAliases()]);
  const index = buildCatalogMatchIndex(items, aliases);
  const built = buildPlanCandidates({ sourceLines, kits: kitLoads.map((load) => load.snapshot), index });

  if (built.candidates.length === 0 && kitLoads.length === 0) {
    badRequest(
      sourceLines.length === 0
        ? "This job has no estimate lines to build a plan from. Attach a kit or add materials by hand."
        : "The estimate has no material lines (only services or charges). Attach a kit or add materials by hand.",
    );
  }

  const result = await rpcGenerateMaterialPlan({
    jobId,
    generatedFrom: planOriginFor(built.candidates),
    lines: toGenerateRpcLines(built.candidates),
    kits: kitLoads.map(({ snapshot }) => ({
      kitId: snapshot.kitId,
      kitVersion: snapshot.version,
      multiplier: snapshot.multiplier,
    })),
  });

  const needsSku = built.candidates.filter((line) => line.catalogItemId === null).length;
  const newKits = kitLoads.filter(({ snapshot }) => !attached.has(snapshot.kitId)).map((load) => load.name);
  const parts = [`${result.added} line${result.added === 1 ? "" : "s"} added`];
  if (needsSku > 0) parts.push(`${needsSku} need${needsSku === 1 ? "s" : ""} a catalog item`);
  if (newKits.length > 0) parts.push(`kits: ${newKits.join(", ")}`);
  await logPlanActivity(jobId, actorId, "Material plan generated", `${parts.join(" · ")}.`);
  await afterPlanChange(jobId);

  return {
    planId: result.planId,
    added: result.added,
    skipped: result.skipped,
    nonProductSkipped: built.nonProductSkipped,
    needsSku,
  };
}

export async function attachKitToJob(
  jobId: string,
  request: KitRequest,
  actorId?: string,
): Promise<PlanGenerationSummary> {
  assertId(jobId, "Job id");
  if (await getJobKitAttachment(jobId, request.kitId)) {
    throw Object.assign(new Error("That kit is already on this job. Use Refresh from kit instead."), { status: 409 });
  }
  return generateMaterialPlan(jobId, { includeEstimate: false, kits: [request] }, actorId);
}

export async function refreshJobKit(
  jobId: string,
  kitId: string,
  actorId?: string,
): Promise<{ added: number; updated: number; skipped: number }> {
  assertId(jobId, "Job id");
  assertId(kitId, "Kit id");
  const attachment = await getJobKitAttachment(jobId, kitId);
  if (!attachment) notFound("That kit is not attached to this job.");
  // Refreshing an archived kit is allowed: the job already carries it.
  const kit = await getKitTemplate(kitId);
  if (!kit) notFound("Kit not found.");
  const { snapshot } = kitToSnapshot(kit, attachment.multiplier);
  const name = kit.name;
  const result = await rpcRefreshJobKit({
    jobId,
    kitId,
    kitVersion: snapshot.version,
    multiplier: attachment.multiplier,
    lines: toRefreshRpcLines(snapshot),
  });
  await logPlanActivity(
    jobId,
    actorId,
    "Material plan adjusted",
    `Refreshed from kit "${name}": ${result.added} added, ${result.updated} updated, ${result.skipped} left as adjusted.`,
  );
  await afterPlanChange(jobId);
  return result;
}

// -- Line changes -----------------------------------------------------------

async function requirePlanLine(jobId: string, lineId: string) {
  assertId(jobId, "Job id");
  assertId(lineId, "Line id");
  const ref = await getPlanLineRef(jobId, lineId);
  if (!ref) notFound("Material line not found.");
  if (!ref.planId) badRequest("This line is not part of a material plan.");
  return ref;
}

export async function adjustPlanLine(
  jobId: string,
  lineId: string,
  body: Record<string, unknown>,
  actorId?: string,
): Promise<void> {
  await requirePlanLine(jobId, lineId);
  const patch = parseAdjustmentPatch(body);
  const reason = requireReasonFor(patch, parseReason(body.reason));
  await rpcAdjustMaterialLine(lineId, patchToRpc(patch), reason);
  if (patch.quantity !== undefined || patch.name !== undefined || patch.unit !== undefined) {
    await logPlanActivity(jobId, actorId, "Material plan adjusted", reason ? `A line was changed: ${reason}` : "A line was changed.");
  }
  await afterPlanChange(jobId);
}

export async function linkPlanLineToItem(
  jobId: string,
  lineId: string,
  catalogItemId: unknown,
  writeAlias = true,
): Promise<void> {
  await requirePlanLine(jobId, lineId);
  const itemId = assertId(catalogItemId, "catalogItemId");
  await rpcLinkMaterialLineSku(lineId, itemId, writeAlias);
  await afterPlanChange(jobId);
}

/** "Not stock": office decided this line is bought on site / not a stocked item. */
export async function markPlanLineNotStock(jobId: string, lineId: string, reasonInput: unknown): Promise<void> {
  const ref = await requirePlanLine(jobId, lineId);
  if (ref.catalogItemId) badRequest("This line is already linked to a catalog item.");
  const reason = parseReason(reasonInput);
  if (!reason || reason.length < 3) badRequest("Say why this is not a stocked item (for example, bought on site).");
  await rpcAdjustMaterialLine(lineId, { non_stock_reason: reason }, null);
  await afterPlanChange(jobId);
}

export async function removePlanLine(
  jobId: string,
  lineId: string,
  reasonInput: unknown,
  actorId?: string,
): Promise<void> {
  await requirePlanLine(jobId, lineId);
  const reason = parseReason(reasonInput);
  if (!reason || reason.length < 3) badRequest("Say why this line is coming off the plan.");
  await rpcRemoveMaterialLine(lineId, reason);
  await logPlanActivity(jobId, actorId, "Material plan adjusted", `A line was removed: ${reason}`);
  await afterPlanChange(jobId);
}

// -- Plan status ------------------------------------------------------------

export async function confirmMaterialPlan(
  jobId: string,
  actorId?: string,
): Promise<{ plan: MaterialPlan; needsSkuCount: number }> {
  assertId(jobId, "Job id");
  const lines = await listJobMaterialLines(jobId);
  if (lines.length === 0) badRequest("Add at least one material before confirming the plan.");
  const plan = await setMaterialPlanStatus(jobId, "confirmed");
  await logPlanActivity(jobId, actorId, "Material plan confirmed", `${lines.length} line${lines.length === 1 ? "" : "s"} confirmed.`);
  // Confirming is what claims stock (draft plans never reserve).
  await afterPlanChange(jobId, { forceSnapshotFor: [jobId], forceSnapshotTrigger: "plan_confirmed" });
  return { plan, needsSkuCount: countNeedsSku(lines) };
}

export async function reopenMaterialPlan(jobId: string, actorId?: string): Promise<MaterialPlan> {
  assertId(jobId, "Job id");
  const plan = await setMaterialPlanStatus(jobId, "draft");
  await logPlanActivity(jobId, actorId, "Material plan reopened", "The plan is a draft again.");
  await afterPlanChange(jobId);
  return plan;
}

// -- Save as kit ------------------------------------------------------------

export async function saveJobMaterialsAsKit(jobId: string, nameInput: unknown) {
  assertId(jobId, "Job id");
  const lines: JobMaterialLine[] = await listJobMaterialLines(jobId);
  const linked = lines.filter((line) => line.planId !== null && line.catalogItemId !== null);
  if (linked.length === 0) {
    throw new MaterialPlanValidationError("None of this job's materials are linked to catalog items yet, so there is nothing to save as a kit.");
  }
  const kit = await createKit({
    name: nameInput,
    lines: linked.map((line) => ({
      catalogItemId: line.catalogItemId,
      quantity: line.quantity,
      isOptional: line.isOptional,
    })),
  });
  return { kit, skippedUnlinked: lines.filter((line) => line.catalogItemId === null).length };
}
