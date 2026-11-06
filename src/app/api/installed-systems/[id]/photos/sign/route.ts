import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { isUuid } from "@/lib/manuals/routeHelpers";
import { logWriteFailure } from "@/lib/observability/writes";
import { signInstalledSystemPhoto } from "@/services/installedSystemPhotos";

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
      fileName?: unknown;
      mimeType?: unknown;
      sizeBytes?: unknown;
    } | null;
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";
    const mimeType = typeof body?.mimeType === "string" && body.mimeType ? body.mimeType : "application/octet-stream";
    const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : NaN;
    if (!fileName || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return createApiErrorResponse("VALIDATION", "fileName and a positive sizeBytes are required.", 400);
    }

    const signed = await signInstalledSystemPhoto(guard.ctx.role, id, { fileName, mimeType, sizeBytes });
    return NextResponse.json(signed);
  } catch (error) {
    if (error instanceof Error && (error as { status?: number }).status === 400) {
      return createApiErrorResponse("VALIDATION", error.message, 400);
    }
    logWriteFailure({ route: "/api/installed-systems/[id]/photos/sign", request }, error);
    return mapRouteError(error);
  }
}
