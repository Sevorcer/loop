/**
 * Feedback Reports bulk API — F16
 *
 * PATCH /api/feedback/bulk — update status on many reports at once
 * (manager/owner only). Body: { ids: string[], status: FeedbackStatus }.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { logWriteFailure } from "@/lib/observability/writes";
import type { FeedbackStatus } from "@/features/feedback/types/feedbackReport";
import { FEEDBACK_STATUS_VALUES } from "@/features/feedback/types/feedbackReport";
import { bulkUpdateFeedbackReports } from "@/services/feedbackReports";

export async function PATCH(request: Request) {
  const guard = await requirePermission(request, "feedback_reports", "update");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const ids = Array.isArray(body.ids)
      ? (body.ids as unknown[]).filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const status = String(body.status ?? "") as FeedbackStatus;

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "VALIDATION", message: "Select at least one feedback report.", code: 400 },
        { status: 400 },
      );
    }

    if (!FEEDBACK_STATUS_VALUES.includes(status)) {
      return NextResponse.json(
        { error: "VALIDATION", message: "Invalid status.", code: 400 },
        { status: 400 },
      );
    }

    const reports = await bulkUpdateFeedbackReports(ids, { status });

    return NextResponse.json({ reports, updated: reports.length });
  } catch (error) {
    logWriteFailure({ route: "/api/feedback/bulk", request }, error);
    return mapRouteError(error);
  }
}
