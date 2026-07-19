import { AlertTriangle, CheckCircle2, Clock, MapPin, Truck } from "lucide-react";

import type { LiveCrewCard, WorkOrderMilestone } from "../types/liveOps";
import { MILESTONE_LABELS } from "../types/liveOps";

interface ActiveCrewBoardProps {
  crews: LiveCrewCard[];
}

const stateConfig: Record<
  LiveCrewCard["operationalState"],
  { label: string; dot: string; badge: string }
> = {
  dispatched: {
    label: "Dispatched",
    dot: "bg-blue-400",
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  },
  traveling: {
    label: "Traveling",
    dot: "bg-indigo-400",
    badge: "border-indigo-500/20 bg-indigo-500/10 text-indigo-300",
  },
  on_site: {
    label: "On Site",
    dot: "bg-cyan-400",
    badge: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  },
  working: {
    label: "Working",
    dot: "bg-green-400 animate-pulse",
    badge: "border-green-500/20 bg-green-500/10 text-green-300",
  },
  delayed: {
    label: "Delayed",
    dot: "bg-yellow-400 animate-pulse",
    badge: "border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300",
  },
  available: {
    label: "Available",
    dot: "bg-slate-400",
    badge: "border-white/10 bg-white/[0.04] text-slate-400",
  },
  standby: {
    label: "Standby",
    dot: "bg-slate-500",
    badge: "border-white/10 bg-white/[0.03] text-slate-500",
  },
};

function milestoneProgress(milestone: WorkOrderMilestone): number {
  const order: WorkOrderMilestone[] = [
    "assigned", "en_route", "arrived", "working", "quality_check", "complete",
  ];
  const idx = order.indexOf(milestone);
  return idx < 0 ? 0 : Math.round((idx / (order.length - 1)) * 100);
}

export function ActiveCrewBoard({ crews }: ActiveCrewBoardProps) {
  // Sort: delayed first, working, traveling, on_site, dispatched, available, standby
  const stateOrder: LiveCrewCard["operationalState"][] = [
    "delayed", "working", "on_site", "traveling", "dispatched", "available", "standby",
  ];
  const sorted = [...crews].sort(
    (a, b) => stateOrder.indexOf(a.operationalState) - stateOrder.indexOf(b.operationalState)
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Active Crew Board
        </h2>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400">
          {sorted.length} crew{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((crew) => (
          <CrewCard key={crew.crewId} crew={crew} />
        ))}
      </div>
    </div>
  );
}

function CrewCard({ crew }: { crew: LiveCrewCard }) {
  const cfg = stateConfig[crew.operationalState];

  return (
    <div
      className={[
        "flex flex-col gap-3 rounded-2xl border p-4 transition-all",
        crew.hasBlocker
          ? "border-yellow-500/20 bg-yellow-500/[0.04]"
          : "border-white/10 bg-white/[0.02]",
      ].join(" ")}
    >
      {/* Header: crew name + state badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={[
              "flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05]",
            ].join(" ")}
          >
            <Truck className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none text-white">
              {crew.technician}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{crew.crewName}</p>
          </div>
        </div>

        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
            cfg.badge,
          ].join(" ")}
        >
          <span className={["h-1.5 w-1.5 rounded-full", cfg.dot].join(" ")} />
          {cfg.label}
        </span>
      </div>

      {/* Work order detail */}
      {crew.workOrderId ? (
        <div className="space-y-2">
          {crew.customer && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="truncate">{crew.customer}</span>
            </div>
          )}

          {crew.currentMilestone && (
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  {MILESTONE_LABELS[crew.currentMilestone]}
                </span>
                {crew.minutesInMilestone > 0 && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Clock className="h-3 w-3" />
                    {crew.minutesInMilestone}m
                  </span>
                )}
              </div>
              {/* Milestone progress bar */}
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className={[
                    "h-full rounded-full transition-all",
                    crew.operationalState === "delayed"
                      ? "bg-yellow-500"
                      : "bg-blue-500",
                  ].join(" ")}
                  style={{ width: `${milestoneProgress(crew.currentMilestone)}%` }}
                />
              </div>
            </div>
          )}

          {crew.eta && (
            <p className="text-xs text-slate-500">
              ETA{" "}
              <span className="font-medium text-slate-300">{crew.eta}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          No active assignment
        </div>
      )}

      {/* Blocker */}
      {crew.hasBlocker && crew.blockerLabel && (
        <div className="flex items-center gap-1.5 rounded-xl border border-yellow-500/15 bg-yellow-500/[0.06] px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
          <p className="text-xs font-medium text-yellow-300">{crew.blockerLabel}</p>
        </div>
      )}
    </div>
  );
}
