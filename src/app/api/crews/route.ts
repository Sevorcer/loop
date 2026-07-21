/**
 * Crews API — read-only list.
 *
 * GET /api/crews — list all crews for the caller's org.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listCrews } from "@/repositories/dispatch";

export async function GET(request: Request) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const result = await listCrews();
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.code, message: result.error.message },
        { status: 503 }
      );
    }
    return NextResponse.json({ crews: result.data });
  } catch (error) {
    return mapRouteError(error);
  }
}
