import { BatteryCharging, CircleAlert, Fuel, ShieldCheck, Truck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { CrewProfile, CrewWorkload, PlanReadinessState } from "../types/dailyPlan";
import { formatHours } from "../utils/planUtils";
import { PlanJobCard } from "./PlanJobCard";

function getWorkloadClasses(status: CrewWorkload["workloadStatus"]): string {
  if (status === "overloaded") {
    return "border-red-500/25 bg-red-500/[0.05]";
  }

  if (status === "warning") {
    return "border-yellow-500/25 bg-yellow-500/[0.05]";
  }

  return "border-white/10 bg-white/[0.03]";
}

function getAvailabilityClasses(availability: CrewWorkload["crew"]["availability"]): string {
  if (availability === "available") {
    return "border-green-500/20 bg-green-500/10 text-green-300";
  }

  if (availability === "late arrival" || availability === "half day") {
    return "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-500/20 bg-red-500/10 text-red-300";
}

interface CrewSectionProps {
  crewWorkload: CrewWorkload;
  crewOptions: CrewProfile[];
  onAssign: (jobId: string, technician: string) => void;
  onSetReadiness: (jobId: string, state: PlanReadinessState) => void;
  onDelay: (jobId: string) => void;
  onPlaceholderAction: (message: string) => void;
}

export function CrewSection({
  crewWorkload,
  crewOptions,
  onAssign,
  onSetReadiness,
  onDelay,
  onPlaceholderAction,
}: CrewSectionProps) {
  const { crew, jobs } = crewWorkload;
  const readyTruckChecks = crew.truckChecks.filter((check) => check.ready).length;

  return (
    <div className={["rounded-3xl border p-5", getWorkloadClasses(crewWorkload.workloadStatus)].join(" ")}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{crew.leadInstaller}</h3>
            <span
              className={[
                "rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                getAvailabilityClasses(crew.availability),
              ].join(" ")}
            >
              {crew.availability}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {crew.helper ? `Helper: ${crew.helper}` : "Solo route"} · {crew.experienceLevel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300">
            {formatHours(crewWorkload.hoursAssigned)} assigned
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300">
            Forecast {crewWorkload.forecastCompletion}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPlaceholderAction(`${crew.leadInstaller} marked ready to leave the shop.`)}
            className="h-8 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-slate-200 hover:bg-white/10"
          >
            Start day
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Crew</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p className="flex items-start gap-2"><Users className="mt-0.5 h-3.5 w-3.5 text-slate-500" /><span>{crew.leadInstaller}{crew.helper ? ` + ${crew.helper}` : ""}</span></p>
            <p>{crew.certifications.join(" · ")}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Truck</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p className="flex items-start gap-2"><Truck className="mt-0.5 h-3.5 w-3.5 text-slate-500" /><span>{crew.truckName}</span></p>
            <p className="text-xs text-slate-400">{crew.truckNote}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workload</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>{jobs.length} jobs today</p>
            <p>{crewWorkload.readyJobs} ready · {crewWorkload.warningJobs} watch · {crewWorkload.blockerJobs} blocked</p>
            <p>{formatHours(crew.dailyCapacityHours)} capacity</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Truck readiness</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>{readyTruckChecks}/{crew.truckChecks.length} checks clear</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {crew.truckChecks.map((check) => (
                <span
                  key={check.label}
                  className={[
                    "inline-flex items-center gap-1 rounded-full border px-2 py-1",
                    check.ready
                      ? "border-green-500/20 bg-green-500/10 text-green-200"
                      : "border-red-500/20 bg-red-500/10 text-red-200",
                  ].join(" ")}
                >
                  {check.label === "Fuel" ? (
                    <Fuel className="h-3 w-3" />
                  ) : check.label === "Battery tools" ? (
                    <BatteryCharging className="h-3 w-3" />
                  ) : check.ready ? (
                    <ShieldCheck className="h-3 w-3" />
                  ) : (
                    <CircleAlert className="h-3 w-3" />
                  )}
                  {check.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
            Open capacity — this crew can absorb reassigned work if another route slips.
          </div>
        ) : (
          jobs.map((job) => (
            <PlanJobCard
              key={job.id}
              job={job}
              crewOptions={crewOptions}
              onAssign={onAssign}
              onSetReadiness={onSetReadiness}
              onDelay={onDelay}
              onPlaceholderAction={onPlaceholderAction}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface UnassignedCrewSectionProps {
  jobs: CrewWorkload["jobs"];
  crewOptions: CrewProfile[];
  onAssign: (jobId: string, technician: string) => void;
  onSetReadiness: (jobId: string, state: PlanReadinessState) => void;
  onDelay: (jobId: string) => void;
  onPlaceholderAction: (message: string) => void;
}

export function UnassignedCrewSection({
  jobs,
  crewOptions,
  onAssign,
  onSetReadiness,
  onDelay,
  onPlaceholderAction,
}: UnassignedCrewSectionProps) {
  return (
    <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.05] p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-red-100">Unassigned queue</p>
          <p className="mt-1 text-sm text-red-100/80">
            These jobs need a crew, a customer callback, or a material decision before dispatch.
          </p>
        </div>

        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-200">
          {jobs.length} action item{jobs.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <PlanJobCard
            key={job.id}
            job={job}
            crewOptions={crewOptions}
            onAssign={onAssign}
            onSetReadiness={onSetReadiness}
            onDelay={onDelay}
            onPlaceholderAction={onPlaceholderAction}
          />
        ))}
      </div>
    </div>
  );
}
