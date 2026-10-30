/**
 * Feedback Reports detail API
 *
 * PATCH /api/feedback/[id] — update status + triage notes (manager/owner only)
 * DELETE /api/feedback/[id] — delete a report (owner, or the user who created it)
 */

import { NextResponse } from "next/server";

import { canDeleteFeedbackReport } from "@/features/feedback/utils/feedbackAccess";
import type { FeedbackStatus } from "@/features/feedback/types/feedbackReport";
import { forbiddenResponse, requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { logWriteFailure } from "@/lib/observability/writes";
import { deleteFeedbackReport, getFeedbackReportById, updateFeedbackReport } from "@/services/feedbackReports";

/**
 * Owners may delete any report. Anyone else may delete only a report they
 * created. The select permission is used so the guard returns the caller
 * role and user id; the delete matrix itself is owner-only and would reject
 * a technician before the creator check.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "feedback_reports", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const report = await getFeedbackReportById(id);
    if (!report) {
      return NextResponse.json({ message: "Feedback report not found." }, { status: 404 });
    }

    const { role, userId } = guard.ctx;
    if (!canDeleteFeedbackReport(role, userId, report)) {
      return forbiddenResponse(role, "feedback_reports", "delete");
    }

    await deleteFeedbackReport(id);
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    logWriteFailure({ route: "/api/feedback/[id]", request }, error);
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "feedback_reports", "update");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);

    const patch: { status?: FeedbackStatus; triageNotes?: string | null } = {};

    if (body.status !== undefined) {
      patch.status = String(body.status) as FeedbackStatus;
    }

    if (body.triageNotes !== undefined) {
      patch.triageNotes = body.triageNotes === null ? null : String(body.triageNotes).trim();
    }

    const report = await updateFeedbackReport(id, patch);

    return NextResponse.json({ report });
  } catch (error) {
    logWriteFailure({ route: "/api/feedback/[id]", request }, error);
    return mapRouteError(error);
  }
}
