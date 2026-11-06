import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { normalizeUploadFileName, validateJobFile } from "@/lib/fileValidation";
import { logWriteFailure } from "@/lib/observability/writes";
import { createJobFileSignedUpload } from "@/services/storage";

import { jobFileTechAssignmentResponse } from "../uploadGuard";

const JOB_FILES_BUCKET = "job-files";

/**
 * Step 1 of the direct photo upload: validates the declared file and hands
 * back a signed URL the client PUTs the bytes to, straight to Storage.
 * The file itself never passes through this server — its platform
 * request-body limit (~4.5 MB) silently killed larger field photos when
 * uploads were proxied as multipart form posts.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;
  const techBlock = await jobFileTechAssignmentResponse(guard.ctx, id);
  if (techBlock) return techBlock;

  try {
    const body = (await request.json().catch(() => null)) as {
      fileName?: unknown;
      mimeType?: unknown;
      sizeBytes?: unknown;
    } | null;

    const fileNameRaw = typeof body?.fileName === "string" ? body.fileName : "";
    const mimeType =
      typeof body?.mimeType === "string" && body.mimeType
        ? body.mimeType
        : "application/octet-stream";
    const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : NaN;

    if (!fileNameRaw || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return createApiErrorResponse(
        "VALIDATION_ERROR",
        "fileName and a positive sizeBytes are required.",
        400,
      );
    }

    const validationError = validateJobFile({ mimeType, sizeBytes });
    if (validationError) {
      return createApiErrorResponse("VALIDATION_ERROR", validationError, 400);
    }

    const fileName = normalizeUploadFileName(fileNameRaw);
    const storagePath = `jobs/${id}/${randomUUID()}-${fileName}`;

    const { signedUrl } = await createJobFileSignedUpload(guard.ctx.role, {
      bucket: JOB_FILES_BUCKET,
      storagePath,
    });

    return NextResponse.json({ signedUrl, storagePath, fileName });
  } catch (error) {
    logWriteFailure({ route: "/api/jobs/[id]/files/sign", request }, error);
    return mapRouteError(error);
  }
}
