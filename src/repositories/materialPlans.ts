import "server-only";

import type {
  CatalogMatchItem,
  JobKitAttachment,
  MaterialEventOrigin,
  MaterialEventType,
  MaterialLineEvent,
  MaterialPlan,
  MaterialPlanOrigin,
  MaterialPlanStatus,
  NeedsSkuRow,
  SourceLineItem,
} from "@/features/job-materials/types/materialPlan";

import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Job material plans (20261126100000_material_plans.sql).
//
// Writes that touch lines go through the SECURITY INVOKER RPCs so the line change
// and its history event land atomically; RLS applies as the caller. Who/when is
// stamped by database triggers. Errors carry an HTTP `status` for the routes.
// ---------------------------------------------------------------------------

const PAGE = 1000;

function notFound(message: string): never {
  throw Object.assign(new Error(message), { status: 404, code: "NOT_FOUND" });
}

/** RPC error → status-carrying error. P0002 = the RPC's "not found". */
function rpcError(error: { code?: string; message: string }): never {
  if (error.code === "P0002") notFound(error.message);
  // The RPCs raise specific, safe messages (duplicate on the plan, not a stocked item, …).
  throwInventoryDbError(error, error.message);
}

// -- Plan header and kits ---------------------------------------------------

interface PlanRow {
  id: string;
  job_id: string;
  status: string;
  generated_from: string;
  generated_at: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
}

const PLAN_COLUMNS = "id,job_id,status,generated_from,generated_at,confirmed_by,confirmed_at";

function mapPlan(row: PlanRow): MaterialPlan {
  return {
    id: row.id,
    jobId: row.job_id,
    status: row.status === "confirmed" ? "confirmed" : "draft",
    generatedFrom: (["estimate", "kit", "manual", "mixed"].includes(row.generated_from)
      ? row.generated_from
      : "manual") as MaterialPlanOrigin,
    generatedAt: row.generated_at,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
  };
}

export async function getMaterialPlan(jobId: string): Promise<MaterialPlan | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_plans")
    .select(PLAN_COLUMNS)
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPlan(data as PlanRow) : null;
}

/** Draft ⇄ confirmed. The database stamps confirmed_by/at and clears them on reopen. */
export async function setMaterialPlanStatus(
  jobId: string,
  status: MaterialPlanStatus,
): Promise<MaterialPlan> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_plans")
    .update({ status })
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .select(PLAN_COLUMNS)
    .maybeSingle();
  if (error) throwInventoryDbError(error);
  if (!data) notFound("This job has no material plan yet.");
  return mapPlan(data as PlanRow);
}

interface JobKitRow {
  id: string;
  kit_id: string;
  kit_version: number;
  multiplier: number | string;
  attached_at: string;
  kit?: { name: string; version: number } | Array<{ name: string; version: number }> | null;
}

export async function listJobKitAttachments(jobId: string): Promise<JobKitAttachment[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_kits")
    .select(
      "id,kit_id,kit_version,multiplier,attached_at,kit:kit_templates!job_kits_kit_same_org_fkey(name,version)",
    )
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("attached_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as JobKitRow[]).map((row) => {
    const kit = Array.isArray(row.kit) ? row.kit[0] : row.kit;
    return {
      id: row.id,
      kitId: row.kit_id,
      kitName: kit?.name ?? "Kit",
      kitVersion: row.kit_version,
      currentKitVersion: kit?.version ?? row.kit_version,
      multiplier: Number(row.multiplier),
      attachedAt: row.attached_at,
    };
  });
}

export async function getJobKitAttachment(jobId: string, kitId: string) {
  const kits = await listJobKitAttachments(jobId);
  return kits.find((kit) => kit.kitId === kitId) ?? null;
}

// -- RPC wrappers -----------------------------------------------------------

export interface GenerateRpcResult {
  planId: string;
  added: number;
  skipped: number;
}

