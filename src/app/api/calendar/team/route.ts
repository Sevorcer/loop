import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listTeamForCalendar } from "@/services/calendarEntries";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "time_off", "insert");
  if (!guard.ok) return guard.response;

  try {
    const team = await listTeamForCalendar();
    return NextResponse.json({ team });
  } catch (error) {
    return mapRouteError(error);
  }
}
