/**
 * Schedule blocks API.
 *
 * GET /api/schedule-blocks — list all schedule blocks for the caller's org.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRepositoryError, mapRouteError } from "@/lib/api/routeErrors";
import { listScheduleBlocks } from "@/repositories/dispatch";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const result = await listScheduleBlocks();
    if (!result.ok) {
      return mapRepositoryError(result.error);
    }
    return NextResponse.json({ scheduleBlocks: result.data });
  } catch (error) {
    return mapRouteError(error);
  }
}
