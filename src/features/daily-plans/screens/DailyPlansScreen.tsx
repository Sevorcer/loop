"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleAlert, Sun } from "lucide-react";

import { PageHeader } from "@/components/atlas";
import { useJobs } from "@/features/jobs/state/JobsProvider";

import { ScheduleSection } from "../components/ScheduleSection";
import { getCrewProfilesForDate } from "../data/morningOperations";
import {
  getAllUnscheduledJobs,
  getScheduledTodayJobs,
  getTodayDate,
  getUpcomingJobs,
  formatDateShort,
} from "../utils/planUtils";

export function DailyPlansScreen() {
  const { hydrated, jobs, updateJob } = useJobs();
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!actionNotice) return;
    const timeout = window.setTimeout(() => setActionNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [actionNotice]);

  const todayJobs = useMemo(() => getScheduledTodayJobs(jobs), [jobs]);
  const upcomingJobs = useMemo(() => getUpcomingJobs(jobs), [jobs]);
  const unscheduledJobs = useMemo(() => getAllUnscheduledJobs(jobs), [jobs]);

  // Use today's crew roster for all sections — the roster is relatively stable.
  const crewOptions = useMemo(() => getCrewProfilesForDate(getTodayDate()), []);

  const handleReschedule = useCallback(
    (jobId: string, date: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;
      updateJob(jobId, { ...job, scheduledFor: date });
      setActionNotice(`${job.jobNumber} rescheduled to ${formatDateShort(date)}.`);
    },
    [jobs, updateJob]
  );

  const handleAssign = useCallback(
    (jobId: string, technician: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job || job.assignedTo === technician) return;
      updateJob(jobId, { ...job, assignedTo: technician });
      setActionNotice(
        technician
          ? `${job.jobNumber} assigned to ${technician}.`
          : `${job.jobNumber} moved to unassigned.`
      );
    },
    [jobs, updateJob]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Plans"
        description="Review and act on jobs by schedule state — Today, Upcoming, and Unscheduled."
      />

      {actionNotice ? (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.08] px-4 py-3 text-sm text-blue-100">
          {actionNotice}
        </div>
      ) : null}

      {!hydrated ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          Loading plan…
        </div>
      ) : (
        <div className="space-y-8">
          <ScheduleSection
            title="Today"
            icon={Sun}
            jobs={todayJobs}
            emptyMessage="No jobs scheduled for today."
            crewOptions={crewOptions}
            onReschedule={handleReschedule}
            onAssign={handleAssign}
          />

          <ScheduleSection
            title="Upcoming"
            icon={CalendarDays}
            jobs={upcomingJobs}
            emptyMessage="No upcoming jobs scheduled."
            crewOptions={crewOptions}
            onReschedule={handleReschedule}
            onAssign={handleAssign}
            groupByDate
          />

          <ScheduleSection
            title="Unscheduled"
            icon={CircleAlert}
            jobs={unscheduledJobs}
            emptyMessage="All jobs have been scheduled — nothing in the backlog."
            crewOptions={crewOptions}
            onReschedule={handleReschedule}
            onAssign={handleAssign}
            isUnscheduled
          />
        </div>
      )}
    </div>
  );
}

