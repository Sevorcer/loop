"use client";

import { cn } from "@/lib/utils";

import type { CalendarTaskEntry, TimeOffEntry } from "../types/calendarEntries";
import { formatEntryTime, taskAssigneeLabel } from "../utils/calendarEntries";

export function TimeOffCard({
  entry,
  onDate,
  density,
  onOpen,
}: {
  entry: TimeOffEntry;
  onDate: string;
  density: "compact" | "comfortable";
  onOpen: (entry: TimeOffEntry) => void;
}) {
  const comfortable = density === "comfortable";
  const time = formatEntryTime(entry, onDate);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(entry);
      }}
      className={cn(
        "calendar-card calendar-time-off block w-full min-w-0 rounded-lg border text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
        comfortable ? "px-2.5 py-2" : "px-1.5 py-1",
      )}
      aria-label={`Time off. ${entry.personName}. ${entry.reason}. ${time}.`}
    >
      <span className={cn("block break-words font-semibold uppercase tracking-wide text-muted", comfortable ? "text-[11px]" : "text-[10px]")}>
        Time Off
      </span>
      <span className={cn("mt-0.5 block break-words leading-snug text-muted", comfortable ? "text-xs" : "text-[11px]")}>
        {time}
      </span>
      <span className={cn("mt-0.5 block break-words font-semibold leading-snug text-foreground", comfortable ? "text-sm" : "text-xs")}>
        {entry.personName}
      </span>
      <span className={cn("block break-words leading-snug text-foreground", comfortable ? "text-xs" : "text-[11px]")}>
        {entry.reason}
      </span>
    </button>
  );
}

export function TaskCard({
  entry,
  onDate,
  density,
  onOpen,
}: {
  entry: CalendarTaskEntry;
  onDate: string;
  density: "compact" | "comfortable";
  onOpen: (entry: CalendarTaskEntry) => void;
}) {
  const comfortable = density === "comfortable";
  const time = formatEntryTime(entry, onDate);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(entry);
      }}
      className={cn(
        "calendar-card calendar-task block w-full min-w-0 rounded-lg border text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
        entry.doneAt ? "opacity-70" : "",
        comfortable ? "px-2.5 py-2" : "px-1.5 py-1",
      )}
      aria-label={`Task. ${entry.title}. ${taskAssigneeLabel(entry)}. ${time}.`}
    >
      <span className={cn("block break-words font-semibold uppercase tracking-wide text-muted", comfortable ? "text-[11px]" : "text-[10px]")}>
        Task{entry.doneAt ? " · Done" : ""}
      </span>
      <span className={cn("mt-0.5 block break-words leading-snug text-muted", comfortable ? "text-xs" : "text-[11px]")}>
        {time}
      </span>
      <span className={cn("mt-0.5 block break-words font-semibold leading-snug text-foreground", comfortable ? "text-sm" : "text-xs")}>
        {entry.title}
      </span>
      <span className={cn("block break-words leading-snug text-foreground", comfortable ? "text-xs" : "text-[11px]")}>
        {taskAssigneeLabel(entry)}
      </span>
    </button>
  );
}
