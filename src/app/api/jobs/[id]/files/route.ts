import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { logWriteFailure } from "@/lib/observability/writes";
import { listJobFiles, recordJobFileUpload } from "@/services/jobs";
import { uploadStorageFile } from "@/services/storage";

const JOB_FILES_BUCKET = "job-files";

function normalizeFileName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return cleaned.length > 0 ? cleaned : "upload.bin";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const files = await listJobFiles(id, guard.ctx.role);
    return NextResponse.json({ files });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return createApiErrorResponse("VALIDATION_ERROR", "A file is required.", 400);
    }

    const fileName = normalizeFileName(file.name);
    const storagePath = `jobs/${id}/${randomUUID()}-${fileName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const uploaded = await uploadStorageFile(guard.ctx.role, {
      bucket: JOB_FILES_BUCKET,
      storagePath,
      fileName,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      file: bytes,
      jobId: id,
      visibility: "internal",
    });

    await recordJobFileUpload(id, uploaded.fileName, uploaded.mimeType, {
      actorId: guard.ctx.userId,
      role: guard.ctx.role,
    });

    return NextResponse.json({ file: uploaded }, { status: 201 });
  } catch (error) {
    logWriteFailure({ route: "/api/jobs/[id]/files", request }, error);
    return mapRouteError(error);
  }
}
