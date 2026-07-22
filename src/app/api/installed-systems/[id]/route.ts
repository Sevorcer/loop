/**
 * Individual installed system lookup.
 *
 * GET /api/installed-systems/[id]
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRepositoryError, mapRouteError } from "@/lib/api/routeErrors";
import { getInstalledSystemById } from "@/repositories/installedSystems";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermission(request, "installed_systems", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const result = await getInstalledSystemById(id);
    if (!result.ok) {
      return mapRepositoryError(result.error);
    }
    if (!result.data) {
      return createApiErrorResponse("NOT_FOUND", `Installed system ${id} not found.`, 404);
    }
    return NextResponse.json({ installedSystem: result.data });
  } catch (error) {
    return mapRouteError(error);
  }
}
