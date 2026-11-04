import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listCalendarSchedule } from "@/services/calendarEntries";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Validate a YYYY-MM-DD string, rejecting impossible dates like 2026-02-31. */
function isDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "time_off", "select");
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  // When both from and to are provided, scope the query to that date window.
  // If only one is supplied, ignore the partial pair and fetch everything
  // (backwards-compatible with clients that send no params).
  const dateRange =
    from && to && isDateOnly(from) && isDateOnly(to) && from <= to
      ? { from, to }
      : undefined;

  try {
    const schedule = await listCalendarSchedule(dateRange);
    return NextResponse.json(schedule);
  } catch (error) {
    return mapRouteError(error);
  }
}