export async function rpcGenerateMaterialPlan(input: {
  jobId: string;
  generatedFrom: MaterialPlanOrigin;
  lines: Array<Record<string, unknown>>;
  kits: Array<{ kitId: string; kitVersion: number; multiplier: number }>;
}): Promise<GenerateRpcResult> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.rpc("generate_material_plan", {
    p_job_id: input.jobId,
    p_generated_from: input.generatedFrom,
    p_lines: input.lines,
    p_kits: input.kits.map((kit) => ({
      kit_id: kit.kitId,
      kit_version: kit.kitVersion,
      multiplier: kit.multiplier,
    })),
  });
  if (error) rpcError(error);
  const result = (data ?? {}) as { plan_id?: string; added?: number; skipped?: number };
  return { planId: String(result.plan_id), added: result.added ?? 0, skipped: result.skipped ?? 0 };
}

export async function rpcRefreshJobKit(input: {
  jobId: string;
  kitId: string;
  kitVersion: number;
  multiplier: number;
  lines: Array<Record<string, unknown>>;
}): Promise<{ added: number; updated: number; skipped: number }> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.rpc("refresh_job_kit", {
    p_job_id: input.jobId,
    p_kit_id: input.kitId,
    p_kit_version: input.kitVersion,
    p_multiplier: input.multiplier,
    p_lines: input.lines,
  });
  if (error) rpcError(error);
  const result = (data ?? {}) as { added?: number; updated?: number; skipped?: number };
  return { added: result.added ?? 0, updated: result.updated ?? 0, skipped: result.skipped ?? 0 };
}

export async function rpcAdjustMaterialLine(
  lineId: string,
  patch: Record<string, unknown>,
  reason: string | null,
): Promise<void> {
  const { supabase } = await getRepositoryContext();
  const { error } = await supabase.rpc("adjust_material_line", {
    p_line_id: lineId,
    p_patch: patch,
    p_reason: reason,
  });
  if (error) rpcError(error);
}

export async function rpcLinkMaterialLineSku(
  lineId: string,
  catalogItemId: string,
  writeAlias: boolean,
): Promise<void> {
  const { supabase } = await getRepositoryContext();
  const { error } = await supabase.rpc("link_material_line_sku", {
    p_line_id: lineId,
    p_catalog_item_id: catalogItemId,
    p_write_alias: writeAlias,
  });
  if (error) rpcError(error);
}

export async function rpcRemoveMaterialLine(lineId: string, reason: string | null): Promise<void> {
  const { supabase } = await getRepositoryContext();
  const { error } = await supabase.rpc("remove_material_line", {
    p_line_id: lineId,
    p_reason: reason,
  });
  if (error) rpcError(error);
}

/** Minimal line read used to confirm a line belongs to the job named in the URL. */
export async function getPlanLineRef(
  jobId: string,
  lineId: string,
): Promise<{ id: string; planId: string | null; catalogItemId: string | null } | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_lines")
    .select("id,plan_id,catalog_item_id")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .eq("id", lineId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; plan_id: string | null; catalog_item_id: string | null };
  return { id: row.id, planId: row.plan_id, catalogItemId: row.catalog_item_id };
}

// -- History ----------------------------------------------------------------

interface EventRow {
  id: string;
  line_id: string;
  line_name: string;
  event_type: string;
  origin: string;
  from_qty: number | string | null;
  to_qty: number | string | null;
  reason: string | null;
  actor_id: string | null;
  created_at: string;
}

export async function listMaterialLineEvents(jobId: string, limit = 200): Promise<MaterialLineEvent[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_line_events")
    .select("id,line_id,line_name,event_type,origin,from_qty,to_qty,reason,actor_id,created_at")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventRow[]).map((row) => ({
    id: row.id,
    lineId: row.line_id,
    lineName: row.line_name,
    eventType: row.event_type as MaterialEventType,
    origin: row.origin as MaterialEventOrigin,
    fromQty: row.from_qty == null ? null : Number(row.from_qty),
    toQty: row.to_qty == null ? null : Number(row.to_qty),
    reason: row.reason,
    actorId: row.actor_id,
    createdAt: row.created_at,
  }));
}

// -- Needs-SKU queue --------------------------------------------------------

