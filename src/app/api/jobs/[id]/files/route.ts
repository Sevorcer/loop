import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { logWriteFailure } from "@/lib/observability/writes";
import { listJobFiles, recordJobFileUpload } from "@/services/jobs";
import { uploadStorageFile } from "@/services/storage";

const JOB_FILES_BUCKET = "job-files";

function normalizeFileName(value: string): string {
  const trimmed = value.trim();
  const extensionMatch = /\.([a-zA-Z0-9]{1,10})$/.exec(trimmed);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : "";
  const baseName = extensionMatch ? trimmed.slice(0, -extension.length) : trimmed;
  const normalizedBase = baseName
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeBaseName = normalizedBase.length > 0 ? normalizedBase : "upload";
  return `${safeBaseName}${extension || ".bin"}`;
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
