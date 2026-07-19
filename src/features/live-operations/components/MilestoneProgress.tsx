import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { LiveWorkOrder, WorkOrderMilestone } from "../types/liveOps";
import { MILESTONE_LABELS, MILESTONE_ORDER } from "../types/liveOps";

interface MilestoneProgressProps {
  workOrders: LiveWorkOrder[];
}

export function MilestoneProgress({ workOrders }: MilestoneProgressProps) {
  const visible = workOrders.filter((wo) => wo.assignedCrewId !== "" || wo.isBlocked);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Milestone Progress
        </h2>
        <span className="text-xs text-slate-600">
          {visible.length} order{visible.length !== 1 ? "s" : ""}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-slate-500">
          No active work orders.
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((wo) => (
            <WorkOrderRow key={wo.id} workOrder={wo} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkOrderRow({ workOrder: wo }: { workOrder: LiveWorkOrder }) {
  const currentIndex = MILESTONE_ORDER.indexOf(wo.milestone);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-300">
              {wo.jobNumber}
            </span>
            {wo.isBlocked && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-xs text-red-300">
                <AlertTriangle className="h-2.5 w-2.5" />
                Blocked
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500">{wo.customer}</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-slate-400">
          {MILESTONE_LABELS[wo.milestone]}
        </span>
      </div>

      {/* Milestone pip track */}
      <MilestonePips currentIndex={currentIndex} isBlocked={wo.isBlocked} />
    </div>
  );
}

function MilestonePips({
  currentIndex,
  isBlocked,
}: {
  currentIndex: number;
  isBlocked: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {MILESTONE_ORDER.map((milestone: WorkOrderMilestone, index: number) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        const label = MILESTONE_LABELS[milestone];

        const pipClass = isDone
          ? "bg-blue-500 border-blue-500/50"
          : isCurrent
            ? isBlocked
              ? "bg-red-500/40 border-red-500/50 ring-1 ring-red-500/30"
              : "bg-blue-400/60 border-blue-400/50 ring-1 ring-blue-400/20"
            : "bg-white/[0.05] border-white/10";

        return (
          <div key={milestone} className="group relative flex-1" title={label}>
            {/* Connector line (not for last) */}
            {index < MILESTONE_ORDER.length - 1 && (
              <div
                className={[
                  "absolute left-1/2 top-1/2 h-px w-full -translate-y-1/2",
                  isDone ? "bg-blue-500/40" : "bg-white/[0.06]",
                ].join(" ")}
              />
            )}
            <div
              className={[
                "relative mx-auto flex h-3 w-3 rounded-full border transition-all",
                pipClass,
              ].join(" ")}
            >
              {isDone && (
                <CheckCircle2 className="absolute -right-1 -top-1 h-2.5 w-2.5 text-blue-400 opacity-0 group-hover:opacity-100" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
