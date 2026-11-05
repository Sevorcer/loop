import "server-only";

import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Job change orders — per-job change order tracking.
// Follows the repositories/jobPermits.ts convention: throw on error.
// ---------------------------------------------------------------------------

export type ChangeOrderStatus = "proposed" | "approved" | "declined";

const VALID_STATUSES: ReadonlySet<string> = new Set<ChangeOrderStatus>([
  "proposed",
  "approved",
  "declined",
]);

export function isChangeOrderStatus(value: string): value is ChangeOrderStatus {
  return VALID_STATUSES.has(value);
}

export interface JobChangeOrderRow {
  id: string;
  org_id: string;
  job_id: string;
  title: string;
  description: string;
  amount_cents: number;
  status: string;
  created_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobChangeOrder {
  id: string;
  orgId: string;
  jobId: string;
  title: string;
  description: string;
  amountCents: number;
  status: ChangeOrderStatus;
  createdBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const COLUMNS =
  "id,org_id,job_id,title,description,amount_cents,status,created_by,approved_at,created_at,updated_at";

function mapRow(row: JobChangeOrderRow): JobChangeOrder {
  return {
    id: row.id,
    orgId: row.org_id,
    jobId: row.job_id,
    title: row.title,
    description: row.description,
    amountCents: row.amount_cents,
    status: isChangeOrderStatus(row.status) ? row.status : "proposed",
    createdBy: row.created_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listByJobId(jobId: string): Promise<JobChangeOrder[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_change_orders")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as JobChangeOrderRow));
}

export async function getById(id: string): Promise<JobChangeOrder> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_change_orders")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as JobChangeOrderRow);
}

export interface CreateChangeOrderInput {
  jobId: string;
  title: string;
  description?: string;
  amountCents: number;
  createdBy?: string | null;
}

export async function create(input: CreateChangeOrderInput): Promise<JobChangeOrder> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_change_orders")
    .insert({
      org_id: orgId,
      job_id: input.jobId,
      title: input.title,
      description: input.description ?? "",
      amount_cents: input.amountCents,
      created_by: input.createdBy ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as JobChangeOrderRow);
}

export interface UpdateChangeOrderInput {
  title?: string;
  description?: string;
  amountCents?: number;
  status?: ChangeOrderStatus;
  approvedAt?: string | null;
}

export async function update(
  id: string,
  input: UpdateChangeOrderInput,
): Promise<JobChangeOrder> {
  const { supabase, orgId } = await getRepositoryContext();

  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description;
  if (input.amountCents !== undefined) payload.amount_cents = input.amountCents;
  if (input.status !== undefined) payload.status = input.status;
  if (input.approvedAt !== undefined) payload.approved_at = input.approvedAt;

  if (Object.keys(payload).length === 0) {
    return getById(id);
  }

  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("job_change_orders")
    .update(payload)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as JobChangeOrderRow);
}

export async function deleteChangeOrder(id: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("job_change_orders")
    .delete()
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(error.message);
}
