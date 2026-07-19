import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  ShieldAlert,
  Truck,
  UserRound,
} from "lucide-react";

import type { CrewWorkload, MorningAlert, PlannedJob } from "../types/dailyPlan";
import { getReadinessStatus } from "../utils/planUtils";

interface OperationalReadinessProps {
  plannedJobs: PlannedJob[];
  crewWorkloads: CrewWorkload[];
  alerts: MorningAlert[];
  readinessScore: number;
}

export function OperationalReadiness({
  plannedJobs,
  crewWorkloads,
  alerts,
  readinessScore,
}: OperationalReadinessProps) {
  const status = getReadinessStatus(readinessScore);
  const scoreBarColor =
    readinessScore >= 85
      ? "bg-green-500"
      : readinessScore >= 60
        ? "bg-yellow-500"
        : "bg-red-500";

  const readyJobs = plannedJobs.filter((job) => job.readiness.state === "ready").length;
  const warningJobs = plannedJobs.filter((job) => job.readiness.state === "warning").length;
  const blockedJobs = plannedJobs.filter((job) => job.readiness.state === "blocked").length;
  const truckReadyCount = crewWorkloads.filter(
    (workload) => workload.crew.truckInService && workload.crew.truckChecks.every((check) => check.ready)
  ).length;
  const constrainedCrews = crewWorkloads.filter(
    (workload) => workload.crew.availability !== "available"
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-slate-500/5 ring-1 ring-white/10">
          <Gauge className="h-4.5 w-4.5 text-blue-300" />
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Operational Readiness</p>
          <p className="text-xs text-slate-400">Blockers, materials, truck, and crew launch risk</p>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-end justify-between gap-3">
          <span className={["text-lg font-bold", status.color].join(" ")}>{status.label}</span>
          <span className="text-sm font-semibold text-white">
            {readinessScore}
            <span className="text-xs font-normal text-slate-400">/100</span>
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={["h-full rounded-full transition-all duration-500", scoreBarColor].join(" ")}
            style={{ width: `${readinessScore}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Job states</p>
          <dl className="mt-3 space-y-2 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <dt>Ready</dt>
              <dd>{readyJobs}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Warnings</dt>
              <dd>{warningJobs}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Blocked</dt>
              <dd>{blockedJobs}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Launch checks</p>
          <dl className="mt-3 space-y-2 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <dt>Truck ready</dt>
              <dd>
                {truckReadyCount}/{crewWorkloads.length}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Active alerts</dt>
              <dd>{alerts.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Crew constraints</dt>
              <dd>{constrainedCrews.length}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.slice(0, 3).map((alert) => (
          <div
            key={alert.id}
            className={[
              "flex items-start gap-3 rounded-xl p-3",
              alert.severity === "critical"
                ? "border border-red-500/15 bg-red-500/[0.06]"
                : alert.severity === "warning"
                  ? "border border-yellow-500/15 bg-yellow-500/[0.04]"
                  : "border border-white/5 bg-white/[0.02]",
            ].join(" ")}
          >
            <div className="mt-0.5 shrink-0">
              {alert.severity === "critical" ? (
                <ShieldAlert className="h-4 w-4 text-red-400" />
              ) : alert.severity === "warning" ? (
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-slate-300" />
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-200">{alert.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{alert.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-white/10 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Crew availability
        </p>
        <div className="mt-3 space-y-2">
          {crewWorkloads.map((workload) => (
            <div
              key={workload.crew.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {workload.crew.truckInService ? (
                  <Truck className="h-3.5 w-3.5 text-sky-300" />
                ) : (
                  <Truck className="h-3.5 w-3.5 text-red-300" />
                )}
                <div>
                  <p className="text-xs font-semibold text-white">{workload.crew.leadInstaller}</p>
                  <p className="text-[11px] text-slate-500">{workload.crew.truckName}</p>
                </div>
              </div>

              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                  workload.crew.availability === "available"
                    ? "border-green-500/20 bg-green-500/10 text-green-300"
                    : workload.crew.availability === "late arrival" || workload.crew.availability === "half day"
                      ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
                      : "border-red-500/20 bg-red-500/10 text-red-300",
                ].join(" ")}
              >
                <UserRound className="h-3 w-3" />
                {workload.crew.availability}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
