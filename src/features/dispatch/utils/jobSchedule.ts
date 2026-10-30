import type { JobStatus } from "@/features/jobs/types/job";
import { hoursBetweenIso, companyTimeOfDay } from "@/lib/timezone";

import type { DispatchStatus } from "../types/dispatch";

/**
 * Map a job's execution status onto the dispatch board.
 * A dated scheduled job is on the board, not sitting in Ready to Schedule.
 */
export function dispatchStatusForJob(
  status: JobStatus,
  hasDate: boolean,
  current: DispatchStatus | null = null,
): DispatchStatus {
  if (status === "Completed") return "completed";
  if (status === "Cancelled") return "cancelled";
  if (status === "In Progress") return "in_progress";
  if (status === "On Hold") return "on_hold";
  if (status === "Scheduled" && hasDate) {
    if (current?.startsWith("awaiting_")) return current;
    return "scheduled";
  }
  return current ?? "ready_to_schedule";
}

export function scheduledWindowHours(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  fallback = 4,
): number {
  return hoursBetweenIso(startIso, endIso) ?? fallback;
}

export function scheduledWindowClock(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): { start: string; end: string } {
  const start = companyTimeOfDay(startIso) ?? "07:00";
  const end = companyTimeOfDay(endIso);
  if (end && end > start) return { start, end };
  if (end && startIso && endIso && new Date(endIso).getTime() > new Date(startIso).getTime()) {
    return { start, end };
  }
  return { start, end: end && end !== start ? end : "16:00" };
}
