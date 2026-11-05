import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  createApiErrorResponse,
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import { getFollowUp, setFollowUp } from "@/services/jobFollowUps";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const followUp = await getFollowUp(id);
    if (!followUp) return createApiErrorResponse("NOT_FOUND", "Job not found.", 404);
    return NextResponse.json({ followUp });
  } catch (error) {
    return mapRouteError(error);
  }
}

/**
 * Mark / unmark a job for follow-up: { needed: boolean, note?: string }.
 * Anyone who can update the job may do it, including on completed jobs.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const body = await readJsonObject(request);
    if (typeof body.needed !== "boolean") {
      return createApiErrorResponse("INVALID_PAYLOAD", "needed must be true or false.", 400);
    }
    const followUp = await setFollowUp({
      jobId: id,
      needed: body.needed,
      note: body.note,
      userId: guard.ctx.userId,
    });
    return NextResponse.json({ followUp });
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message === "Invalid JSON body.")) {
      return invalidJsonResponse();
    }
    if (error instanceof Error && error.message === "Job not found.") {
      return createApiErrorResponse("NOT_FOUND", "Job not found.", 404);
    }
    return mapRouteError(error);
  }
}
