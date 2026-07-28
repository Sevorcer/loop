import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { getDownloadUrl, getFileMetadata } from "@/services/storage";

/**
 * GET /api/jobs/:id/files/:fileId
 *
 * Returns a short-lived signed download URL for a specific job attachment.
 * The file must belong to the same job; org-scoping is enforced by the
 * storage repository via RLS.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id, fileId } = await params;

    // Verify the file belongs to this job before signing the URL.
    const meta = await getFileMetadata(guard.ctx.role, fileId);
    if (!meta) {
      return createApiErrorResponse("NOT_FOUND", "File not found.", 404);
    }

    if (meta.jobId !== id) {
      return createApiErrorResponse("NOT_FOUND", "File not found.", 404);
    }

    const url = await getDownloadUrl(guard.ctx.role, fileId, 300);
    return NextResponse.json({ url, fileName: meta.fileName });
  } catch (error) {
    return mapRouteError(error);
  }
}
