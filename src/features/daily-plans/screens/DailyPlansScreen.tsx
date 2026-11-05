"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleAlert, Sun } from "lucide-react";

import { PageHeader } from "@/components/atlas";
import { useCurrentRole } from "@/features/auth";
import type { Job } from "@/features/jobs/types/job";
import { requestJson } from "@/lib/api/client";

import { CrewStatusPanel } from "../components/CrewStatusPanel";
import { MorningBriefing } from "../components/MorningBriefing";
import { NeedsAttentionPanel } from "../components/NeedsAttentionPanel";
import { ScheduleSection } from "../components/ScheduleSection";
import { buildDailyCrewRoster, type CrewRecord, type DailyCrewRoster } from "../data/fieldCrews";
import {
  countBriefingAtRisk,
  getScheduledTodayJobs,
  getTodayDate,
  getUpcomingJobs,
  addDays,
  DAILY_PLANS_UPCOMING_DAYS,
  formatDateShort,
} from "../utils/planUtils";

/**
 * Daily Plans loads today + the next DAILY_PLANS_UPCOMING_DAYS days (and
 * unscheduled jobs) from /api/daily-plans/jobs — the same idea as Calendar's
 * ranged fetch. It no longer downloads every job in the company.
 */
export function DailyPlansScreen() {
  const { role } = useCurrentRole();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [unscheduledJobs, setUnscheduledJobs] = useState<Job[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [roster, setRoster] = useState<DailyCrewRoster>({ crewGroups: [], floaters: [], allProfiles: [] });

  const today = getTodayDate();
  const rangeTo = addDays(today, DAILY_PLANS_UPCOMING_DAYS);

  const reloadBoard = useCallback(async () => {
    if (!role) return;
    try {
      setLoadError(null);
      const response = await requestJson<{ jobs: Job[]; unscheduled: Job[] }>(
        `/api/daily-plans/jobs?from=${today}&to=${rangeTo}`,
        { role, cache: "no-store" },
      );
      setJobs(response.jobs ?? []);
      setUnscheduledJobs(response.unscheduled ?? []);
      setHydrated(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load daily plans.");
      setHydrated(true);
    }
  }, [role, today, rangeTo]);

  useEffect(() => {
    void reloadBoard();
  }, [reloadBoard]);

  useEffect(() => {
    if (!actionNotice) return;
    const timeout = window.setTimeout(() => setActionNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [actionNotice]);

  const todayJobs = useMemo(() => getScheduledTodayJobs(jobs), [jobs]);
  const upcomingJobs = useMemo(() => getUpcomingJobs(jobs), [jobs]);

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

  const patchJobLocal = useCallback((jobId: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, ...patch } : job)));
    setUnscheduledJobs((prev) => {
      const next = prev
        .map((job) => (job.id === jobId ? { ...job, ...patch } : job))
        .filter((job) => job.scheduledFor == null);
      // If a previously scheduled job became unscheduled, leave it out of this
      // list until reload; reschedule off the unscheduled list removes it here.
      return next.filter((job) => job.id !== jobId || job.scheduledFor == null);
    });
  }, []);

  const handleReschedule = useCallback(
    (jobId: string, date: string) => {
      const job =
        jobs.find((j) => j.id === jobId) ?? unscheduledJobs.find((j) => j.id === jobId);
      if (!job || !role) return;
      patchJobLocal(jobId, { scheduledFor: date });
      setUnscheduledJobs((prev) => prev.filter((j) => j.id !== jobId));
      setActionNotice(`${job.jobNumber} rescheduled to ${formatDateShort(date)}.`);
      void requestJson(`/api/jobs/${jobId}`, {
        role,
        method: "PATCH",
        body: { scheduledFor: date },
      }).catch(() => {
        void reloadBoard();
      });
    },
    [jobs, unscheduledJobs, role, patchJobLocal, reloadBoard],
  );

  const handleAssign = useCallback(
    (jobId: string, technician: string) => {
      const job =
        jobs.find((j) => j.id === jobId) ?? unscheduledJobs.find((j) => j.id === jobId);
      if (!job || job.assignedTo === technician || !role) return;
      patchJobLocal(jobId, { assignedTo: technician });
      setActionNotice(
        technician
          ? `${job.jobNumber} assigned to ${technician}.`
          : `${job.jobNumber} moved to unassigned.`,
      );
      void requestJson(`/api/jobs/${jobId}`, {
        role,
        method: "PATCH",
        body: { assignedTo: technician },
      }).catch(() => {
        void reloadBoard();
      });
    },
    [jobs, unscheduledJobs, role, patchJobLocal, reloadBoard],
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

      {loadError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-100">
          {loadError}
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
