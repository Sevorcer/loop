"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList } from "lucide-react";
import Link from "next/link";

import { useJobs } from "@/features/jobs/state/JobsProvider";

import { ActiveOperationsBanner } from "../components/ActiveOperationsBanner";
import { AlertsBanner } from "../components/AlertsBanner";
import { CrewSection, UnassignedCrewSection } from "../components/CrewSection";
import { DayTimeline } from "../components/DayTimeline";
import { MorningOperationsHero } from "../components/MorningOperationsHero";
import { OperationalReadiness } from "../components/OperationalReadiness";
import { PlanningNotes } from "../components/PlanningNotes";
import { ReadinessSummary } from "../components/ReadinessSummary";
import type { PlanReadinessState } from "../types/dailyPlan";
import { useDailyPlans } from "../state/DailyPlansProvider";
import {
  addDays,
  buildCrewWorkloads,
  buildMorningAlerts,
  buildMorningDashboardMetrics,
  buildPlannedJob,
  getJobsForDate,
  getUnassignedJobs,
} from "../utils/planUtils";

function EmptyDay() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
        <CalendarDays className="h-6 w-6 text-slate-500" />
      </div>

      <h3 className="text-base font-semibold text-slate-300">No jobs scheduled</h3>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
        There are no jobs planned for this day. Navigate to a different day or create a new job from the{" "}
        <Link href="/jobs" className="text-blue-400 hover:underline">
          Jobs workspace
        </Link>
        .
      </p>
    </div>
  );
}

