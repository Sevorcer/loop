import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getJobFinancialsForRole } from "@/services/jobFinancials";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/jobs/[id]/financials — imported SF money picture for one job.
 * Owner-only (Collin, 2026-11-04): the service enforces the role; this
 * route enforces the permission guard and RETURNS its failure response.
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "job_financials", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await context.params;
    const financials = await getJobFinancialsForRole(guard.ctx.role, id);
    return NextResponse.json(financials);
  } catch (error) {
    return mapRouteError(error);
  }
}
