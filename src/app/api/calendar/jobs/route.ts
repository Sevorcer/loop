import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { listJobsForCalendar } from "@/services/jobs";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Widest range the calendar can ask for (a year view worth of days). */
const MAX_RANGE_DAYS = 366;

/** Strict YYYY-MM-DD check — rejects impossible dates like 2026-02-31. */
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
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  if (!isDateOnly(from) || !isDateOnly(to) || from > to) {
    return createApiErrorResponse(
      "VALIDATION_ERROR",
      "Query parameters 'from' and 'to' must be valid YYYY-MM-DD dates, with 'from' on or before 'to'.",
      400,
    );
  }

  const rangeDays =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return createApiErrorResponse(
      "VALIDATION_ERROR",
      `Date range is too wide. Ask for at most ${MAX_RANGE_DAYS} days at a time.`,
      400,
    );
  }

  try {
    const result = await listJobsForCalendar(from, to);
    return NextResponse.json(result);
  } catch (error) {
    return mapRouteError(error);
  }
}
