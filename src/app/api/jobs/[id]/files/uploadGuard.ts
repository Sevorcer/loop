import type { NextResponse } from "next/server";

import type { AuthContext } from "@/lib/api-auth";
import { createApiErrorResponse } from "@/lib/api/routeErrors";
import { getJob } from "@/services/jobs";

/**
 * Tech-assignment check shared by the job-file upload routes (multipart
 * POST and the signed direct-upload sign/complete pair). The routes call
 * requirePermission(request, "jobs", "update") themselves; this adds the
 * rule that a tech may only upload to jobs they are assigned to. Returns
 * the error response to send, or null when the write may proceed.
 */
export async function jobFileTechAssignmentResponse(
  ctx: AuthContext,
  jobId: string,
): Promise<NextResponse | null> {
  if (ctx.role !== "tech") return null;

  const job = await getJob(jobId);
  if (!job) {
    return createApiErrorResponse("NOT_FOUND", "Job not found.", 404);
  }
  const isAssigned = (job.assignees ?? []).some((a) => a.id === ctx.userId);
  if (!isAssigned) {
    return createApiErrorResponse(
      "FORBIDDEN",
      "You are not assigned to this job.",
      403,
    );
  }
  return null;
}
