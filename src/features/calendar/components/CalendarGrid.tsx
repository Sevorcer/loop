"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { Job } from "@/features/jobs/types/job";
import {
  getCalendarMonthGrid,
  getTodayDate,
} from "@/features/daily-plans/utils/planUtils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface CalendarGridProps {
  /** 0-indexed month (0 = January). */
  month: number;
  year: number;
  /**
   * Jobs with a `scheduled_for` date set.
   * Unscheduled jobs (scheduledFor === null) must be excluded by the caller.
   */
  scheduledJobs: Job[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarGrid({
  month,
  year,
  scheduledJobs,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarGridProps) {
  const today = getTodayDate();
  const weeks = getCalendarMonthGrid(year, month);

  // Build lookup maps — only from jobs that actually have scheduledFor set.
  const jobCountByDate: Record<string, number> = {};
  const unassignedCountByDate: Record<string, number> = {};

  for (const job of scheduledJobs) {
    // Guard: scheduledFor must be non-null (caller should filter, but be safe)
    if (!job.scheduledFor) continue;
    jobCountByDate[job.scheduledFor] = (jobCountByDate[job.scheduledFor] ?? 0) + 1;
    if (!job.assignedTo.trim()) {
      unassignedCountByDate[job.scheduledFor] =
        (unassignedCountByDate[job.scheduledFor] ?? 0) + 1;
    }
  }

  const viewingCurrentMonth =
    today.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">
          {MONTH_NAMES[month]} {year}
        </h2>

        <div className="flex items-center gap-1.5">
          {!viewingCurrentMonth && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToday}
              className="h-8 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-300 hover:bg-white/10"
            >
              Today
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevMonth}
            aria-label="Previous month"
            className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNextMonth}
            aria-label="Next month"
            className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((date, di) => {
              if (date === null) {
                return <div key={di} className="h-16 rounded-xl" />;
              }

              const jobCount = jobCountByDate[date] ?? 0;
              const unassignedCount = unassignedCountByDate[date] ?? 0;
              const isSelected = date === selectedDate;
              const isToday = date === today;
              const isPast = date < today;

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => onSelectDate(date)}
                  className={[
                    "relative flex h-16 flex-col rounded-xl border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70",
                    isSelected
                      ? "border-blue-500/40 bg-blue-500/10"
                      : isToday
                        ? "border-blue-500/20 bg-blue-500/[0.06] hover:bg-blue-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]",
                    isPast && !isSelected && !isToday ? "opacity-50" : "",
                  ].join(" ")}
                  aria-label={`${date}${jobCount > 0 ? `, ${jobCount} job${jobCount !== 1 ? "s" : ""}` : ""}`}
                  aria-pressed={isSelected}
                >
                  {/* Date number */}
                  <span
                    className={[
                      "text-xs font-semibold leading-none",
                      isToday
                        ? "text-blue-300"
                        : isSelected
                          ? "text-white"
                          : "text-slate-400",
                    ].join(" ")}
                  >
                    {parseInt(date.split("-")[2], 10)}
                  </span>

                  {/* Job count */}
                  {jobCount > 0 && (
                    <span className="mt-1 text-[10px] font-medium text-slate-300">
                      {jobCount} job{jobCount !== 1 ? "s" : ""}
                    </span>
                  )}

                  {/* Unassigned indicator dot */}
                  {unassignedCount > 0 && (
                    <span
                      aria-label={`${unassignedCount} unassigned`}
                      className="mt-auto inline-flex items-center gap-1 text-[9px] font-medium text-yellow-400"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                      {unassignedCount} unassigned
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
