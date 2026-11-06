import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { isUuid } from "@/lib/manuals/routeHelpers";
import { logWriteFailure } from "@/lib/observability/writes";
import { completeInstalledSystemPhoto } from "@/services/installedSystemPhotos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "installed_systems", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return createApiErrorResponse("VALIDATION", "A valid installed system id is required.", 400);
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      storagePath?: unknown;
      fileName?: unknown;
      mimeType?: unknown;
      sizeBytes?: unknown;
    } | null;
    const storagePath = typeof body?.storagePath === "string" ? body.storagePath : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";
    const mimeType = typeof body?.mimeType === "string" && body.mimeType ? body.mimeType : "application/octet-stream";
    const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : NaN;
    if (!storagePath || !fileName || !Number.isFinite(sizeBytes)) {
      return createApiErrorResponse(
        "VALIDATION",
        "A signed upload for this installed system (storagePath, fileName, sizeBytes) is required.",
        400,
      );
    }

    const photo = await completeInstalledSystemPhoto(guard.ctx.role, id, {
      storagePath,
      fileName,
      mimeType,
      sizeBytes,
      uploadedBy: guard.ctx.userId || null,
    });
    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error as { status?: number }).status === 400) {
      return createApiErrorResponse("VALIDATION", error.message, 400);
    }
    logWriteFailure({ route: "/api/installed-systems/[id]/photos/complete", request }, error);
    return mapRouteError(error);
  }
}
