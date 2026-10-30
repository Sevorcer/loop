import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listCalendarSchedule } from "@/services/calendarEntries";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "time_off", "select");
  if (!guard.ok) return guard.response;

  try {
    const schedule = await listCalendarSchedule();
    return NextResponse.json(schedule);
  } catch (error) {
    return mapRouteError(error);
  }
}
