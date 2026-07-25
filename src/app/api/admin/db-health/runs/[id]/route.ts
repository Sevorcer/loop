import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { getHealthRun } from "@/services/dbHealth";

/**
 * GET /api/admin/db-health/runs/[id]
 *
 * Returns a single DB health check run with all check results.
 * Restricted to owner and manager roles.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "db_health_check_runs", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid run ID." }, { status: 400 });
  }

  try {
    const run = await getHealthRun(id);

    if (!run) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to get run: ${message}` }, { status: 500 });
  }
}
