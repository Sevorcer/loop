import { Clock3, Flag, Truck } from "lucide-react";

import type { CrewWorkload } from "../types/dailyPlan";
import { formatStartTime } from "../utils/planUtils";

interface DayTimelineProps {
  crewWorkloads: CrewWorkload[];
  isActive?: boolean;
  startedAt?: string;
}

export function DayTimeline({ crewWorkloads, isActive = false, startedAt }: DayTimelineProps) {
  const activeCrews = crewWorkloads.filter(
    (workload) => workload.jobs.length > 0 && workload.crew.availability !== "training"
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-slate-500/5 ring-1 ring-white/10">
          <Clock3 className="h-4 w-4 text-indigo-300" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{isActive ? "Active Timeline" : "Planned Timeline"}</p>
          <p className="text-xs text-slate-400">
            {isActive && startedAt
              ? `Operations started · ${formatStartTime(startedAt)}`
              : "Dispatch-to-completion framing for active crews"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {activeCrews.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
            No active crews are scheduled for this day yet.
          </div>
        ) : (
          activeCrews.map((workload) => (
            <div key={workload.crew.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{workload.crew.leadInstaller}</p>
                  <p className="text-xs text-slate-400">
                    {workload.jobs.length} stop{workload.jobs.length === 1 ? "" : "s"} · forecast {workload.forecastCompletion}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300">
                  {workload.hoursAssigned.toFixed(1)} scheduled hours
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <Truck className="h-3.5 w-3.5 text-sky-300" />
                    Depart
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{workload.crew.departureTime}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <Clock3 className="h-3.5 w-3.5 text-yellow-300" />
                    First arrival
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {workload.jobs[0]?.planning.arrivalWindow ?? "TBD"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <Flag className="h-3.5 w-3.5 text-emerald-300" />
                    Forecast finish
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white">{workload.forecastCompletion}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
