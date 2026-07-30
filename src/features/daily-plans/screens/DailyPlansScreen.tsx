"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleAlert, Sun } from "lucide-react";

import { PageHeader } from "@/components/atlas";
import { useJobs } from "@/features/jobs/state/JobsProvider";

import { CrewStatusPanel } from "../components/CrewStatusPanel";
import { MorningBriefing } from "../components/MorningBriefing";
import { NeedsAttentionPanel } from "../components/NeedsAttentionPanel";
import { ScheduleSection } from "../components/ScheduleSection";
import { getCrewProfilesForDate } from "../data/morningOperations";
import {
  getAllUnscheduledJobs,
  buildPlannedJob,
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

  const today = getTodayDate();

  const todayJobs = useMemo(() => getScheduledTodayJobs(jobs), [jobs]);
  const upcomingJobs = useMemo(() => getUpcomingJobs(jobs), [jobs]);
  const unscheduledJobs = useMemo(() => getAllUnscheduledJobs(jobs), [jobs]);

  // Use today's crew roster for all sections — the roster is relatively stable.
  const crewOptions = useMemo(() => getCrewProfilesForDate(today), [today]);

  // ── Morning Briefing KPI metrics ──────────────────────────────────────────

  const assigned = useMemo(
    () => todayJobs.filter((j) => j.assignedTo.trim()).length,
    [todayJobs]
  );

  const unassigned = useMemo(
    () => todayJobs.filter((j) => !j.assignedTo.trim()).length,
    [todayJobs]
  );

  /** At-risk: On Hold or overdue (scheduled before today, not completed/cancelled). */
  const atRisk = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.status === "On Hold" ||
          (j.scheduledFor != null &&
            j.scheduledFor < today &&
            j.status !== "Completed" &&
            j.status !== "Cancelled")
      ).length,
    [jobs, today]
  );

  /**
   * Permit-waiting: today's jobs that require a permit and don't yet have it
   * approved. Derived via buildPlannedJob which reads the planning mock data.
   */
  const waitingPermit = useMemo(() => {
    return todayJobs.filter((job) => {
      const planned = buildPlannedJob(job);
      if (!planned.planning.permitRequired) return false;
      const permitCheck = planned.planning.readinessChecks.find((c) =>
        c.label.toLowerCase().includes("permit")
      );
      return permitCheck ? !permitCheck.ready : true;
    }).length;
  }, [todayJobs]);

  /** Active crews: available, late arrival, or half-day (not vacation/sick/training). */
  const activeCrews = useMemo(
    () =>
      crewOptions.filter(
        (c) =>
          c.availability !== "vacation" &&
          c.availability !== "sick" &&
          c.availability !== "training"
      ).length,
    [crewOptions]
  );

  /** Job count per technician name for CrewStatusPanel. */
  const jobCountByTechnician = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of todayJobs) {
      if (job.assignedTo.trim()) {
        counts[job.assignedTo] = (counts[job.assignedTo] ?? 0) + 1;
      }
    }
    return counts;
  }, [todayJobs]);

  // ── Jobs that need attention come from all scheduled+unscheduled jobs ─────
  const attentionSourceJobs = useMemo(
    () => [...todayJobs, ...unscheduledJobs],
    [todayJobs, unscheduledJobs]
  );

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
        description="Morning coordination view — today's jobs, crew status, and items needing action."
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
          {/* ── Morning Briefing (read-first ops summary) ───────────────────── */}
          <MorningBriefing
            date={today}
            totalToday={todayJobs.length}
            assigned={assigned}
            unassigned={unassigned}
            atRisk={atRisk}
            waitingPermit={waitingPermit}
            activeCrews={activeCrews}
          />

          {/* ── Needs Attention ─────────────────────────────────────────────── */}
          <NeedsAttentionPanel jobs={attentionSourceJobs} />

          {/* ── Crew Status ─────────────────────────────────────────────────── */}
          <CrewStatusPanel
            crews={crewOptions}
            jobCountByTechnician={jobCountByTechnician}
          />

          {/* ── Schedule sections ───────────────────────────────────────────── */}
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

