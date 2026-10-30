import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { removeSharedCalendarGroup, saveSharedCalendarGroup } from "@/services/calendarGroups";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "calendar_saved_groups", "update");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const group = await saveSharedCalendarGroup(guard.ctx.role, {
      id,
      name: String(body.name ?? ""),
      personIds: Array.isArray(body.personIds)
        ? body.personIds.filter((item): item is string => typeof item === "string")
        : [],
    });
    return NextResponse.json({ group });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "calendar_saved_groups", "delete");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await context.params;
    await removeSharedCalendarGroup(guard.ctx.role, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
