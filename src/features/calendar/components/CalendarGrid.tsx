"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { Job } from "@/features/jobs/types/job";
import {
  getCalendarMonthGrid,
  getTodayDate,
} from "@/features/daily-plans/utils/planUtils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Job type colors (feedback: color-code Service vs Install on calendar) ───

export const JOB_TYPE_DOT: Record<string, string> = {
  Install: "bg-blue-400",
  Service: "bg-emerald-400",
  Maintenance: "bg-amber-400",
  Inspection: "bg-violet-400",
  Estimate: "bg-slate-400",
  Callback: "bg-rose-400",
};

const JOB_TYPE_LEGEND = [
  "Install",
  "Service",
  "Maintenance",
  "Inspection",
  "Estimate",
  "Callback",
] as const;

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

  // Group jobs by date (only jobs that actually have scheduledFor set).
  const jobsByDate: Record<string, Job[]> = {};
  const unassignedCountByDate: Record<string, number> = {};

  for (const job of scheduledJobs) {
    // Guard: scheduledFor must be non-null (caller should filter, but be safe)
    if (!job.scheduledFor) continue;

    if (!jobsByDate[job.scheduledFor]) {
      jobsByDate[job.scheduledFor] = [];
    }
    jobsByDate[job.scheduledFor].push(job);

    if (!job.assignedTo.trim()) {
      unassignedCountByDate[job.scheduledFor] =
        (unassignedCountByDate[job.scheduledFor] ?? 0) + 1;
    }
  }

  // Earliest first inside each day cell.
  for (const date of Object.keys(jobsByDate)) {
    jobsByDate[date].sort((a, b) =>
      (a.scheduledStartAt ?? "").localeCompare(b.scheduledStartAt ?? ""),
    );
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

      {/* Type legend */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {JOB_TYPE_LEGEND.map((type) => (
          <span
            key={type}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400"
          >
            <span
              className={`h-2 w-2 rounded-full ${JOB_TYPE_DOT[type] ?? "bg-slate-400"}`}
            />
            {type}
          </span>
        ))}
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
                return <div key={di} className="h-24 rounded-xl sm:h-28" />;
              }

              const dayJobs = jobsByDate[date] ?? [];
              const jobCount = dayJobs.length;
              const visibleJobs = dayJobs.slice(0, 2);
              const overflowCount = jobCount - visibleJobs.length;
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
                    "relative flex h-24 flex-col overflow-hidden rounded-xl border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 sm:h-28",
                    isSelected
                      ? "border-blue-500/40 bg-blue-500/10"
                      : isToday
                        ? "border-blue-500/20 bg-blue-500/[0.06] hover:bg-blue-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]",
                    isPast && !isSelected && !isToday ? "opacity-50" : "",
                  ].join(" ")}
                  aria-label={`${date}${jobCount > 0 ? `: ${dayJobs.map((job) => `${job.customerName} – ${job.title}`).join("; ")}` : ""}`}
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

                  {/* Jobs: customer name + brief description, color-coded by type */}
                  {visibleJobs.map((job) => (
                    <span
                      key={job.id}
                      className="mt-1.5 flex items-start gap-1 text-[10px] leading-snug"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${JOB_TYPE_DOT[job.type] ?? "bg-slate-400"}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-100">
                          {job.customerName}
                        </span>
                        <span className="block truncate text-slate-400">
                          {job.title}
                        </span>
                      </span>
                    </span>
                  ))}

                  {overflowCount > 0 && (
                    <span className="mt-1 text-[9px] font-medium text-slate-500">
                      +{overflowCount} more
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
