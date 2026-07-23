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
  const guard = await requirePermission(request, "installed_systems", "select");
  if (!guard.ok) return guard.response;

  console.log(
    "[AUTH_FLOW]",
    JSON.stringify({
      event: "guard.pass",
      route: "/api/installed-systems",
      userId: guard.ctx.userId,
      role: guard.ctx.role,
      requestId:
        request.headers.get("x-request-id") ??
        request.headers.get("x-correlation-id") ??
        request.headers.get("x-vercel-id") ??
        undefined,
    }),
  );

  try {
    const snapshot = await getInstalledSystemsSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return mapRouteError(error);
  }
}
