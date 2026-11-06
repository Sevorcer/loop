import "server-only";

import type {
  ExpectedArrivalInput,
  MaterialReadinessLevel,
  ReadinessJobInput,
} from "@/features/inventory/types/readiness";
import type {
  ReleaseReason,
  ReserveReason,
  ReserveResult,
} from "@/features/inventory/types/reservations";

import { throwInventoryDbError } from "./inventoryErrors";
import { listOpenArrivalsForReadiness } from "./expectedArrivals";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Reservations and readiness data (20261126200000_inventory_reservations.sql,
// 20261126400000_material_metrics.sql).
//
// Claims are made and released by SECURITY INVOKER SQL functions so RLS applies and
// the per-item locks hold. Readiness is computed in the app (pure engine) and cached
// back on the lines and plan header; the cache is advisory and never blocks anything.
// ---------------------------------------------------------------------------

const ACTIVE_JOB_STATUSES = ["Scheduled", "In Progress", "On Hold"];
const CHUNK = 80;

function chunk<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// -- Claims -----------------------------------------------------------------

interface ReserveRpcResult {
  released: number;
  reserved: number;
  holding: boolean;
  blocker: string | null;
  lines: Array<{ line_id: string; required: number | string; reserved: number | string; pulled: number | string }>;
}

export async function rpcReserveJobMaterials(
  jobId: string,
  reason: ReserveReason = "plan_changed",
  requeue = false,
): Promise<ReserveResult> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.rpc("reserve_job_materials", {
    p_job_id: jobId,
    p_reason: reason,
    p_requeue: requeue,
  });
  if (error) {
    if (error.code === "P0002") throw Object.assign(new Error(error.message), { status: 404, code: "NOT_FOUND" });
    throwInventoryDbError(error, error.message);
  }
  const result = data as ReserveRpcResult;
  return {
    released: result.released,
    reserved: result.reserved,
    holding: result.holding,
    blocker: result.blocker,
    lines: (result.lines ?? []).map((line) => ({
      lineId: line.line_id,
      required: Number(line.required),
      reserved: Number(line.reserved),
      pulled: Number(line.pulled),
    })),
  };
}

export async function rpcReleaseJobReservations(jobId: string, reason: ReleaseReason, lineId?: string): Promise<number> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.rpc("release_job_reservations", {
    p_job_id: jobId,
    p_reason: reason,
    p_line_id: lineId ?? null,
  });
  if (error) throwInventoryDbError(error, error.message);
  return Number(data ?? 0);
}


// -- Readiness inputs -------------------------------------------------------

interface PlanJobRow {
  job_id: string;
  status: string;
  readiness_state: string | null;
  readiness_reason: string | null;
  jobs: { status: string; scheduled_for: string | null; deleted_at: string | null } | Array<{ status: string; scheduled_for: string | null; deleted_at: string | null }> | null;
}

interface LineRow {
  id: string;
  job_id: string;
  name: string;
  quantity: number | string;
  catalog_item_id: string | null;
  is_optional: boolean;
  non_stock_reason: string | null;
  readiness_state: string | null;
  readiness_reason: string | null;
  readiness_eta: string | null;
  item: { is_stockable: boolean } | Array<{ is_stockable: boolean }> | null;
}

export interface CachedReadiness {
  state: MaterialReadinessLevel | null;
  reason: string | null;
  eta: string | null;
}

export interface ReadinessData {
  jobs: ReadinessJobInput[];
  arrivals: ExpectedArrivalInput[];
  freeStock: Record<string, number>;
  /** What is cached today, so the service only writes changes. */
  cachedLines: Map<string, CachedReadiness>;
  cachedPlans: Map<string, CachedReadiness>;
}

function asLevel(value: string | null): MaterialReadinessLevel | null {
  return value === "ok" || value === "arriving_in_time" || value === "short" || value === "at_risk" ? value : null;
}