interface NeedsSkuDbRow {
  id: string;
  job_id: string;
  name: string;
  quantity: number | string;
  unit: string;
  source: string;
  created_at: string;
  job?: { job_number: string | null; title: string | null } | Array<{ job_number: string | null; title: string | null }> | null;
}

/** Plan lines nobody has linked to a catalog item (or marked "not stock"), oldest first. */
export async function listNeedsSkuLines(limit = 200): Promise<NeedsSkuRow[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_lines")
    .select("id,job_id,name,quantity,unit,source,created_at,job:jobs(job_number,title)")
    .eq("org_id", orgId)
    .is("catalog_item_id", null)
    .is("non_stock_reason", null)
    .not("plan_id", "is", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) throw new Error(error.message);
  return ((data ?? []) as NeedsSkuDbRow[]).map((row) => {
    const job = Array.isArray(row.job) ? row.job[0] : row.job;
    return {
      lineId: row.id,
      jobId: row.job_id,
      jobNumber: job?.job_number ?? null,
      jobTitle: job?.title ?? null,
      name: row.name,
      quantity: Number(row.quantity),
      unit: row.unit,
      source: row.source,
      createdAt: row.created_at,
    };
  });
}

// -- Matching inputs --------------------------------------------------------

/** Active, stocked catalog items — the only things a plan line can be linked to. */
export async function listMatchableCatalogItems(): Promise<CatalogMatchItem[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const items: CatalogMatchItem[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("catalog_items")
      .select("id,name,sku,unit")
      .eq("org_id", orgId)
      .eq("is_stockable", true)
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as CatalogMatchItem[];
    items.push(...page.map((row) => ({ id: row.id, name: row.name, sku: row.sku ?? null, unit: row.unit ?? null })));
    if (page.length < PAGE) break;
  }
  return items;
}

export async function listCatalogAliases(): Promise<Array<{ alias: string; catalogItemId: string }>> {
  const { supabase, orgId } = await getRepositoryContext();
  const aliases: Array<{ alias: string; catalogItemId: string }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("catalog_item_aliases")
      .select("alias,catalog_item_id")
      .eq("org_id", orgId)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Array<{ alias: string; catalog_item_id: string }>;
    aliases.push(...page.map((row) => ({ alias: row.alias, catalogItemId: row.catalog_item_id })));
    if (page.length < PAGE) break;
  }
  return aliases;
}

// -- Source lines (SF-imported job / estimate line items) -------------------

interface LineItemDbRow {
  id: string;
  kind: string;
  name: string;
  qty: number | string | null;
  sort_order: number | null;
}

function mapSourceRows(rows: LineItemDbRow[], table: SourceLineItem["table"]): SourceLineItem[] {
  return rows.map((row) => ({
    id: row.id,
    table,
    kind: row.kind,
    name: row.name ?? "",
    qty: Number(row.qty ?? 0),
    sortOrder: row.sort_order ?? 0,
  }));
}

export async function getJobEstimateId(jobId: string): Promise<string | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .select("id,estimate_id")
    .eq("org_id", orgId)
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound("Job not found.");
  return (data as { estimate_id: string | null }).estimate_id ?? null;
}

/**
 * The job's own line items; when it has none, the linked estimate's. (SF copies estimate
 * lines onto the job, so reading both would double-count.) All kinds come back so the
 * caller can report how many services/charges were skipped.
 */
export async function listSourceLineItems(jobId: string, estimateId: string | null): Promise<SourceLineItem[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const job = await supabase
    .from("job_line_items")
    .select("id,kind,name,qty,sort_order")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true })
    .limit(2000);
  if (job.error) throw new Error(job.error.message);
  const jobRows = (job.data ?? []) as LineItemDbRow[];
  if (jobRows.length > 0 || !estimateId) return mapSourceRows(jobRows, "job");

  const estimate = await supabase
    .from("estimate_line_items")
    .select("id,kind,name,qty,sort_order")
    .eq("org_id", orgId)
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: true })
    .limit(2000);
  if (estimate.error) throw new Error(estimate.error.message);
  return mapSourceRows((estimate.data ?? []) as LineItemDbRow[], "estimate");
}
