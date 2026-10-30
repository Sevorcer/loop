import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { saveCalendarTask } from "@/services/calendarEntries";

export async function POST(request: Request) {
  const guard = await requirePermission(request, "calendar_tasks", "insert");
  if (!guard.ok) return guard.response;

  try {
    const body = await readJsonObject(request);
    await saveCalendarTask(guard.ctx.role, taskBody(body));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}

export function taskBody(body: Record<string, unknown>) {
  const assigneeIds = Array.isArray(body.assigneeIds)
    ? body.assigneeIds.filter((id): id is string => typeof id === "string")
    : [];
  return {
    title: String(body.title ?? ""),
    description: typeof body.description === "string" ? body.description : "",
    allDay: body.allDay === true,
    start: String(body.start ?? ""),
    end: String(body.end ?? ""),
    assignEveryone: body.assignEveryone === true,
    assigneeIds,
    jobNumber: typeof body.jobNumber === "string" ? body.jobNumber : "",
    customerName: typeof body.customerName === "string" ? body.customerName : "",
    done: body.done === true,
  };
}
