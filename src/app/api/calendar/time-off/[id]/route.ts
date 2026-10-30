import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { removeTimeOff, saveTimeOff } from "@/services/calendarEntries";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "time_off", "update");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  try {
    const body = await readJsonObject(request);
    await saveTimeOff(guard.ctx.role, {
      id,
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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "time_off", "delete");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  try {
    await removeTimeOff(guard.ctx.role, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