export function DailyPlansScreen() {
  const { hydrated, jobs, updateJob } = useJobs();
  const {
    selectedDate,
    getJobOverride,
    setJobOverride,
    getPlanStatus,
    getPlanActivation,
    activatePlan,
  } = useDailyPlans();
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!actionNotice) return;
    const timeout = window.setTimeout(() => setActionNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [actionNotice]);

  const planStatus = getPlanStatus(selectedDate);
  const planActivation = getPlanActivation(selectedDate);
  const hydratedPlanStatus = hydrated ? planStatus : "planning";
  const hydratedPlanActivation = hydrated ? planActivation : undefined;
  const isActive = hydratedPlanStatus === "active";

  const dayJobs = useMemo(
    () => getJobsForDate(jobs, selectedDate),
    [jobs, selectedDate]
  );

  const plannedJobs = useMemo(
    () => dayJobs.map((job) => buildPlannedJob(job, getJobOverride(job.id))),
    [dayJobs, getJobOverride]
  );

  const crewWorkloads = useMemo(
    () => buildCrewWorkloads(plannedJobs, selectedDate),
    [plannedJobs, selectedDate]
  );

  const metrics = useMemo(
    () => buildMorningDashboardMetrics(plannedJobs, crewWorkloads, selectedDate),
    [plannedJobs, crewWorkloads, selectedDate]
  );

  const alerts = useMemo(
    () => buildMorningAlerts(plannedJobs, crewWorkloads, selectedDate),
    [plannedJobs, crewWorkloads, selectedDate]
  );

  const blockerCount = useMemo(
    () => plannedJobs.filter((job) => job.readiness.state === "blocked").length,
    [plannedJobs]
  );

  const unassignedJobs = useMemo(
    () => getUnassignedJobs(plannedJobs),
    [plannedJobs]
  );

  const crewOptions = useMemo(
    () => crewWorkloads
      .map((workload) => workload.crew)
      .filter((crew) => crew.availability !== "vacation" && crew.availability !== "sick"),
    [crewWorkloads]
  );

  const handleActivate = useCallback(() => {
    activatePlan(selectedDate);
    setActionNotice("Operations started — crews are cleared to roll.");
  }, [activatePlan, selectedDate]);

  const handleAssign = useCallback(
    (jobId: string, technician: string) => {
      const job = jobs.find((item) => item.id === jobId);

      if (!job || job.assignedTo === technician) {
        return;
      }

      updateJob(jobId, { ...job, assignedTo: technician });

      let notice: string;
      if (isActive) {
        notice = `Override: ${job.jobNumber} reassigned to ${technician || "unassigned queue"}.`;
      } else if (technician) {
        notice = `${job.jobNumber} assigned to ${technician}.`;
      } else {
        notice = `${job.jobNumber} moved back to the unassigned queue.`;
      }
      setActionNotice(notice);
    },
    [jobs, updateJob, isActive]
  );

  const handleDelay = useCallback(
    (jobId: string) => {
      const job = jobs.find((item) => item.id === jobId);

      if (!job) {
        return;
      }

      const nextDate = addDays(job.scheduledFor, 1);
      updateJob(jobId, { ...job, scheduledFor: nextDate });

      const notice = isActive
        ? `Override: ${job.jobNumber} moved to ${nextDate}. Notify the customer.`
        : `${job.jobNumber} moved to ${nextDate}.`;
      setActionNotice(notice);
    },
    [jobs, updateJob, isActive]
  );

  const handleSetReadiness = useCallback(
    (jobId: string, state: PlanReadinessState) => {
      setJobOverride(jobId, { readinessState: state });

      let notice: string;
      if (isActive) {
        notice = state === "ready"
          ? "Override: job readiness confirmed during active operations."
          : "Override: job flagged for active-day attention.";
      } else {
        notice = state === "ready"
          ? "Job marked ready for the morning launch."
          : "Job flagged for morning attention.";
      }
      setActionNotice(notice);
    },
    [setJobOverride, isActive]
  );

  const handlePlaceholderAction = useCallback((message: string) => {
    setActionNotice(message);
  }, []);

  const activeCrewCards = useMemo(
    () =>
      crewWorkloads.filter(
        (workload) =>
          workload.jobs.length > 0 ||
          workload.crew.availability === "available" ||
          workload.crew.availability === "late arrival" ||
          workload.crew.availability === "half day"
      ),
    [crewWorkloads]
  );

  return (
    <div className="min-h-screen space-y-6 p-8">
      <MorningOperationsHero
        date={selectedDate}
        status={hydratedPlanStatus}
        startedAt={hydratedPlanActivation?.startedAt ?? null}
        metrics={metrics}
        alerts={alerts}
        blockerCount={blockerCount}
        onActivate={handleActivate}
        onPrintPackets={() => handlePlaceholderAction("Morning packets queued for all active crews.")}
      />

      {actionNotice ? (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm",
            isActive
              ? "border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-100"
              : "border-blue-500/20 bg-blue-500/[0.08] text-blue-100",
          ].join(" ")}
        >
          {actionNotice}
        </div>
      ) : null}

      {!hydrated ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          Loading plan...
        </div>
      ) : (
        <>
          {isActive && hydratedPlanActivation ? (
            <ActiveOperationsBanner startedAt={hydratedPlanActivation.startedAt} />
          ) : (
            <AlertsBanner alerts={alerts} />
          )}

          <ReadinessSummary metrics={metrics} />

          {dayJobs.length === 0 ? (
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="space-y-6 xl:col-span-2">
                <EmptyDay />
              </div>
              <div className="space-y-6">
                <PlanningNotes key={selectedDate} date={selectedDate} isActive={isActive} />
              </div>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                <div className="flex items-center gap-2 px-1">
                  <ClipboardList className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                    {isActive ? "Active Crews" : "Crew Assignments"}
                  </h2>
                  <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400">
                    {activeCrewCards.length} crew{activeCrewCards.length !== 1 ? "s" : ""}
                    {unassignedJobs.length > 0 ? ` · ${unassignedJobs.length} unassigned` : ""}
                  </span>
                </div>

                {activeCrewCards.map((workload) => (
                  <CrewSection
                    key={workload.crew.id}
                    crewWorkload={workload}
                    crewOptions={crewOptions}
                    isActive={isActive}
                    onAssign={handleAssign}
                    onSetReadiness={handleSetReadiness}
                    onDelay={handleDelay}
                    onPlaceholderAction={handlePlaceholderAction}
                  />
                ))}

                {unassignedJobs.length > 0 ? (
                  <UnassignedCrewSection
                    jobs={unassignedJobs}
                    crewOptions={crewOptions}
                    isActive={isActive}
                    onAssign={handleAssign}
                    onSetReadiness={handleSetReadiness}
                    onDelay={handleDelay}
                    onPlaceholderAction={handlePlaceholderAction}
                  />
                ) : null}
              </div>

              <div className="space-y-4">
                <OperationalReadiness
                  plannedJobs={plannedJobs}
                  crewWorkloads={crewWorkloads}
                  alerts={alerts}
                  readinessScore={metrics.readinessScore}
                  isActive={isActive}
                />
                <DayTimeline crewWorkloads={crewWorkloads} isActive={isActive} startedAt={hydratedPlanActivation?.startedAt} />
                <PlanningNotes key={selectedDate} date={selectedDate} isActive={isActive} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
