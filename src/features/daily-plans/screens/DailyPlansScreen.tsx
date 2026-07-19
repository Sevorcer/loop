"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Printer, Rocket } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useJobs } from "@/features/jobs/state/JobsProvider";

import { AlertsBanner } from "../components/AlertsBanner";
import { CrewSection, UnassignedCrewSection } from "../components/CrewSection";
import { DayNavigator } from "../components/DayNavigator";
import { DayTimeline } from "../components/DayTimeline";
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
  getDayOverviewSummary,
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
  const { selectedDate, getJobOverride, setJobOverride } = useDailyPlans();
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!actionNotice) {
      return;
    }

    const timeout = window.setTimeout(() => setActionNotice(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [actionNotice]);

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

  const handleAssign = useCallback(
    (jobId: string, technician: string) => {
      const job = jobs.find((item) => item.id === jobId);

      if (!job || job.assignedTo === technician) {
        return;
      }

      updateJob(jobId, { ...job, assignedTo: technician });
      setActionNotice(
        technician
          ? `${job.jobNumber} assigned to ${technician}.`
          : `${job.jobNumber} moved back to the unassigned queue.`
      );
    },
    [jobs, updateJob]
  );

  const handleDelay = useCallback(
    (jobId: string) => {
      const job = jobs.find((item) => item.id === jobId);

      if (!job) {
        return;
      }

      updateJob(jobId, {
        ...job,
        scheduledFor: addDays(job.scheduledFor, 1),
      });
      setActionNotice(`${job.jobNumber} moved to ${addDays(job.scheduledFor, 1)}.`);
    },
    [jobs, updateJob]
  );

  const handleSetReadiness = useCallback(
    (jobId: string, state: PlanReadinessState) => {
      setJobOverride(jobId, { readinessState: state });
      setActionNotice(
        state === "ready"
          ? "Job marked ready for the morning launch."
          : "Job flagged for morning attention."
      );
    },
    [setJobOverride]
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
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              <CalendarDays className="h-3.5 w-3.5" />
              Daily Plans
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Daily Plans</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-400">
                {getDayOverviewSummary(selectedDate)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:items-end">
            <DayNavigator />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => handlePlaceholderAction("Morning packets queued for all active crews.")}
                className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Printer className="h-3.5 w-3.5" />
                Print packets
              </Button>
              <Button
                variant="ghost"
                onClick={() => handlePlaceholderAction("Morning launch started — crews are cleared to roll.")}
                className="h-9 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 text-xs font-medium text-blue-100 hover:bg-blue-500/15"
              >
                <Rocket className="h-3.5 w-3.5" />
                Start day
              </Button>
            </div>
          </div>
        </div>
      </div>

      {actionNotice ? (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.08] px-4 py-3 text-sm text-blue-100">
          {actionNotice}
        </div>
      ) : null}

      {!hydrated ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          Loading plan...
        </div>
      ) : (
        <>
          <AlertsBanner alerts={alerts} />
          <ReadinessSummary metrics={metrics} />

          {dayJobs.length === 0 ? (
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="space-y-6 xl:col-span-2">
                <EmptyDay />
              </div>
              <div className="space-y-6">
                <PlanningNotes key={selectedDate} date={selectedDate} />
              </div>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="space-y-4 xl:col-span-2">
                <div className="flex items-center gap-2 px-1">
                  <ClipboardList className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Crew Assignments
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
                />
                <DayTimeline crewWorkloads={crewWorkloads} />
                <PlanningNotes key={selectedDate} date={selectedDate} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
