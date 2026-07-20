/**
 * Individual installed system lookup.
 *
 * GET /api/installed-systems/[id]
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getInstalledSystemById } from "@/repositories/installedSystems";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const result = await getInstalledSystemById(id);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.code, message: result.error.message },
        { status: 404 }
      );
    }
    if (!result.data) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Installed system ${id} not found.` },
        { status: 404 }
      );
    }
    return NextResponse.json({ installedSystem: result.data });
  } catch (error) {
    return mapRouteError(error);
  }
}
