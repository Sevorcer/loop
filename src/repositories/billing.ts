import "server-only";

import type { ReadyToBillJob, BillingStatus } from "@/features/billing/types/billing";
import { getRepositoryContext } from "./supabaseContext";

// ── Row shape from Supabase ─────────────────────────────────────────────────
interface BillingJobRow {
  id: string;
  job_number: string;
  customer_name: string;
  property_name: string;
  type: string;
  billing_status: string;
  qb_invoice_number: string | null;
  billed_at: string | null;
  // We use the latest "completed" status-change activity timestamp as
  // the completion date. Fallback: created_at.
  created_at: string;
}

function mapRow(row: BillingJobRow, completedAt: string): ReadyToBillJob {
  return {
    id: row.id,
    jobNumber: row.job_number,
    customerName: row.customer_name,
    propertyName: row.property_name,
    type: row.type as "Install" | "Service",
    completedAt,
    billingStatus: row.billing_status as BillingStatus,
    qbInvoiceNumber: row.qb_invoice_number,
    billedAt: row.billed_at,
  };
}

/**
 * Fetches jobs that are ready to bill: Completed, unbilled, billing-eligible,
 * filtered by job type. Limited to recent completions to avoid shipping the
 * whole jobs table.
 */
export async function listReadyToBillJobs(
  jobType: "Install" | "Service",
  limit = 200,
): Promise<ReadyToBillJob[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id,job_number,customer_name,property_name,type,billing_status,qb_invoice_number,billed_at,created_at",
    )
    .eq("org_id", orgId)
    .eq("type", jobType)
    .eq("status", "Completed")
    .eq("billing_status", "unbilled")
    .eq("billing_eligible", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  // We use created_at as a proxy for completion date here. The actual
  // completion timestamp comes from job_activity, but for the list view
  // created_at of the completed job is close enough and avoids a join.
  // The real completion date is fetched per-job when needed.
  return (data ?? []).map((row) =>
    mapRow(row as unknown as BillingJobRow, row.created_at as string),
  );
}

/**
 * Fetches the completion timestamp for a job from job_activity.
 * Returns the most recent "status" activity where the description
 * contains "to Completed".
 */
export async function getJobCompletionDate(jobId: string): Promise<string | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("job_activity")
    .select("created_at")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .eq("type", "status")
    .ilike("description", "%to Completed%")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return null;
  return data?.[0]?.created_at ?? null;
}

/**
 * Mark a job as billed: sets billing_status, invoice number, and billed date.
 */
export async function markJobBilled(
  jobId: string,
  qbInvoiceNumber: string,
  billedAt: string,
  billedBy: string,
): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();

  const { error } = await supabase
    .from("jobs")
    .update({
      billing_status: "billed",
      qb_invoice_number: qbInvoiceNumber,
      billed_at: billedAt,
      billed_by: billedBy,
    })
    .eq("id", jobId)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);
  return true;
}

/**
 * Un-mark a job as billed: clears billing fields, returns it to the list.
 */
export async function unmarkJobBilled(jobId: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();

  const { error } = await supabase
    .from("jobs")
    .update({
      billing_status: "unbilled",
      qb_invoice_number: null,
      billed_at: null,
      billed_by: null,
    })
    .eq("id", jobId)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);
  return true;
}

/**
 * Exclude a job from ever appearing in the ready-to-bill list.
 */
export async function excludeJobFromBilling(jobId: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();

  const { error } = await supabase
    .from("jobs")
    .update({ billing_status: "excluded" })
    .eq("id", jobId)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);
  return true;
}

/**
 * Un-exclude a job: returns it to the ready-to-bill list (if still eligible).
 */
export async function unexcludeJobFromBilling(jobId: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();

  const { error } = await supabase
    .from("jobs")
    .update({
      billing_status: "unbilled",
      qb_invoice_number: null,
      billed_at: null,
      billed_by: null,
    })
    .eq("id", jobId)
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);
  return true;
}

/**
 * Set billing_eligible = true on a job. Called when a job transitions to Completed.
 */
export async function setBillingEligible(jobId: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();

  const { error } = await supabase
    .from("jobs")
    .update({ billing_eligible: true })
    .eq("id", jobId)
    .eq("org_id", orgId);

  if (error) {
    // Column may not exist yet if migration hasn't been applied.
    // Fail silently — the job just won't appear in the billing list.
    console.warn("[billing] Failed to set billing_eligible:", error.message);
    return false;
  }
  return true;
}
