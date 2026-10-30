import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { saveTimeOff } from "@/services/calendarEntries";

export async function POST(request: Request) {
  const guard = await requirePermission(request, "time_off", "insert");
  if (!guard.ok) return guard.response;

  try {
    const body = await readJsonObject(request);
    await saveTimeOff(guard.ctx.role, {
      userId: String(body.userId ?? ""),
      allDay: body.allDay === true,
      start: String(body.start ?? ""),
      end: String(body.end ?? ""),
      reason: String(body.reason ?? ""),
      note: typeof body.note === "string" ? body.note : "",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
