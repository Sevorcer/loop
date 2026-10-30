"use client";

import { useEffect, useState } from "react";

import { requestJson } from "@/lib/api/client";
import { parseDatetimeLocalInput } from "@/features/jobs/utils/schedulingTime";

import type { TimeOffEntry } from "../types/calendarEntries";
import { timeOffCovering } from "../utils/calendarEntries";

/**
 * Shown while assigning a person to a job. Dispatch crew assignment is separate
 * and does not use this warning, because a crew is not a single user.
 */
export function AssignmentTimeOffWarning({
  assigneeIds,
  scheduledStartAt,
  scheduledEndAt,
}: {
  assigneeIds: string[];
  scheduledStartAt: string;
  scheduledEndAt: string;
}) {
  const [timeOff, setTimeOff] = useState<TimeOffEntry[]>([]);

  useEffect(() => {
    if (assigneeIds.length === 0 || !scheduledStartAt) return;
    let cancelled = false;
    void requestJson<{ timeOff: TimeOffEntry[] }>("/api/calendar", { cache: "no-store" })
      .then((data) => {
        if (!cancelled) setTimeOff(data.timeOff);
      })
      .catch(() => {
        if (!cancelled) setTimeOff([]);
      });
    return () => {
      cancelled = true;
    };
  }, [assigneeIds.length, scheduledStartAt]);

  const startIso = parseDatetimeLocalInput(scheduledStartAt);
  const endIso = parseDatetimeLocalInput(scheduledEndAt);
  const conflicts = timeOffCovering(timeOff, assigneeIds, startIso, endIso);
  if (conflicts.length === 0) return null;

  const names = Array.from(new Set(conflicts.map((entry) => `${entry.personName} (${entry.reason})`)));
  return (
    <p className="text-xs text-yellow-300" role="status">
      Off during this appointment: {names.join("; ")}.
    </p>
  );
}
