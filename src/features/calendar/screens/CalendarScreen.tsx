"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarRange, ListFilter } from "lucide-react";

import { PageHeader } from "@/components/atlas";
import { useJobs } from "@/features/jobs/state/JobsProvider";

import { CalendarGrid } from "../components/CalendarGrid";
import type { Job } from "@/features/jobs/types/job";
import { StatusBadge } from "@/components/atlas";
import Link from "next/link";
import { ArrowRight, UserCircle2 } from "lucide-react";
import {
  formatDateShort,
  getDayLabel,
  getJobsForDate,
  getTodayDate,
} from "@/features/daily-plans/utils/planUtils";

// ─── Day panel ────────────────────────────────────────────────────────────────

function DayPanel({
  selectedDate,
  jobs,
}: {
  selectedDate: string;
  jobs: Job[];
}) {
  const label = getDayLabel(selectedDate);
  const dateDisplay = formatDateShort(selectedDate);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="text-sm font-semibold text-white">{dateDisplay}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
          <ListFilter className="mx-auto mb-2 h-5 w-5 text-slate-600" />
          <p className="text-sm text-slate-500">No jobs scheduled for this date.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-500">{job.jobNumber}</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-white">
                    {job.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {job.customerName} · {job.propertyName}
                  </p>
                </div>
                <Link
                  href={`/jobs/${job.id}`}
                  aria-label={`Open ${job.jobNumber}`}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  variant={
                    job.status === "Completed"
                      ? "success"
                      : job.status === "Scheduled"
                        ? "info"
                        : job.status === "In Progress"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {job.status}
                </StatusBadge>
                <StatusBadge
                  variant={
                    job.priority === "High"
                      ? "danger"
                      : job.priority === "Medium"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {job.priority}
                </StatusBadge>

                {job.assignedTo.trim() ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300">
                    <UserCircle2 className="h-3 w-3 text-slate-400" />
                    {job.assignedTo}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-300">
                    <UserCircle2 className="h-3 w-3" />
                    Unassigned
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function CalendarScreen() {
  const { hydrated, jobs } = useJobs();

  const today = getTodayDate();
  const todayDate = new Date(today + "T00:00:00");

  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState(today);

  // Only plot jobs with a scheduled_for date — unscheduled stay in Daily Plans.
  const scheduledJobs = useMemo(
    () => jobs.filter((job) => job.scheduledFor != null),
    [jobs]
  );

  const dayJobs = useMemo(
    () => getJobsForDate(jobs, selectedDate),
    [jobs, selectedDate]
  );

  const handlePrevMonth = useCallback(() => {
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const handleToday = useCallback(() => {
    const d = new Date(getTodayDate() + "T00:00:00");
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelectedDate(getTodayDate());
  }, []);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="See scheduled jobs by date. Unscheduled jobs are managed in Daily Plans."
      />

      {!hydrated ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          Loading calendar…
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          {/* Calendar grid */}
          <CalendarGrid
            month={month}
            year={year}
            scheduledJobs={scheduledJobs}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
          />

          {/* Day panel */}
          <DayPanel selectedDate={selectedDate} jobs={dayJobs} />
        </div>
      )}

      {/* Unscheduled jobs reminder */}
      {hydrated && jobs.some((j) => j.scheduledFor == null) && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <CalendarRange className="h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-xs text-slate-400">
            Jobs without a scheduled date are not plotted on the calendar. Manage
            them from{" "}
            <Link href="/daily-plans" className="text-blue-400 hover:underline">
              Daily Plans → Unscheduled
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
