import "server-only";

import type {
  MaterialsGateState,
  ReconcileLineInput,
  ReconciliationView,
} from "@/features/inventory/types/reconciliation";
import {
  normalizeOverrideReason,
  validateReconcileInput,
} from "@/features/inventory/utils/reconciliation";
import { createJobActivity } from "@/repositories/jobs";
import {
  getReconciliationRecord,
  hasConfirmedPlan,
  listReconcileCylinders,
  listReconcileLines,
  rpcOverrideMaterialReconciliation,
  rpcReconcileJobMaterials,
} from "@/repositories/reconciliation";

import { reconcileAfterStockChange } from "./inventoryReservations";
import { getSettings } from "./inventorySettings";

// ---------------------------------------------------------------------------
// Closeout reconciliation (plan §3.5). The checklist asks `getMaterialsGate` whether the
// materials step applies and is done; the job page asks `getReconciliationView` for the
// numbers to fill in. Stock only moves when the person submits.
// ---------------------------------------------------------------------------

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

/** The timeline entry is a courtesy: the numbers and the override are already saved. */
async function recordActivity(jobId: string, actorId: string | undefined, title: string, description: string): Promise<void> {
  try {
    await createJobActivity({ jobId, actorId, type: "edited", title, description });
  } catch (error) {
    console.error("[reconciliation] activity entry failed:", error instanceof Error ? error.message : error);
  }
}

function isRequiredLine(line: { isOptional: boolean }): boolean {
  return !line.isOptional;
}

/**
 * The materials part of the completion checklist. A job needs reconciling when it is a full
 * closeout with a confirmed plan that has at least one catalog-linked, non-optional line.
 * A failed read throws like the other checklist reads, so a broken lookup is visible rather than silently passing.
 */
export async function getMaterialsGate(
  jobId: string,
  closeoutMode: "full" | "visit",
): Promise<MaterialsGateState> {
  const settings = await getSettings();
  const base: MaterialsGateState = { required: false, reconciled: false, enforcement: settings.closeoutEnforcement };
  if (closeoutMode === "visit") return base;

  const [planConfirmed, record, lines] = await Promise.all([
    hasConfirmedPlan(jobId),
    getReconciliationRecord(jobId),
    listReconcileLines(jobId),
  ]);
  const needsIt = planConfirmed && lines.some(isRequiredLine);
  const done = record !== null || (lines.length > 0 && lines.filter(isRequiredLine).every((line) => line.reconciled));
  return { required: needsIt, reconciled: needsIt && done, enforcement: settings.closeoutEnforcement };
}

export async function getReconciliationView(jobId: string, closeoutMode: "full" | "visit"): Promise<ReconciliationView> {
  const [gate, record, lines] = await Promise.all([
    getMaterialsGate(jobId, closeoutMode),
    getReconciliationRecord(jobId),
    listReconcileLines(jobId),
  ]);
  // Cylinders only matter when the job has a refrigerant line.
  const cylinders = lines.some((line) => line.itemKind === "refrigerant") ? await listReconcileCylinders() : [];
  return {
    required: gate.required,
    status: record?.status ?? "none",
    enforcement: gate.enforcement,
    overrideReason: record?.overrideReason ?? null,
    lines,
    cylinders,
  };
}

function parseInputs(body: unknown): ReconcileLineInput[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) badRequest("Send a JSON object.");
  const raw = (body as Record<string, unknown>).lines;
  if (!Array.isArray(raw) || raw.length === 0) badRequest("Send the used and returned quantities for each line.");
  return raw.map((entry) => {
    if (!entry || typeof entry !== "object") badRequest("Each line needs a lineId, used and returned.");
    const row = entry as Record<string, unknown>;
    if (typeof row.lineId !== "string") badRequest("Each line needs a lineId.");
    const num = (value: unknown, label: string): number => {
      if (typeof value !== "number" || !Number.isFinite(value)) badRequest(`${label} must be a number.`);
      return value;
    };
    return {
      lineId: row.lineId,
      used: num(row.used, "Used"),
      returned: num(row.returned, "Returned"),
      recovered: row.recovered === undefined || row.recovered === null ? null : num(row.recovered, "Recovered"),
      reason: typeof row.reason === "string" && row.reason.trim() ? row.reason : null,
      cylinderUnitId: typeof row.cylinderUnitId === "string" && row.cylinderUnitId ? row.cylinderUnitId : null,
    };
  });
}

/** Post the real numbers: used, returned and any explained difference. Everything or nothing. */
export async function submitReconciliation(
  jobId: string,
  body: unknown,
  context: { actorId?: string },
): Promise<{ lines: number; varianceLines: number }> {
  const inputs = parseInputs(body);
  const rows = await listReconcileLines(jobId);
  const validated = validateReconcileInput(rows, inputs);
  if (!validated.ok) badRequest(validated.message);

  const result = await rpcReconcileJobMaterials(jobId, validated.value);

  // The stock moved and reservations closed: refresh what other jobs are waiting on.
  await reconcileAfterStockChange(rows.map((row) => row.itemId));
  await recordActivity(jobId, context.actorId, "Materials reconciled",
    result.varianceLines > 0
      ? `${result.lines} material lines reconciled; ${result.varianceLines} had a difference with a reason.`
      : `${result.lines} material lines reconciled.`);
  return result;
}

/** Soft stage: an office role completes a job without reconciling it, and says why. */
export async function overrideReconciliation(
  jobId: string,
  reason: unknown,
  context: { actorId?: string },
): Promise<void> {
  const parsed = normalizeOverrideReason(reason);
  if (!parsed.ok) badRequest(parsed.message);
  await rpcOverrideMaterialReconciliation(jobId, parsed.reason);
  await recordActivity(jobId, context.actorId, "Material reconciliation overridden", parsed.reason);
}
