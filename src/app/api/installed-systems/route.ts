/**
 * Installed Systems API.
 *
 * GET /api/installed-systems — return all installed systems and technical
 *                               profiles for the caller's org.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getInstalledSystemsSnapshot } from "@/services/installedSystems";

export async function GET(request: Request) {
  const guard = requirePermission(request, "installed_systems", "select");
  if (!guard.ok) return guard.response;

  try {
    const snapshot = await getInstalledSystemsSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return mapRouteError(error);
  }
}
