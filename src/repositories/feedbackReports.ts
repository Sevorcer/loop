import "server-only";

/**
 * Feedback reports repository — Sprint 7 Mini-Epic
 *
 * CRUD operations for feedback_reports table.
 * All queries are scoped to org_id via getRepositoryContext().
 */

import type {
  CreateFeedbackReportInput,
  FeedbackReport,
  FeedbackSeverity,
  FeedbackStatus,
  UpdateFeedbackReportInput,
} from "@/features/feedback/types/feedbackReport";

import { getRepositoryContext } from "./supabaseContext";

// ─── DB row shape ─────────────────────────────────────────────────────────────

interface FeedbackReportRow {
  id: string;
  org_id: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
  created_by_role: string;
  severity: FeedbackSeverity;
  intended_action: string;
  actual_result: string;
  route_path: string;
  context_job_id: string | null;
  context_customer_id: string | null;
  context_property_id: string | null;
  screenshot_url: string | null;
  status: FeedbackStatus;
  triage_notes: string | null;
}

function mapRow(row: FeedbackReportRow): FeedbackReport {
  return {
    id: row.id,
    orgId: row.org_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
    createdByRole: row.created_by_role,
    severity: row.severity,
    intendedAction: row.intended_action,
    actualResult: row.actual_result,
    routePath: row.route_path,
    contextJobId: row.context_job_id,
    contextCustomerId: row.context_customer_id,
    contextPropertyId: row.context_property_id,
    screenshotUrl: row.screenshot_url,
    status: row.status,
    triageNotes: row.triage_notes,
  };
}

// ─── List filters ─────────────────────────────────────────────────────────────

export interface ListFeedbackReportsFilter {
  status?: FeedbackStatus;
  severity?: FeedbackSeverity;
  from?: string; // ISO date string
  to?: string;   // ISO date string
  createdByUserId?: string;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listFeedbackReports(
  filter: ListFeedbackReportsFilter = {},
  options?: { page?: number; pageSize?: number },
): Promise<FeedbackReport[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();

  let query = supabase
    .from("feedback_reports")
    .select("*")
    .eq("org_id", orgId)
    // Sort: P0 first, then P1, P2, P3, then newest within each severity
    .order("severity", { ascending: true })
    .order("created_at", { ascending: false });

  if (filter.status) {
    query = query.eq("status", filter.status);
  }

  if (filter.severity) {
    query = query.eq("severity", filter.severity);
  }

  if (filter.from) {
    query = query.gte("created_at", filter.from);
  }

  if (filter.to) {
    query = query.lte("created_at", filter.to);
  }

  if (filter.createdByUserId) {
    query = query.eq("created_by_user_id", filter.createdByUserId);
  }

  query = query.range(from, to);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data as FeedbackReportRow[]).map(mapRow);
}

export async function getFeedbackReportById(
  id: string,
): Promise<FeedbackReport | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("feedback_reports")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new Error(error.message);
  }

  return mapRow(data as FeedbackReportRow);
}

// ─── Write ────────────────────────────────────────────────────────────────────

export interface FeedbackReportWriteContext {
  userId: string;
  role: string;
}

export async function createFeedbackReport(
  input: CreateFeedbackReportInput,
  ctx: FeedbackReportWriteContext,
): Promise<FeedbackReport> {
  const { supabase, orgId } = await getRepositoryContext();

  const { data, error } = await supabase
    .from("feedback_reports")
    .insert({
      org_id: orgId,
      created_by_user_id: ctx.userId ?? null,
      created_by_role: ctx.role,
      severity: input.severity,
      intended_action: input.intendedAction.trim(),
      actual_result: input.actualResult.trim(),
      route_path: input.routePath.trim(),
      context_job_id: input.contextJobId ?? null,
      context_customer_id: input.contextCustomerId ?? null,
      context_property_id: input.contextPropertyId ?? null,
      screenshot_url: input.screenshotUrl ?? null,
      status: "new",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create feedback report.");
  }

  return mapRow(data as FeedbackReportRow);
}

export async function updateFeedbackReport(
  id: string,
  input: UpdateFeedbackReportInput,
): Promise<FeedbackReport> {
  const { supabase, orgId } = await getRepositoryContext();

  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.triageNotes !== undefined) patch.triage_notes = input.triageNotes;

  const { data, error } = await supabase
    .from("feedback_reports")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") throw new Error("Feedback report not found.");
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Feedback report not found.");
  }

  return mapRow(data as FeedbackReportRow);
}

/**
 * Deletes a single feedback report by id (org-scoped). */ export async function deleteFeedbackReport(id: string): Promise<void> { const { supabase, orgId } = await getRepositoryContext(); const { error } = await supabase.from("feedback_reports").delete().eq("id", id).eq("org_id", orgId); if (error) { throw new Error(error.message); } } /** F16: bulk status update for triage. Updates all matching rows in the caller's
 * org and returns the updated reports.
 */
export async function bulkUpdateFeedbackReports(
  ids: string[],
  input: UpdateFeedbackReportInput,
): Promise<FeedbackReport[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.triageNotes !== undefined) patch.triage_notes = input.triageNotes;

  const { data, error } = await supabase
    .from("feedback_reports")
    .update(patch)
    .in("id", ids)
    .eq("org_id", orgId)
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as FeedbackReportRow[]).map(mapRow);
}

