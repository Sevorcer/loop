/**
 * Dispatch board API — read-only view of jobs for operational scheduling.
 *
 * Returns jobs accessible to the caller's role. Dispatch, owner, and manager
 * are the primary consumers, but any role with jobs/select access may call
 * this endpoint. Row-level restrictions (e.g. tech sees own assigned jobs
 * only) are enforced at the database layer by RLS.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listJobsWithActivity } from "@/services/jobs";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { jobs } = await listJobsWithActivity();
    return NextResponse.json({ jobs });
  } catch (error) {
    return mapRouteError(error);
  }
}
