import { NextResponse } from "next/server";

import { isUuid } from "@/lib/manuals/routeHelpers";
import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { listInstalledSystemPhotos } from "@/services/installedSystemPhotos";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "installed_systems", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return createApiErrorResponse("VALIDATION", "A valid installed system id is required.", 400);
  }

  try {
    const photos = await listInstalledSystemPhotos(id);
    return NextResponse.json({ photos });
  } catch (error) {
    return mapRouteError(error);
  }
}
