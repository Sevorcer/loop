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
  const guard = requirePermission(request, "performance_models", "select");
  if (!guard.ok) return guard.response;

  try {
    const models = await listPerformanceModels({ status: "active" });
    return NextResponse.json({ performanceModels: models });
  } catch (error) {
    return mapRouteError(error);
  }
}
