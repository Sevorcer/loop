import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listRecentJobs } from "@/services/jobs";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/**
 * GET /api/jobs/recent?limit=N
 *
 * Latest jobs by updated_at, capped server-side. Dedicated read for the
 * dashboard "Recent Jobs" widget so it never pages the whole workspace (which
 * timed the widget out on large orgs). Distinct from /api/jobs, whose contract
 * the Jobs page still depends on.
 */
export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("limit"));
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), MAX_LIMIT)
      : DEFAULT_LIMIT;

  try {
    const jobs = await listRecentJobs(limit);
    return NextResponse.json({ jobs });
  } catch (error) {
    return mapRouteError(error);
  }
}
