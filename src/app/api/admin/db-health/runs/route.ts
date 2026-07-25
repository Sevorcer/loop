import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { listHealthRuns } from "@/services/dbHealth";

/**
 * GET /api/admin/db-health/runs
 *
 * Returns a list of recent DB health check runs, newest first.
 * Restricted to owner and manager roles.
 */
export async function GET(request: Request) {
  const guard = await requirePermission(request, "db_health_check_runs", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 14, 1), 100) : 14;

  try {
    const runs = await listHealthRuns(limit);
    return NextResponse.json({ runs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to list runs: ${message}` }, { status: 500 });
  }
}
