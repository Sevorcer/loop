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
import { createRepositoryErrorBody } from "@/lib/repositories/http";
import { createJobsService } from "@/services/domain/jobsService";

const jobsService = createJobsService();

export async function GET(request: Request) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  const result = await jobsService.list();
  if (!result.ok) {
    const error = createRepositoryErrorBody(result.error);
    return NextResponse.json(error.body, { status: error.status });
  }

  return NextResponse.json({ jobs: result.data.items });
}
