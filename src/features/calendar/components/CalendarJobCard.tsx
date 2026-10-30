"use client";

import Link from "next/link";

import { ROUTE_BUILDERS } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Job, JobType } from "@/features/jobs/types/job";

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

const JOB_TYPE_CARD: Record<JobType, string> = {
  Install: "border-blue-400/40 border-l-blue-400 bg-blue-500/15",
  Service: "border-emerald-400/40 border-l-emerald-400 bg-emerald-500/15",
  Maintenance: "border-amber-400/40 border-l-amber-400 bg-amber-500/15",
  Inspection: "border-violet-400/40 border-l-violet-400 bg-violet-500/15",
  Estimate: "border-slate-400/40 border-l-slate-400 bg-slate-500/15",
  Callback: "border-rose-400/40 border-l-rose-400 bg-rose-500/15",
};

export function CalendarJobCard({
  job,
  onDate,
  density,
}: {
  job: Job;
  onDate: string;
  density: "compact" | "comfortable";
}) {
  const time = formatCalendarTimeRange(job, onDate);
  const heading = calendarJobHeading(job);
  const subtitle = calendarJobSubtitle(job);
  const techs = calendarTechLabel(job);
  const comfortable = density === "comfortable";

  return (
    <Link
      href={ROUTE_BUILDERS.JOB_DETAIL(job.id)}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "calendar-card block w-full min-w-0 rounded-lg border border-l-4 text-left transition-colors",
        "hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
        comfortable ? "px-2.5 py-2" : "px-1.5 py-1",
        JOB_TYPE_CARD[job.type] ?? "border-white/15 border-l-slate-400 bg-white/[0.04]",
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
      {job.status !== "Scheduled" ? (
        <span className="mt-0.5 block whitespace-normal break-words text-[10px] font-medium uppercase tracking-wide text-muted">
          {job.status}
        </span>
      ) : null}
    </Link>
  );
}
