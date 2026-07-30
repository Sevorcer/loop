import type { LucideIcon } from "lucide-react";

import type { CrewProfile } from "../types/dailyPlan";
import type { Job } from "@/features/jobs/types/job";
import { formatDateShort } from "../utils/planUtils";
import { JobScheduleCard } from "./JobScheduleCard";

// ─── Empty state ──────────────────────────────────────────────────────────────

function SectionEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 px-6 py-8 text-center">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

// ─── Date subheading (used inside Upcoming) ───────────────────────────────────

function DateSubheading({ date, count }: { date: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-1 pt-3">
      <p className="text-xs font-semibold text-slate-400">{formatDateShort(date)}</p>
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-500">
        {count} job{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ScheduleSectionProps {
  title: string;
  icon: LucideIcon;
  jobs: Job[];
  emptyMessage: string;
  crewOptions: CrewProfile[];
  onReschedule: (jobId: string, date: string) => void;
  onAssign: (jobId: string, technician: string) => void;
  /**
   * When true, jobs are grouped by their scheduledFor date.
   * Used for the Upcoming section.
   */
  groupByDate?: boolean;
  /**
   * When true, cards render in "Unscheduled" mode (Schedule instead of Reschedule).
   */
  isUnscheduled?: boolean;
}

export function ScheduleSection({
  title,
  icon: Icon,
  jobs,
  emptyMessage,
  crewOptions,
  onReschedule,
  onAssign,
  groupByDate = false,
  isUnscheduled = false,
}: ScheduleSectionProps) {
  return (
    <section aria-label={title}>
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
          {title}
        </h2>
        <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-500">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Body */}
      {jobs.length === 0 ? (
        <SectionEmptyState message={emptyMessage} />
      ) : groupByDate ? (
        // Group by date for Upcoming
        <UpcomingJobList
          jobs={jobs}
          crewOptions={crewOptions}
          onReschedule={onReschedule}
          onAssign={onAssign}
        />
      ) : (
        // Flat list for Today and Unscheduled
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobScheduleCard
              key={job.id}
              job={job}
              crewOptions={crewOptions}
              onReschedule={onReschedule}
              onAssign={onAssign}
              isUnscheduled={isUnscheduled}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Upcoming grouped list ────────────────────────────────────────────────────

interface UpcomingJobListProps {
  jobs: Job[];
  crewOptions: CrewProfile[];
  onReschedule: (jobId: string, date: string) => void;
  onAssign: (jobId: string, technician: string) => void;
}

function UpcomingJobList({
  jobs,
  crewOptions,
  onReschedule,
  onAssign,
}: UpcomingJobListProps) {
  // Group jobs by scheduledFor date (already sorted ascending by planUtils)
  const groups = jobs.reduce<Record<string, Job[]>>((acc, job) => {
    const key = job.scheduledFor ?? "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});

  const dates = Object.keys(groups).sort();

  return (
    <div className="space-y-1">
      {dates.map((date) => {
        const dateJobs = groups[date];
        return (
          <div key={date}>
            <DateSubheading date={date} count={dateJobs.length} />
            <div className="space-y-3">
              {dateJobs.map((job) => (
                <JobScheduleCard
                  key={job.id}
                  job={job}
                  crewOptions={crewOptions}
                  onReschedule={onReschedule}
                  onAssign={onAssign}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
