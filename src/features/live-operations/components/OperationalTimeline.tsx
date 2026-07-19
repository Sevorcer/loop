import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  Package,
  Shield,
  Truck,
  Zap,
} from "lucide-react";

import type { OperationalEvent, OperationalEventType } from "../types/liveOps";

/** Maximum number of events shown in the timeline. Keeps the display focused. */
const MAX_TIMELINE_EVENTS = 12;

interface OperationalTimelineProps {
  events: OperationalEvent[];
}

const eventTypeIcon: Record<OperationalEventType, React.ReactNode> = {
  operations_started: <Zap className="h-3.5 w-3.5 text-green-300" />,
  crew_dispatched: <Truck className="h-3.5 w-3.5 text-blue-300" />,
  crew_en_route: <Truck className="h-3.5 w-3.5 text-blue-300" />,
  crew_arrived: <CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" />,
  milestone_advanced: <Activity className="h-3.5 w-3.5 text-indigo-300" />,
  customer_delay: <AlertTriangle className="h-3.5 w-3.5 text-red-300" />,
  material_delivered: <Package className="h-3.5 w-3.5 text-emerald-300" />,
  permit_issue: <Shield className="h-3.5 w-3.5 text-red-300" />,
  eta_slip: <AlertTriangle className="h-3.5 w-3.5 text-yellow-300" />,
  crew_delayed: <AlertTriangle className="h-3.5 w-3.5 text-yellow-300" />,
  blocker_resolved: <CheckCircle2 className="h-3.5 w-3.5 text-green-300" />,
  job_completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-300" />,
  // Inventory domain events — observed by Live Operations
  materials_reserved: <Package className="h-3.5 w-3.5 text-blue-300" />,
  parts_picked: <Package className="h-3.5 w-3.5 text-blue-300" />,
  truck_loaded: <Truck className="h-3.5 w-3.5 text-emerald-300" />,
  missing_equipment: <AlertTriangle className="h-3.5 w-3.5 text-red-300" />,
  backorder_created: <AlertTriangle className="h-3.5 w-3.5 text-yellow-300" />,
  emergency_part_delivered: <Package className="h-3.5 w-3.5 text-emerald-300" />,
};

const severityDot: Record<OperationalEvent["severity"], string> = {
  info: "border-white/20 bg-white/[0.06]",
  warning: "border-yellow-500/30 bg-yellow-500/[0.08]",
  critical: "border-red-500/30 bg-red-500/[0.08]",
};

const severityConnector: Record<OperationalEvent["severity"], string> = {
  info: "bg-white/[0.08]",
  warning: "bg-yellow-500/20",
  critical: "bg-red-500/25",
};

export function OperationalTimeline({ events }: OperationalTimelineProps) {
  // Reverse for newest-first display
  const displayed = [...events].reverse().slice(0, MAX_TIMELINE_EVENTS);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Operational Timeline
        </h2>
        <span className="text-xs text-slate-600">{events.length} events</span>
      </div>

      {displayed.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-slate-500">
          No events recorded yet.
        </div>
      ) : (
        <ol className="space-y-0">
          {displayed.map((event, index) => {
            const isLast = index === displayed.length - 1;
            return (
              <li key={event.id} className="flex gap-3">
                {/* Timeline spine */}
                <div className="flex flex-col items-center">
                  <div
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                      severityDot[event.severity],
                    ].join(" ")}
                  >
                    {eventTypeIcon[event.type] ?? (
                      <Info className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={[
                        "mt-0.5 w-px flex-1",
                        severityConnector[event.severity],
                      ].join(" ")}
                      style={{ minHeight: "16px" }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug text-slate-200">
                      {event.title}
                    </p>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-slate-600">
                      {event.timeLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    {event.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
