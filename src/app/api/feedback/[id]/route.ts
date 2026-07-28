/**
 * Feedback Reports detail API
 *
 * PATCH /api/feedback/[id] — update status + triage notes (manager/owner only)
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { logWriteFailure } from "@/lib/observability/writes";
import type { FeedbackStatus } from "@/features/feedback/types/feedbackReport";
import { updateFeedbackReport } from "@/services/feedbackReports";

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
