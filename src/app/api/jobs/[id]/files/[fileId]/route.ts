import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { deleteFile, getStorageObjectById } from "@/repositories/storage";

/**
 * DELETE /api/jobs/[id]/files/[fileId] — delete a job file.
 *
 * Permission: owner/manager can delete any file. Other roles (tech, office)
 * can delete only files they uploaded themselves. (Permission is checked
 * here rather than via deleteStorageFile, which is manager-only.)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  try {
    const { id, fileId } = await params;

    const file = await getStorageObjectById(fileId);
    if (!file || file.jobId !== id) {
      return createApiErrorResponse("NOT_FOUND", "File not found.", 404);
    }

    const role = guard.ctx.role;
    const isManager = role === "owner" || role === "manager";
    const isOwnUpload = file.uploadedBy != null && file.uploadedBy === guard.ctx.userId;

    if (!isManager && !isOwnUpload) {
      return createApiErrorResponse(
        "FORBIDDEN",
        "You can only delete files you uploaded.",
        403,
      );
    }

    await deleteFile(fileId);

    return NextResponse.json({ message: "File deleted.", id: fileId });
  } catch (error) {
    return mapRouteError(error);
  }
}
