/**
 * Operational reports API (P3).
 *
 * GET /api/reports?month=YYYY-MM — returns the four operational reports for
 * the month: monthly install report, pipeline view, tech scorecards, and
 * callback/rework tracking. Computed server-side from jobs + job_activity.
 *
 * Access: all internal staff roles (jobs read).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import {
  computeOperationalReports,
  currentMonthKey,
  isValidMonth,
} from "@/features/reporting/utils/operationalReports";
import { listJobReportRows, listJobStatusActivities } from "@/repositories/jobs";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(request.url);
    const requested = url.searchParams.get("month");
    const month =
      requested && isValidMonth(requested) ? requested : currentMonthKey();

    const ctx = { userId: guard.ctx.userId };
    const [rows, activities] = await Promise.all([
      listJobReportRows(ctx),
      listJobStatusActivities(ctx),
    ]);

    const reports = computeOperationalReports(rows, activities, month);
    return NextResponse.json({ reports });
  } catch (error) {
    return mapRouteError(error);
  }
}
