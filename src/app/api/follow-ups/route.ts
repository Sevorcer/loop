import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listFollowUps } from "@/services/jobFollowUps";

/** Open follow-ups for the worklist (Jobs board chip, dashboard card). */
export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const items = await listFollowUps();
    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    return mapRouteError(error);
  }
}
