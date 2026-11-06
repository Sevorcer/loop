import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { normalizeUploadFileName, validateJobFile } from "@/lib/fileValidation";
import { logWriteFailure } from "@/lib/observability/writes";
import { recordJobFileUpload } from "@/services/jobs";
import { completeJobFileSignedUpload } from "@/services/storage";

import { jobFileTechAssignmentResponse } from "../uploadGuard";

const JOB_FILES_BUCKET = "job-files";

/**
 * Step 2 of the direct photo upload: after the client PUTs the file to the
 * signed URL from /files/sign, this records it — but only after the service
 * verifies the object actually landed in Storage with the declared size
 * and content type. The storagePath must be one this job's sign step issued
 * (jobs/<jobId>/…), so a caller cannot register arbitrary objects.
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
      storagePath?: unknown;
      fileName?: unknown;
      mimeType?: unknown;
      sizeBytes?: unknown;
    } | null;

    const storagePath = typeof body?.storagePath === "string" ? body.storagePath : "";
    const fileNameRaw = typeof body?.fileName === "string" ? body.fileName : "";
    const mimeType =
      typeof body?.mimeType === "string" && body.mimeType
        ? body.mimeType
        : "application/octet-stream";
    const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : NaN;

    if (!storagePath.startsWith(`jobs/${id}/`) || !fileNameRaw || !Number.isFinite(sizeBytes)) {
      return createApiErrorResponse(
        "VALIDATION_ERROR",
        "A signed upload for this job (storagePath, fileName, sizeBytes) is required.",
        400,
      );
    }

    const validationError = validateJobFile({ mimeType, sizeBytes });
    if (validationError) {
      return createApiErrorResponse("VALIDATION_ERROR", validationError, 400);
    }

    const uploaded = await completeJobFileSignedUpload(guard.ctx.role, {
      bucket: JOB_FILES_BUCKET,
      storagePath,
      fileName: normalizeUploadFileName(fileNameRaw),
      mimeType,
      sizeBytes,
      jobId: id,
      visibility: "internal",
      uploadedBy: guard.ctx.userId || null,
    });

    await recordJobFileUpload(id, uploaded.fileName, uploaded.mimeType, {
      actorId: guard.ctx.userId,
      role: guard.ctx.role,
    });

    return NextResponse.json({ file: uploaded }, { status: 201 });
  } catch (error) {
    logWriteFailure({ route: "/api/jobs/[id]/files/complete", request }, error);
    return mapRouteError(error);
  }
}