/** Everything the engine needs for every planned, live job in the org. */
export async function loadReadinessData(): Promise<ReadinessData> {
  const { supabase, orgId } = await getRepositoryContext();

  // 1. Plans on live jobs (draft plans are advisory but still checked).
  const plans: PlanJobRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("job_material_plans")
      .select("job_id,status,readiness_state,readiness_reason,jobs!inner(status,scheduled_for,deleted_at)")
      .eq("org_id", orgId)
      .in("jobs.status", ACTIVE_JOB_STATUSES)
      .is("jobs.deleted_at", null)
      .order("job_id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as PlanJobRow[];
    plans.push(...page);
    if (page.length < 1000) break;
  }

  const jobIds = plans.map((plan) => plan.job_id);
  const jobInfo = new Map<string, { status: string; scheduledFor: string | null }>();
  const cachedPlans = new Map<string, CachedReadiness>();
  for (const plan of plans) {
    const job = Array.isArray(plan.jobs) ? plan.jobs[0] : plan.jobs;
    jobInfo.set(plan.job_id, { status: job?.status ?? "", scheduledFor: job?.scheduled_for ?? null });
    cachedPlans.set(plan.job_id, { state: asLevel(plan.readiness_state), reason: plan.readiness_reason, eta: null });
  }

  // 2. Lines, and what is reserved / pulled against each.
  const lineRows: LineRow[] = [];
  const claimed = new Map<string, { reserved: number; pulled: number }>();
  for (const group of chunk(jobIds)) {
    const lines = await supabase
      .from("job_material_lines")
      .select("id,job_id,name,quantity,catalog_item_id,is_optional,non_stock_reason,readiness_state,readiness_reason,readiness_eta,item:catalog_items(is_stockable)")
      .eq("org_id", orgId)
      .in("job_id", group)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(5000);
    if (lines.error) throw new Error(lines.error.message);
    lineRows.push(...((lines.data ?? []) as unknown as LineRow[]));

    const claims = await supabase
      .from("inventory_reservations")
      .select("line_id,qty,status")
      .eq("org_id", orgId)
      .in("job_id", group)
      .in("status", ["active", "pulled"])
      .limit(10000);
    if (claims.error) throw new Error(claims.error.message);
    for (const row of (claims.data ?? []) as unknown as Array<{ line_id: string; qty: number | string; status: string }>) {
      const entry = claimed.get(row.line_id) ?? { reserved: 0, pulled: 0 };
      if (row.status === "active") entry.reserved += Number(row.qty);
      else entry.pulled += Number(row.qty);
      claimed.set(row.line_id, entry);
    }
  }

  const cachedLines = new Map<string, CachedReadiness>();
  const byJob = new Map<string, ReadinessJobInput>();
  for (const [jobId, info] of jobInfo) {
    byJob.set(jobId, {
      jobId,
      scheduledDate: info.scheduledFor,
      // On Hold jobs are listed but not checked: they hold no stock.
      active: info.status === "Scheduled" || info.status === "In Progress",
      lines: [],
    });
  }
  for (const row of lineRows) {
    const job = byJob.get(row.job_id);
    if (!job) continue;
    const item = Array.isArray(row.item) ? row.item[0] : row.item;
    const claim = claimed.get(row.id) ?? { reserved: 0, pulled: 0 };
    job.lines.push({
      lineId: row.id,
      name: row.name,
      itemId: row.catalog_item_id,
      required: Number(row.quantity),
      reserved: claim.reserved,
      pulled: claim.pulled,
      isOptional: row.is_optional,
      nonStockReason: row.non_stock_reason,
      itemStockable: item?.is_stockable ?? false,
    });
    cachedLines.set(row.id, { state: asLevel(row.readiness_state), reason: row.readiness_reason, eta: row.readiness_eta });
  }

  // 3. Unclaimed shop stock, by item.
  const freeStock: Record<string, number> = {};
  const shop = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("org_id", orgId)
    .eq("type", "warehouse")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (shop.error) throw new Error(shop.error.message);
  const shopId = (shop.data as { id: string } | null)?.id;
  if (shopId) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("inventory_available")
        .select("item_id,available")
        .eq("org_id", orgId)
        .eq("location_id", shopId)
        .gt("available", 0)
        .order("item_id", { ascending: true })
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as unknown as Array<{ item_id: string; available: number | string }>;
      for (const row of page) freeStock[row.item_id] = Number(row.available);
      if (page.length < 1000) break;
    }
  }

  const arrivals = (await listOpenArrivalsForReadiness()).map((arrival) => ({ ...arrival }));

  return { jobs: [...byJob.values()], arrivals, freeStock, cachedLines, cachedPlans };
}

