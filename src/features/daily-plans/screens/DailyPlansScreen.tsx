"use client";

import { useMemo } from "react";
import { CalendarDays, ClipboardList } from "lucide-react";
import Link from "next/link";

import { useJobs } from "@/features/jobs/state/JobsProvider";

import { CrewSection, UnassignedCrewSection } from "../components/CrewSection";
import { DayNavigator } from "../components/DayNavigator";
import { OperationalReadiness } from "../components/OperationalReadiness";
import { PlanningNotes } from "../components/PlanningNotes";
import { ReadinessSummary } from "../components/ReadinessSummary";
import { useDailyPlans } from "../state/DailyPlansProvider";
import {
  computeReadiness,
  getJobsForDate,
  getUnassignedJobs,
  groupJobsByTechnician,
} from "../utils/planUtils";

function EmptyDay() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
        <CalendarDays className="h-6 w-6 text-slate-500" />
      </div>

      <h3 className="text-base font-semibold text-slate-300">
        No jobs scheduled
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
        There are no jobs planned for this day. Navigate to a different day or
        create a new job from the{" "}
        <Link href="/jobs" className="text-blue-400 hover:underline">
          Jobs workspace
        </Link>
        .
      </p>
    </div>
  );
}

export function DailyPlansScreen() {
  const { hydrated, jobs } = useJobs();
  const { selectedDate } = useDailyPlans();

  const dayJobs = useMemo(
    () => getJobsForDate(jobs, selectedDate),
    [jobs, selectedDate]
  );

  const crewGroups = useMemo(
    () => groupJobsByTechnician(dayJobs),
    [dayJobs]
  );

  const unassignedJobs = useMemo(
    () => getUnassignedJobs(dayJobs),
    [dayJobs]
  );

  const metrics = useMemo(
    () => computeReadiness(dayJobs),
    [dayJobs]
  );

  const crewEntries = useMemo(
    () => Array.from(crewGroups.entries()),
    [crewGroups]
  );

  return (
    <div className="min-h-screen space-y-6 p-8">
      {/* Workspace header */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              <CalendarDays className="h-3.5 w-3.5" />
              Morning Operations
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Daily Plans
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">
                Organize the day&apos;s work, verify crew assignments, and confirm
                operational readiness before field execution begins.
              </p>
            </div>
          </div>

          <DayNavigator />
        </div>
      </div>

      {/* Loading state */}
      {!hydrated ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          Loading plan...
        </div>
      ) : (
        <>
          {/* Readiness summary row */}
          {dayJobs.length > 0 ? (
            <ReadinessSummary metrics={metrics} />
          ) : null}

          {/* Empty day */}
          {dayJobs.length === 0 ? (
            <EmptyDay />
          ) : (
            <div className="grid gap-6 xl:grid-cols-3">
              {/* Crew assignments — 2/3 width */}
              <div className="space-y-4 xl:col-span-2">
                <div className="flex items-center gap-2 px-1">
                  <ClipboardList className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Crew Assignments
                  </h2>
                  <span className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400">
                    {crewEntries.length} tech{crewEntries.length !== 1 ? "s" : ""}
                    {unassignedJobs.length > 0
                      ? ` · ${unassignedJobs.length} unassigned`
                      : ""}
                  </span>
                </div>

                {crewEntries.map(([technician, techJobs]) => (
                  <CrewSection
                    key={technician}
                    technician={technician}
                    jobs={techJobs}
                  />
                ))}

                {unassignedJobs.length > 0 && (
                  <UnassignedCrewSection jobs={unassignedJobs} />
                )}
              </div>

              {/* Readiness + Notes — 1/3 width */}
              <div className="space-y-4">
                <OperationalReadiness jobs={dayJobs} />
                <PlanningNotes key={selectedDate} date={selectedDate} />
              </div>
            </div>
          )}

          {/* Planning notes for empty days */}
          {dayJobs.length === 0 ? (
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-1">
                <PlanningNotes key={selectedDate} date={selectedDate} />
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
