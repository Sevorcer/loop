/**
 * Public Portal API — GC Portal Task 1
 *
 * GET /api/portal/[token] — resolve a share-link token to scoped job data
 *
 * Access: public (no auth required). Token is the sole authorization.
 * Returns job data scoped strictly to the token's job.
 */

import { NextResponse } from "next/server";

import { resolveShareToken } from "@/services/jobShareLinks";
import { getPortalJobData } from "@/services/portalJobData";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const resolved = await resolveShareToken(token);
  if (!resolved) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Invalid or expired share link.", code: 404 },
      { status: 404 },
    );
  }

  try {
    const jobData = await getPortalJobData(resolved.jobId, resolved.orgId);
    if (!jobData) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Job not found.", code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ job: jobData });
  } catch {
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Failed to load job data.", code: 500 },
      { status: 500 },
    );
  }
}
