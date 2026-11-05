"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CircleAlert,
  Printer,
  Rocket,
  PackageCheck,
} from "lucide-react";

import { PageHeader } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import type { Job } from "@/features/jobs/types/job";
import { requestJson } from "@/lib/api/client";

import { CrewStatusPanel } from "../components/CrewStatusPanel";
import { DayJobsTable, type AssignablePerson } from "../components/DayJobsTable";
import { DayNavigator } from "../components/DayNavigator";
import { MorningBriefing } from "../components/MorningBriefing";
import { NeedsAttentionPanel } from "../components/NeedsAttentionPanel";
import { PlanningNotes } from "../components/PlanningNotes";
import { ScheduleSection } from "../components/ScheduleSection";
import {
  buildDailyCrewRoster,
  type CrewRecord,
  type DailyCrewRoster,
} from "../data/fieldCrews";
import { useDailyPlans } from "../state/DailyPlansProvider";
import {
  canEditDailyPlans,
  canViewDailyPlans,
  countPeopleWorking,
  getJobsForSelectedDate,
  getShortUpcomingJobs,
  jobAssigneeNames,
  jobIsAssigned,
} from "../utils/dayPlanHelpers";
import {
  addDays,
  countBriefingAtRisk,
  DAILY_PLANS_UPCOMING_DAYS,
  formatDateShort,
} from "../utils/planUtils";

/**
 * Daily Plans — office morning handout + assignment desk.
 *
 * Loads only the selected day through a small upcoming window from
 * /api/daily-plans/jobs (ranged fetch from PR #412). Assignment writes the
 * same job_assignees multi-person list Dispatch uses.
 */
