"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { ROUTE_BUILDERS } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Job, JobType } from "@/features/jobs/types/job";

import { calendarJobCardTone } from "../utils/calendarJobCardTone";
import {
  calendarJobHeading,
  calendarJobSubtitle,
  calendarTechLabel,
  formatCalendarTimeRange,
} from "../utils/calendarSchedule";

/** Same hues the calendar legend already uses for job type. */
export const JOB_TYPE_DOT: Record<JobType, string> = {
  Install: "bg-blue-400",
  Service: "bg-emerald-400",
  Maintenance: "bg-amber-400",
  Inspection: "bg-violet-400",
  Estimate: "bg-slate-400",
  Callback: "bg-rose-400",
};

/** Statuses that must not be draggable. */
const NON_DRAGGABLE_STATUSES = new Set(["Completed", "Cancelled"]);

export function CalendarJobCard({
  job,
  onDate,
  density,
  canDrag = false,
}: {
  job: Job;
  onDate: string;
  density: "compact" | "comfortable";
  /** Whether this card should be draggable for rescheduling. */
  canDrag?: boolean;
}) {
  const time = formatCalendarTimeRange(job, onDate);
  const heading = calendarJobHeading(job);
  const subtitle = calendarJobSubtitle(job);
  const techs = calendarTechLabel(job);
  const comfortable = density === "comfortable";

  const isDraggable = canDrag && !NON_DRAGGABLE_STATUSES.has(job.status);

  // Track whether the pointer actually moved — if it did, suppress the
  // click-through to the link so the browser's drag visual takes over
  // and the user doesn't accidentally navigate.
  const didDragRef = useRef(false);

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLAnchorElement>) => {
      if (!isDraggable) {
        event.preventDefault();
        return;
      }
      didDragRef.current = false;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "application/x-loop-calendar-job",
        JSON.stringify({ jobId: job.id, grabDay: onDate }),
      );
    },
    [isDraggable, job.id, onDate],
  );

  const handleDrag = useCallback(() => {
    didDragRef.current = true;
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (didDragRef.current) {
        event.preventDefault();
      }
    },
    [],
  );

  return (
    <Link
      href={ROUTE_BUILDERS.JOB_DETAIL(job.id)}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onClick={handleClick}
      className={cn(
        "calendar-card block w-full min-w-0 rounded-lg border border-l-4 text-left transition-colors",
        "hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
        comfortable ? "px-2.5 py-2" : "px-1.5 py-1",
        isDraggable && "cursor-grab active:cursor-grabbing",
        calendarJobCardTone(job),
      )}
      aria-label={`${time}. ${heading}${subtitle ? `. ${subtitle}` : ""}. ${techs}. Open job.`}
    >
      <span
        className={cn(
          "block whitespace-normal break-words leading-snug text-muted",
          comfortable ? "text-xs" : "text-[11px]",
        )}
      >
        {time}
      </span>
      <span
        className={cn(
          "mt-0.5 block whitespace-normal break-words font-semibold leading-snug text-foreground",
          comfortable ? "text-sm" : "text-xs",
        )}
      >
        {heading}
      </span>
      {subtitle ? (
        <span
          className={cn(
            "block whitespace-normal break-words leading-snug text-foreground",
            comfortable ? "text-xs" : "text-[11px]",
          )}
        >
          {subtitle}
        </span>
      ) : null}
      <span
        className={cn(
          "mt-0.5 block whitespace-normal break-words leading-snug text-muted",
          comfortable ? "text-xs" : "text-[11px]",
        )}
      >
        {techs}
      </span>
      {job.status === "Completed" ? (
        <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Completed
        </span>
      ) : job.status !== "Scheduled" ? (
        <span className="mt-0.5 block whitespace-normal break-words text-[10px] font-medium uppercase tracking-wide text-muted">
          {job.status}
        </span>
      ) : null}
    </Link>
  );
}
