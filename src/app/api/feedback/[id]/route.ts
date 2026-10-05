/**
 * Feedback Reports detail API
 *
 * PATCH /api/feedback/[id] — update status + triage notes (manager/owner only) * DELETE /api/feedback/[id] — delete a report (owner, or the user who created it)
 */

import { NextResponse } from "next/server";

import { forbiddenResponse, requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { logWriteFailure } from "@/lib/observability/writes";
import type { FeedbackStatus } from "@/features/feedback/types/feedbackReport";
import { deleteFeedbackReport, getFeedbackReportById, updateFeedbackReport } from "@/services/feedbackReports";

/* QA break-things: owners may delete any report; other roles may delete only reports they created. Auth uses the select permission (all page viewers can read) so the guard returns the caller role/userId for the ownership check. */ export async function DELETE( request: Request, { params }: { params: Promise<{ id: string }> }, ) { const guard = await requirePermission(request, "feedback_reports", "select"); if (!guard.ok) return guard.response; try { const { id } = await params; const report = await getFeedbackReportById(id); if (!report) { return NextResponse.json({ message: "Feedback report not found." }, { status: 404 }); } const { role, userId } = guard.ctx; if (role !== "owner" && report.createdByUserId !== userId) { return forbiddenResponse(role, "feedback_reports", "delete"); } await deleteFeedbackReport(id); return NextResponse.json({ deleted: true, id }); } catch (error) { logWriteFailure({ route: "/api/feedback/[id]", request }, error); return mapRouteError(error); } } export async function PATCH(
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
