import "server-only";

import type {
  JobMaterialCreateInput,
  JobMaterialLine,
  JobMaterialPatchInput,
  JobMaterialState,
  JobMaterialSummary,
  MaterialLineStage,
} from "@/features/job-materials/types/jobMaterials";
import { MATERIAL_READINESS_LEVELS, type MaterialReadinessLevel } from "@/features/inventory/types/readiness";
import {
  emptyJobMaterialSummary,
  isJobMaterialSource,
  isJobMaterialState,
  summarizeJobMaterialStates,
} from "@/features/job-materials/utils/jobMaterials";

import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// job_material_lines (20261121000000_job_materials.sql) — #23.
//
// Who/when columns are stamped by a database trigger from auth.uid(); this
// layer never writes them. Row scope (tech = assigned jobs only) is RLS.
// Throws on error; routes map via mapRouteError.
// ---------------------------------------------------------------------------

interface JobMaterialLineRow {
  id: string;
  job_id: string;
  name: string;
  quantity: number | string;
  unit: string;
  part_number: string | null;
  notes: string;
  state: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  state_changed_by: string | null;
  state_changed_at: string | null;
  plan_id?: string | null;
  catalog_item_id?: string | null;
  catalog_item?: { name: string; sku: string | null } | Array<{ name: string; sku: string | null }> | null;
  source?: string | null;
  kit_id?: string | null;
  kit_quantity?: number | string | null;
  is_optional?: boolean | null;
  non_stock_reason?: string | null;
  stage?: string | null;
  readiness_state?: string | null;
  readiness_reason?: string | null;
  readiness_eta?: string | null;
  fulfil_location_id?: string | null;
}

const LINE_STAGES: readonly MaterialLineStage[] = ["planned", "reserved", "pulled", "reconciled"];

/** Legacy columns plus the Lane 4 plan columns; the catalog name rides along as an embed. */
export const JOB_MATERIAL_COLUMNS =
  "id,job_id,name,quantity,unit,part_number,notes,state,sort_order,created_by,created_at,updated_by,updated_at,state_changed_by,state_changed_at," +
  "plan_id,catalog_item_id,source,kit_id,kit_quantity,is_optional,non_stock_reason," +
  "stage,readiness_state,readiness_reason,readiness_eta,fulfil_location_id," +
  "catalog_item:catalog_items!job_material_lines_item_same_org_fkey(name,sku)";

/** PostgREST caps responses at 1,000 rows; read in pages. */
const PAGE_SIZE = 500;
/** Keep `in.(…)` URLs short (414 guard, same as other repositories). */
const ID_CHUNK = 80;

export function mapJobMaterialLine(row: JobMaterialLineRow): JobMaterialLine {
  return {
    id: row.id,
    jobId: row.job_id,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    partNumber: row.part_number ?? null,
    notes: row.notes ?? "",
    state: isJobMaterialState(row.state) ? row.state : "needed",
    sortOrder: row.sort_order ?? 0,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedBy: row.updated_by ?? null,
    updatedAt: row.updated_at,
    stateChangedBy: row.state_changed_by ?? null,
    stateChangedAt: row.state_changed_at ?? null,
    planId: row.plan_id ?? null,
    catalogItemId: row.catalog_item_id ?? null,
    catalogItem: mapCatalogRef(row.catalog_item),
    source: isJobMaterialSource(row.source) ? row.source : "manual",
    kitId: row.kit_id ?? null,
    kitQuantity: row.kit_quantity == null ? null : Number(row.kit_quantity),
    isOptional: row.is_optional === true,
    nonStockReason: row.non_stock_reason ?? null,
    stage: LINE_STAGES.find((stage) => stage === row.stage) ?? "planned",
    readinessState: toReadinessLevel(row.readiness_state),
    readinessReason: row.readiness_reason ?? null,
    readinessEta: row.readiness_eta ?? null,
    fulfilLocationId: row.fulfil_location_id ?? null,
  };
}

function toReadinessLevel(value: string | null | undefined): MaterialReadinessLevel | null {
  return MATERIAL_READINESS_LEVELS.find((level) => level === value) ?? null;
}

function mapCatalogRef(
  value: JobMaterialLineRow["catalog_item"],
): { name: string; sku: string | null } | null {
  const ref = Array.isArray(value) ? value[0] : value;
  return ref ? { name: ref.name, sku: ref.sku ?? null } : null;
}