// -- Cache writes -----------------------------------------------------------

export interface LineReadinessWrite {
  lineId: string;
  state: MaterialReadinessLevel | null;
  reason: string | null;
  eta: string | null;
}

export async function writeLineReadiness(writes: LineReadinessWrite[]): Promise<void> {
  if (writes.length === 0) return;
  const { supabase, orgId } = await getRepositoryContext();
  for (const group of chunk(writes, 20)) {
    const results = await Promise.all(
      group.map((write) =>
        supabase
          .from("job_material_lines")
          .update({ readiness_state: write.state, readiness_reason: write.reason, readiness_eta: write.eta })
          .eq("org_id", orgId)
          .eq("id", write.lineId),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(failed.error.message);
  }
}

export async function writePlanReadiness(
  jobId: string,
  state: MaterialReadinessLevel | null,
  reason: string | null,
): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("job_material_plans")
    .update({ readiness_state: state, readiness_reason: reason, readiness_checked_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("job_id", jobId);
  if (error) throw new Error(error.message);
}

export interface SnapshotInsert {
  jobId: string;
  trigger: "plan_confirmed" | "state_changed" | "dispatched";
  scheduledDate: string | null;
  rollupState: MaterialReadinessLevel;
  counts: { total: number; ok: number; arriving: number; short: number; atRisk: number; needsSku: number };
  detail: Record<string, unknown>;
}

export async function insertReadinessSnapshot(snapshot: SnapshotInsert): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase.from("job_readiness_snapshots").insert({
    org_id: orgId,
    job_id: snapshot.jobId,
    trigger: snapshot.trigger,
    scheduled_date: snapshot.scheduledDate,
    rollup_state: snapshot.rollupState,
    lines_total: snapshot.counts.total,
    lines_ok: snapshot.counts.ok,
    lines_arriving: snapshot.counts.arriving,
    lines_short: snapshot.counts.short,
    lines_at_risk: snapshot.counts.atRisk,
    lines_needs_sku: snapshot.counts.needsSku,
    detail: snapshot.detail,
  });
  if (error) throw new Error(error.message);
}

/** What the dispatch board shows per job: the cached rollup and the unverified-line count. */
export interface PlanReadinessSummary {
  state: MaterialReadinessLevel | null;
  reason: string | null;
  /** Non-optional lines nobody has linked to a catalog item or marked not stocked. */
  needsSku: number;
}

/** Cached plan readiness for the given jobs. Jobs without a plan are absent from the result. */
export async function loadPlanReadinessForJobs(jobIds: ReadonlyArray<string>): Promise<Record<string, PlanReadinessSummary>> {
  const result: Record<string, PlanReadinessSummary> = {};
  if (jobIds.length === 0) return result;
  const { supabase, orgId } = await getRepositoryContext();

  for (const group of chunk([...jobIds])) {
    const plans = await supabase
      .from("job_material_plans")
      .select("job_id,readiness_state,readiness_reason")
      .eq("org_id", orgId)
      .in("job_id", group)
      .limit(1000);
    if (plans.error) throw new Error(plans.error.message);
    for (const row of (plans.data ?? []) as unknown as Array<{
      job_id: string;
      readiness_state: string | null;
      readiness_reason: string | null;
    }>) {
      result[row.job_id] = { state: asLevel(row.readiness_state), reason: row.readiness_reason, needsSku: 0 };
    }

    const unlinked = await supabase
      .from("job_material_lines")
      .select("job_id")
      .eq("org_id", orgId)
      .in("job_id", group)
      .not("plan_id", "is", null)
      .is("catalog_item_id", null)
      .is("non_stock_reason", null)
      .eq("is_optional", false)
      .limit(5000);
    if (unlinked.error) throw new Error(unlinked.error.message);
    for (const row of (unlinked.data ?? []) as unknown as Array<{ job_id: string }>) {
      const entry = result[row.job_id];
      if (entry) entry.needsSku += 1;
    }
  }
  return result;
}