export function DailyPlansScreen() {
  const { role } = useCurrentRole();
  const {
    selectedDate,
    getPlanStatus,
    getPlanActivation,
    activatePlan,
    getPacketsSent,
    markPacketsSent,
  } = useDailyPlans();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [unscheduledJobs, setUnscheduledJobs] = useState<Job[]>([]);
  const [crews, setCrews] = useState<CrewRecord[]>([]);
  const [people, setPeople] = useState<AssignablePerson[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const canEdit = canEditDailyPlans(role);
  const canView = canViewDailyPlans(role);
  const rangeFrom = selectedDate;
  const rangeTo = addDays(selectedDate, DAILY_PLANS_UPCOMING_DAYS);
  const planStatus = getPlanStatus(selectedDate);
  const activation = getPlanActivation(selectedDate);
  const packetsSent = getPacketsSent(selectedDate);

  const reloadBoard = useCallback(async () => {
    if (!role || !canView) return;
    try {
      setLoadError(null);
      const response = await requestJson<{ jobs: Job[]; unscheduled: Job[] }>(
        `/api/daily-plans/jobs?from=${rangeFrom}&to=${rangeTo}`,
        { role, cache: "no-store" },
      );
      setJobs(response.jobs ?? []);
      setUnscheduledJobs(response.unscheduled ?? []);
      setHydrated(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load daily plans.");
      setHydrated(true);
    }
  }, [role, canView, rangeFrom, rangeTo]);

  useEffect(() => {
    // queueMicrotask defers setState out of the synchronous effect body.
    queueMicrotask(() => {
      void reloadBoard();
    });
  }, [reloadBoard]);

  useEffect(() => {
    if (!role || !canView) return;
    let cancelled = false;
    void (async () => {
      try {
        const [rosterRes, peopleRes] = await Promise.all([
          requestJson<{ crews: CrewRecord[] }>("/api/field-roster", {
            role,
            cache: "no-store",
          }),
          requestJson<{ people: AssignablePerson[] }>("/api/assignable-people", {
            role,
            cache: "no-store",
          }),
        ]);
        if (cancelled) return;
        setCrews(rosterRes.crews ?? []);
        setPeople(peopleRes.people ?? []);
      } catch {
        if (!cancelled) {
          setCrews([]);
          setPeople([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, canView]);

  useEffect(() => {
    if (!actionNotice) return;
    const timeout = window.setTimeout(() => setActionNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [actionNotice]);

  const dayJobs = useMemo(
    () => getJobsForSelectedDate(jobs, selectedDate),
    [jobs, selectedDate],
  );
  const upcomingJobs = useMemo(
    () => getShortUpcomingJobs(jobs, selectedDate, 3),
    [jobs, selectedDate],
  );

  const roster = useMemo<DailyCrewRoster>(() => {
    const assignedNames = dayJobs.flatMap((job) => jobAssigneeNames(job));
    return buildDailyCrewRoster({ crews, assignedNames });
  }, [dayJobs, crews]);


  const assigned = useMemo(
    () => dayJobs.filter((job) => jobIsAssigned(job)).length,
    [dayJobs],
  );
  const unassigned = dayJobs.length - assigned;
  const inProgress = useMemo(
    () => dayJobs.filter((job) => job.status === "In Progress").length,
    [dayJobs],
  );
  const onHold = useMemo(
    () => dayJobs.filter((job) => job.status === "On Hold").length,
    [dayJobs],
  );
  const atRisk = useMemo(() => countBriefingAtRisk(dayJobs), [dayJobs]);
  const peopleWorking = useMemo(() => countPeopleWorking(dayJobs), [dayJobs]);

  const jobCountByTechnician = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of dayJobs) {
      for (const name of jobAssigneeNames(job)) {
        counts[name] = (counts[name] ?? 0) + 1;
      }
    }
    return counts;
  }, [dayJobs]);

  const jobsByTechnician = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const job of dayJobs) {
      for (const name of jobAssigneeNames(job)) {
        (map[name] ??= []).push(job);
      }
    }
    return map;
  }, [dayJobs]);

  const attentionSourceJobs = useMemo(
    () => [...dayJobs, ...unscheduledJobs],
    [dayJobs, unscheduledJobs],
  );

  const patchJobLocal = useCallback((jobId: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, ...patch } : job)));
    setUnscheduledJobs((prev) =>
      prev
        .map((job) => (job.id === jobId ? { ...job, ...patch } : job))
        .filter((job) => job.scheduledFor == null),
    );
  }, []);

  const handleReschedule = useCallback(
    (jobId: string, date: string) => {
      if (!canEdit || !role) return;
      const job =
        jobs.find((item) => item.id === jobId) ??
        unscheduledJobs.find((item) => item.id === jobId);
      if (!job) return;
      patchJobLocal(jobId, { scheduledFor: date });
      setUnscheduledJobs((prev) => prev.filter((item) => item.id !== jobId));
      setActionNotice(`${job.jobNumber} rescheduled to ${formatDateShort(date)}.`);
      void requestJson(`/api/jobs/${jobId}`, {
        role,
        method: "PATCH",
        body: { scheduledFor: date },
      }).catch(() => {
        void reloadBoard();
      });
    },
    [canEdit, role, jobs, unscheduledJobs, patchJobLocal, reloadBoard],
  );

  /** Legacy single-name assign from ScheduleSection cards (upcoming / unscheduled). */
  const handleAssignName = useCallback(
    (jobId: string, technician: string) => {
      if (!canEdit || !role) return;
      const job =
        jobs.find((item) => item.id === jobId) ??
        unscheduledJobs.find((item) => item.id === jobId);
      if (!job) return;
      const match = people.find(
        (person) => person.name.trim().toLowerCase() === technician.trim().toLowerCase(),
      );
      const assigneeIds = match ? [match.id] : [];
      const assignees = match ? [{ id: match.id, name: match.name }] : [];
      patchJobLocal(jobId, {
        assignedTo: technician,
        assignees,
      });
      setActionNotice(
        technician
          ? `${job.jobNumber} assigned to ${technician}.`
          : `${job.jobNumber} moved to unassigned.`,
      );
      void requestJson(`/api/jobs/${jobId}`, {
        role,
        method: "PATCH",
        body: {
          assignedTo: technician,
          assigneeIds,
        },
      }).catch(() => {
        void reloadBoard();
      });
    },
    [canEdit, role, jobs, unscheduledJobs, people, patchJobLocal, reloadBoard],
  );

  const handleAssignPeople = useCallback(
    (jobId: string, assigneeIds: string[]) => {
      if (!canEdit || !role) return;
      const job = jobs.find((item) => item.id === jobId);
      if (!job) return;
      const ids = Array.from(new Set(assigneeIds.filter(Boolean)));
      const assignees = ids.map((id) => {
        const person = people.find((item) => item.id === id);
        const existing = (job.assignees ?? []).find((item) => item.id === id);
        return {
          id,
          name: person?.name ?? existing?.name ?? "Team member",
        };
      });
      const label = assignees.map((person) => person.name).join(", ");
      patchJobLocal(jobId, {
        assignees,
        assignedTo: label,
      });
      setActionNotice(
        label
          ? `${job.jobNumber} assigned to ${label}.`
          : `${job.jobNumber} moved to unassigned.`,
      );
      void requestJson(`/api/jobs/${jobId}`, {
        role,
        method: "PATCH",
        body: {
          assignedTo: label,
          assigneeIds: ids,
        },
      }).catch(() => {
        void reloadBoard();
      });
    },
    [canEdit, role, jobs, people, patchJobLocal, reloadBoard],
  );

  if (role && !canView) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-300">
        Daily Plans is for office and dispatch. Open your jobs list instead.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Plans"
        description="Morning handout and assignment desk — every job for the day, the people on them, and a printable board."
      />

      <DayNavigator />

      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={planStatus === "active"}
            onClick={() => {
              activatePlan(selectedDate);
              setActionNotice(`Day activated for ${formatDateShort(selectedDate)}.`);
            }}
            className="gap-1.5"
          >
            <Rocket className="h-3.5 w-3.5" />
            {planStatus === "active" ? "Day active" : "Activate day"}
          </Button>
        ) : null}

        {canEdit ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={packetsSent}
            onClick={() => {
              markPacketsSent(selectedDate);
              setActionNotice("Packets marked as sent.");
            }}
            className="gap-1.5 border border-white/10"
          >
            <PackageCheck className="h-3.5 w-3.5" />
            {packetsSent ? "Packets sent" : "Mark packets sent"}
          </Button>
        ) : null}

        <Link
          href={`/daily-plans/print?date=${selectedDate}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-200 hover:bg-white/10"
        >
          <Printer className="h-3.5 w-3.5" />
          Print handout
        </Link>

        {planStatus === "active" && activation?.startedAt ? (
          <span className="text-xs text-green-300">
            Activated {new Date(activation.startedAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        ) : null}
      </div>

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
          <MorningBriefing
            date={selectedDate}
            totalToday={dayJobs.length}
            assigned={assigned}
            unassigned={unassigned}
            atRisk={atRisk}
            waitingPermit={null}
            activeCrews={peopleWorking}
            inProgress={inProgress}
            onHold={onHold}
            peopleWorking={peopleWorking}
          />

          <section aria-label="All jobs for the day" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                All jobs · {formatDateShort(selectedDate)}
              </h2>
              <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-500">
                {dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}
              </span>
            </div>
            <DayJobsTable
              jobs={dayJobs}
              crews={crews}
              people={people}
              canEdit={canEdit}
              onAssignPeople={handleAssignPeople}
            />
          </section>

          <NeedsAttentionPanel jobs={attentionSourceJobs} />

          <CrewStatusPanel
            crewGroups={roster.crewGroups}
            floaters={roster.floaters}
            jobCountByTechnician={jobCountByTechnician}
            jobsByTechnician={jobsByTechnician}
          />

          <PlanningNotes date={selectedDate} isActive={planStatus === "active"} />

          <ScheduleSection
            title="Upcoming (next 3 days)"
            icon={CalendarDays}
            jobs={upcomingJobs}
            emptyMessage="Nothing else scheduled in the next three days."
            crewOptions={roster.allProfiles}
            onReschedule={handleReschedule}
            onAssign={handleAssignName}
            groupByDate
          />

          <ScheduleSection
            title="Unscheduled"
            icon={CircleAlert}
            jobs={unscheduledJobs}
            emptyMessage="All jobs have been scheduled — nothing in the backlog."
            crewOptions={roster.allProfiles}
            onReschedule={handleReschedule}
            onAssign={handleAssignName}
            isUnscheduled
          />
        </div>
      )}
    </div>
  );
}
