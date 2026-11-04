import "server-only";

import type { JobBid } from "@/features/jobs/types/jobBid";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface JobBidRow {
  id: string;
  org_id: string;
  job_id: string;
  amount_cents: number | string;
  status: string;
  file_id: string | null;
  is_current: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

function toJobBid(row: JobBidRow): JobBid {
  return {
    id: row.id,
    orgId: row.org_id,
    jobId: row.job_id,
    amountCents: typeof row.amount_cents === "number" ? row.amount_cents : Number(row.amount_cents),
    status: row.status as JobBid["status"],
    fileId: row.file_id,
    isCurrent: row.is_current,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

// ---------------------------------------------------------------------------
// Unavailability guard (table may not exist yet)
// ---------------------------------------------------------------------------

function isTableMissing(error: { code?: string; message?: string }): boolean {
  const msg = error.message ?? "";
  return error.code === "42P01" || error.code === "PGRST205" || msg.includes("job_bids");
}

function tableMissingError(): Error {
  return Object.assign(new Error("Job bids are not available yet."), { status: 503 });
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

const SELECT_COLUMNS =
  "id,org_id,job_id,amount_cents,status,file_id,is_current,notes,created_at,updated_at,created_by";

/** List bids for a job, newest first. */
export async function listBidsByJobId(jobId: string): Promise<JobBid[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_bids")
    .select(SELECT_COLUMNS)
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isTableMissing(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toJobBid(row as unknown as JobBidRow));
}

/** Get a single bid by id. */
export async function getBidById(bidId: string): Promise<JobBid | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_bids")
    .select(SELECT_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", bidId)
    .maybeSingle();

  if (error) {
    if (isTableMissing(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return toJobBid(data as unknown as JobBidRow);
}

/** Mark all current bids for a job as non-current. */
export async function markBidsNonCurrent(jobId: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("job_bids")
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .eq("is_current", true);

  if (error && !isTableMissing(error)) {
    throw new Error(error.message);
  }
}

export interface CreateBidInput {
  jobId: string;
  amountCents: number;
  status: string;
  fileId?: string | null;
  notes?: string;
  createdBy?: string | null;
}

/** Insert a new bid. Caller is responsible for marking old bids non-current first. */
export async function createBid(input: CreateBidInput): Promise<JobBid> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_bids")
    .insert({
      org_id: orgId,
      job_id: input.jobId,
      amount_cents: input.amountCents,
      status: input.status,
      file_id: input.fileId ?? null,
      is_current: true,
      notes: input.notes ?? "",
      created_by: input.createdBy ?? null,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    if (isTableMissing(error)) throw tableMissingError();
    throw new Error(error.message);
  }
  return toJobBid(data as unknown as JobBidRow);
}

export interface UpdateBidInput {
  amountCents?: number;
  status?: string;
  fileId?: string | null;
  notes?: string;
}

/** Update an existing bid. */
export async function updateBid(bidId: string, input: UpdateBidInput): Promise<JobBid | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.amountCents !== undefined) updates.amount_cents = input.amountCents;
  if (input.status !== undefined) updates.status = input.status;
  if (input.fileId !== undefined) updates.file_id = input.fileId;
  if (input.notes !== undefined) updates.notes = input.notes;

  const { data, error } = await supabase
    .from("job_bids")
    .update(updates)
    .eq("org_id", orgId)
    .eq("id", bidId)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    if (isTableMissing(error)) throw tableMissingError();
    throw new Error(error.message);
  }
  return data ? toJobBid(data as unknown as JobBidRow) : null;
}

/** Delete a bid. */
export async function deleteBid(bidId: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("job_bids")
    .delete()
    .eq("org_id", orgId)
    .eq("id", bidId);

  if (error) {
    if (isTableMissing(error)) return false;
    throw new Error(error.message);
  }
  return true;
}
