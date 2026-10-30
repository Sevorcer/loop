import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { listSharedCalendarGroups, saveSharedCalendarGroup } from "@/services/calendarGroups";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "calendar_saved_groups", "select");
  if (!guard.ok) return guard.response;

  try {
    const groups = await listSharedCalendarGroups(guard.ctx.role);
    return NextResponse.json({ groups });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "calendar_saved_groups", "insert");
  if (!guard.ok) return guard.response;

  try {
    const body = await readJsonObject(request);
    const group = await saveSharedCalendarGroup(guard.ctx.role, {
      name: String(body.name ?? ""),
      personIds: stringList(body.personIds),
    });
    return NextResponse.json({ group });
  } catch (error) {
    return mapRouteError(error);
  }
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