function notFound(message: string) {
  return Object.assign(new Error(message), { status: 404, code: "NOT_FOUND" });
}

/** Postgres 42501 from the tech guard trigger / RLS → 403 for the route. */
function toRepositoryError(error: { message: string; code?: string }) {
  if (error.code === "42501") {
    return Object.assign(new Error(error.message), { status: 403, code: "FORBIDDEN" });
  }
  return new Error(error.message);
}

export async function listJobMaterialLines(jobId: string): Promise<JobMaterialLine[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const rows: JobMaterialLineRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("job_material_lines")
      .select(JOB_MATERIAL_COLUMNS)
      .eq("org_id", orgId)
      .eq("job_id", jobId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw toRepositoryError(error);
    const page = (data ?? []) as unknown as JobMaterialLineRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows.map(mapJobMaterialLine);
}

export async function createJobMaterialLine(
  jobId: string,
  input: JobMaterialCreateInput,
  sortOrder: number,
  planId: string | null = null,
): Promise<JobMaterialLine> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_lines")
    .insert({
      org_id: orgId,
      job_id: jobId,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      part_number: input.partNumber,
      notes: input.notes,
      state: input.state,
      sort_order: sortOrder,
      // A line added to a job that has a plan joins the plan (history + needs-SKU queue).
      ...(planId ? { plan_id: planId } : {}),
    })
    .select(JOB_MATERIAL_COLUMNS)
    .single();
  if (error) throw toRepositoryError(error);
  return mapJobMaterialLine(data as unknown as JobMaterialLineRow);
}

export async function nextJobMaterialSortOrder(jobId: string): Promise<number> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_lines")
    .select("sort_order")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw toRepositoryError(error);
  const top = (data ?? [])[0] as { sort_order?: number } | undefined;
  return (top?.sort_order ?? -1) + 1;
}

export async function updateJobMaterialLine(
  jobId: string,
  lineId: string,
  patch: JobMaterialPatchInput,
): Promise<JobMaterialLine> {
  const { supabase, orgId } = await getRepositoryContext();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.quantity !== undefined) update.quantity = patch.quantity;
  if (patch.unit !== undefined) update.unit = patch.unit;
  if (patch.partNumber !== undefined) update.part_number = patch.partNumber;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.state !== undefined) update.state = patch.state;

  const { data, error } = await supabase
    .from("job_material_lines")
    .update(update)
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .eq("id", lineId)
    .select(JOB_MATERIAL_COLUMNS)
    .maybeSingle();
  if (error) throw toRepositoryError(error);
  // RLS hides lines a tech is not assigned to — same answer as "no such line".
  if (!data) throw notFound("Material line not found.");
  return mapJobMaterialLine(data as unknown as JobMaterialLineRow);
}

export async function deleteJobMaterialLine(jobId: string, lineId: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_lines")
    .delete()
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .eq("id", lineId)
    .select("id");
  if (error) throw toRepositoryError(error);
  if (!data || data.length === 0) throw notFound("Material line not found.");
}

/**
 * Per-job state counts for the Dispatch board chips. One small read per 80
 * job ids, run in parallel; jobs with no lines get an empty summary.
 */
export async function summarizeJobMaterialsForJobs(
  jobIds: ReadonlyArray<string>,
): Promise<Record<string, JobMaterialSummary>> {
  const ids = [...new Set(jobIds)];
  const result: Record<string, JobMaterialSummary> = {};
  for (const id of ids) result[id] = emptyJobMaterialSummary();
  if (ids.length === 0) return result;

  const { supabase, orgId } = await getRepositoryContext();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK));

  const statesByJob = new Map<string, JobMaterialState[]>();
  await Promise.all(
    chunks.map(async (chunk) => {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("job_material_lines")
          .select("id,job_id,state")
          .eq("org_id", orgId)
          .in("job_id", chunk)
          .order("id", { ascending: true })
          .range(from, from + 999);
        if (error) throw toRepositoryError(error);
        const page = (data ?? []) as Array<{ job_id: string; state: string }>;
        for (const row of page) {
          if (!isJobMaterialState(row.state)) continue;
          const list = statesByJob.get(row.job_id) ?? [];
          list.push(row.state);
          statesByJob.set(row.job_id, list);
        }
        if (page.length < 1000) break;
      }
    }),
  );

  for (const [jobId, states] of statesByJob) {
    result[jobId] = summarizeJobMaterialStates(states);
  }
  return result;
}
