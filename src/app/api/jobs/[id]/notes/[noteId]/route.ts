import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  createApiErrorResponse,
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import { updateJobNoteBody } from "@/services/jobs";

const NOTE_EDIT_ROLES = new Set([
  "owner",
  "manager",
  "dispatch",
  "office",
  "sales",
  "tech",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const guard = await requirePermission(request, "job_notes", "update");
  if (!guard.ok) return guard.response;

  if (!NOTE_EDIT_ROLES.has(guard.ctx.role)) {
    return createApiErrorResponse("FORBIDDEN", "You cannot edit notes.", 403);
  }

  try {
    const { id, noteId } = await params;
    const body = await readJsonObject(request);
    const noteBody = typeof body.body === "string" ? body.body : "";
    const updated = await updateJobNoteBody(id, noteId, noteBody, {
      actorId: guard.ctx.userId,
      role: guard.ctx.role,
    });
    if (!updated) {
      return createApiErrorResponse("NOT_FOUND", "Job not found.", 404);
    }
    return NextResponse.json({ note: updated });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "Invalid JSON body.")
    ) {
      return invalidJsonResponse();
    }
    if (error instanceof Error && /required|not found/i.test(error.message)) {
      return createApiErrorResponse(
        /not found/i.test(error.message) ? "NOT_FOUND" : "VALIDATION_ERROR",
        error.message,
        /not found/i.test(error.message) ? 404 : 400,
      );
    }
    return mapRouteError(error);
  }
}
