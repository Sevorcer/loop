import "server-only";

/**
 * Feedback reports service — Sprint 7 Mini-Epic
 *
 * Thin orchestration layer: validates inputs then delegates to the repository.
 * Architecture: API route → service → repository → Supabase
 */

import type {
  CreateFeedbackReportInput,
  FeedbackReport,
  FeedbackSeverity,
  FeedbackStatus,
  UpdateFeedbackReportInput,
} from "@/features/feedback/types/feedbackReport";
import {
  validateFeedbackCreate,
  validateFeedbackUpdate,
} from "@/features/feedback/utils/feedbackValidation";

import {
  bulkUpdateFeedbackReports as bulkUpdateRecords,
  createFeedbackReport as createRecord,
  getFeedbackReportById,
  listFeedbackReports as listRecords,
  updateFeedbackReport as updateRecord,
  type ListFeedbackReportsFilter,
  type FeedbackReportWriteContext,
} from "@/repositories/feedbackReports";

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listFeedbackReports(filter?: {
  status?: FeedbackStatus;
  severity?: FeedbackSeverity;
  from?: string;
  to?: string;
}): Promise<FeedbackReport[]> {
  return listRecords(filter as ListFeedbackReportsFilter);
}

export async function createFeedbackReport(
  input: CreateFeedbackReportInput,
  ctx: FeedbackReportWriteContext,
): Promise<FeedbackReport> {
  const result = validateFeedbackCreate(input);
  if (!result.valid) {
    const firstError = Object.values(result.errors)[0];
    throw new Error(firstError ?? "Invalid feedback input.");
  }

  return createRecord(input, ctx);
}

export async function updateFeedbackReport(
  id: string,
  input: UpdateFeedbackReportInput,
): Promise<FeedbackReport> {
  const result = validateFeedbackUpdate(input);
  if (!result.valid) {
    const firstError = Object.values(result.errors)[0];
    throw new Error(firstError ?? "Invalid triage input.");
  }

  const existing = await getFeedbackReportById(id);
  if (!existing) {
    throw new Error("Feedback report not found.");
  }

  return updateRecord(id, input);
}

/** F16: bulk triage — same validation as the single update, applied to many. */
export async function bulkUpdateFeedbackReports(
  ids: string[],
  input: UpdateFeedbackReportInput,
): Promise<FeedbackReport[]> {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("Select at least one feedback report.");
  }
  if (ids.length > 200) {
    throw new Error("Bulk update is limited to 200 reports at a time.");
  }
  const result = validateFeedbackUpdate(input);
  if (!result.valid) {
    const firstError = Object.values(result.errors)[0];
    throw new Error(firstError ?? "Invalid triage input.");
  }

  return bulkUpdateRecords(ids, input);
}
