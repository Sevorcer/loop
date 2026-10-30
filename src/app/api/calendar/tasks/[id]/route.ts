import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { canManageCalendarEntries } from "@/features/calendar/types/calendarEntries";
import { markCalendarTaskDone, removeCalendarTask, saveCalendarTask } from "@/services/calendarEntries";

import { taskBody } from "../route";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "calendar_tasks", "update");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  try {
    const body = await readJsonObject(request);
    if (!canManageCalendarEntries(guard.ctx.role)) {
      await markCalendarTaskDone(guard.ctx.role, id, body.done !== false);
      return NextResponse.json({ ok: true });
    }
    await saveCalendarTask(guard.ctx.role, { id, ...taskBody(body) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "calendar_tasks", "delete");
  if (!guard.ok) return guard.response;
  const { id } = await context.params;

  try {
    await removeCalendarTask(guard.ctx.role, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
