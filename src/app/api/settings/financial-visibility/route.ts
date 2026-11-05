import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import {
  getFinancialsVisibility,
  setFinancialsVisibilityForRole,
} from "@/services/orgSettings";

function forbidden() {
  return NextResponse.json(
    { error: "FORBIDDEN", message: "Only the owner can change this setting.", code: 403 },
    { status: 403 },
  );
}

/**
 * GET /api/settings/financial-visibility — current value (owner-only UI).
 * PUT — set it. Only the owner (main admin) may read or change it; the
 * service enforces the role, this route enforces the permission guard and
 * RETURNS its failure response.
 */
export async function GET(request: Request) {
  const guard = await requirePermission(request, "organizations", "select");
  if (!guard.ok) return guard.response;
  if (guard.ctx.role !== "owner") return forbidden();
  try {
    return NextResponse.json({ visibility: await getFinancialsVisibility() });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PUT(request: Request) {
  const guard = await requirePermission(request, "organizations", "update");
  if (!guard.ok) return guard.response;
  try {
    const body = await readJsonObject(request);
    const visibility = await setFinancialsVisibilityForRole(
      guard.ctx.role,
      guard.ctx.userId || null,
      body.visibility,
    );
    return NextResponse.json({ visibility });
  } catch (error) {
    return mapRouteError(error);
  }
}
