"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleAlert, Sun } from "lucide-react";

import { PageHeader } from "@/components/atlas";
import { useCurrentRole } from "@/features/auth";
import { useJobsList } from "@/features/jobs/state/JobsProvider";
import { requestJson } from "@/lib/api/client";

import { CrewStatusPanel } from "../components/CrewStatusPanel";
import { MorningBriefing } from "../components/MorningBriefing";
import { NeedsAttentionPanel } from "../components/NeedsAttentionPanel";
import { ScheduleSection } from "../components/ScheduleSection";
import { buildDailyCrewRoster, type CrewRecord, type DailyCrewRoster } from "../data/fieldCrews";
import {
  countBriefingAtRisk,
  getAllUnscheduledJobs,
  getScheduledTodayJobs,
  getTodayDate,
  getUpcomingJobs,
  formatDateShort,
} from "../utils/planUtils";

// TODO(perf): DailyPlansScreen loads ALL workspace jobs via useJobs().
// Migrate to ranged server-side fetches (today + upcoming window) similar to
// the Calendar screen's approach. This avoids transferring the full job set
// when only a small date range is needed.
export function DailyPlansScreen() {
  const { role } = useCurrentRole();
  const { hydrated, jobs, updateJob } = useJobsList();
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [roster, setRoster] = useState<DailyCrewRoster>({ crewGroups: [], floaters: [], allProfiles: [] });

  useEffect(() => {
    if (!actionNotice) return;
    const timeout = window.setTimeout(() => setActionNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [actionNotice]);

  const today = getTodayDate();

  const todayJobs = useMemo(() => getScheduledTodayJobs(jobs), [jobs]);
  const upcomingJobs = useMemo(() => getUpcomingJobs(jobs), [jobs]);
  const unscheduledJobs = useMemo(() => getAllUnscheduledJobs(jobs), [jobs]);

  useEffect(() => {
    let cancelled = false;

    async function loadCrews() {
      const assignedNames = todayJobs.map((job) => job.assignedTo);
      if (!role) {
        if (!cancelled) {
          setRoster(buildDailyCrewRoster({ crews: [], assignedNames }));
        }
        return;
      }

      try {
        const fetched = await requestJson<{ crews: CrewRecord[] }>(
          "/api/field-roster",
          { role, cache: "no-store" },
        );
        if (cancelled) return;
        setRoster(
          buildDailyCrewRoster({
            crews: fetched.crews ?? [],
            assignedNames,
          }),
        );
      } catch {
        if (!cancelled) {
          setRoster(buildDailyCrewRoster({ crews: [], assignedNames }));
        }
      }
    }

    void loadCrews();
    return () => {
      cancelled = true;
    };
  }, [todayJobs, role]);

  // ── Morning Briefing KPI metrics ──────────────────────────────────────────

  const assigned = useMemo(
    () => todayJobs.filter((j) => j.assignedTo.trim()).length,
    [todayJobs]
  );

  const unassigned = useMemo(
    () => todayJobs.filter((j) => !j.assignedTo.trim()).length,
    [todayJobs]
  );

  /** At-risk among today's jobs only, the same set as the Total tile. */
  const atRisk = useMemo(() => countBriefingAtRisk(todayJobs), [todayJobs]);

  /** Active crews: on the roster and not marked out. */
  const activeCrews = useMemo(
    () =>
      roster.crewGroups.filter(
        (g) =>
          g.crew.availability !== "vacation" &&
          g.crew.availability !== "sick" &&
          g.crew.availability !== "training" &&
          g.crew.availability !== "unavailable"
      ).length + roster.floaters.length,
    [roster]
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
            waitingPermit={null}
            activeCrews={activeCrews}
          />

          {/* ── Needs Attention ─────────────────────────────────────────────── */}
          <NeedsAttentionPanel jobs={attentionSourceJobs} />

          {/* ── Crew Status ─────────────────────────────────────────────────── */}
          <CrewStatusPanel
            crewGroups={roster.crewGroups}
            floaters={roster.floaters}
            jobCountByTechnician={jobCountByTechnician}
          />

          {/* ── Schedule sections ───────────────────────────────────────────── */}
          <ScheduleSection
            title="Today"
            icon={Sun}
            jobs={todayJobs}
            emptyMessage="No jobs scheduled for today."
            crewOptions={roster.allProfiles}
            onReschedule={handleReschedule}
            onAssign={handleAssign}
          />

          <ScheduleSection
            title="Upcoming"
            icon={CalendarDays}
            jobs={upcomingJobs}
            emptyMessage="No upcoming jobs scheduled."
            crewOptions={roster.allProfiles}
            onReschedule={handleReschedule}
            onAssign={handleAssign}
            groupByDate
          />

          <ScheduleSection
            title="Unscheduled"
            icon={CircleAlert}
            jobs={unscheduledJobs}
            emptyMessage="All jobs have been scheduled — nothing in the backlog."
            crewOptions={roster.allProfiles}
            onReschedule={handleReschedule}
            onAssign={handleAssign}
            isUnscheduled
          />
        </div>
      )}
    </div>
  );
}
