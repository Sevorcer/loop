/**
 * Reporting API — Sprint 27 #59
 *
 * GET /api/reporting  — returns active performance models for the org.
 *
 * Note: Full KPI/scorecard/trend analytics are computed from operational
 * data at the UI layer using the enrichment utilities in reportingUtils.ts.
 * This endpoint provides the performance model definitions that drive
 * those computations.
 *
 * Access: all internal staff roles
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listPerformanceModels } from "@/repositories/performanceReporting";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "performance_models", "select");
  if (!guard.ok) return guard.response;

  try {
    // Pass the already-resolved userId through: requirePermission above
    // performed a session refresh when needed, so re-resolving the session
    // here can observe stale cookies and fail the request.
    const models = await listPerformanceModels({ status: "active" }, { userId: guard.ctx.userId });
    return NextResponse.json({ performanceModels: models });
  } catch (error) {
    // TEMP DEBUG — remove after diagnosing prod 500
    console.error("[REPORTING_DEBUG] listPerformanceModels failed:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5) : undefined,
      userId: guard.ctx.userId,
    });
    return mapRouteError(error);
  }
}
