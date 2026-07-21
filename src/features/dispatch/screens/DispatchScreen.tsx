import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Send,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";

import { CrewScheduleCard } from "../components/CrewScheduleCard";
import { DispatchJobBoard } from "../components/DispatchJobBoard";
import type { DispatchEvent, DispatchEventType, DispatchSnapshot } from "../types/dispatch";
import { getDispatchQueueMetrics, sortDispatchEvents } from "../utils/dispatchWorkspace";
import { getLocalTodayISO } from "../utils/dispatchUtils";

// ------------------------------------------------------------------
// Dispatch Screen
// ------------------------------------------------------------------

interface DispatchScreenProps {
  snapshot: DispatchSnapshot;
}

export function DispatchScreen({ snapshot }: DispatchScreenProps) {
  const todayStr = getLocalTodayISO();
  const todayBlocks = snapshot.scheduleBlocks.filter(
    (b) => b.scheduledDate === todayStr
  );
  const queueMetrics = getDispatchQueueMetrics(snapshot.metrics);

  const recentEvents = sortDispatchEvents(snapshot.dispatchEvents).slice(0, 8);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Hero ── */}
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="hidden items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200 sm:inline-flex">
              <Send className="h-3.5 w-3.5" />
              Dispatch · Coordination
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">
                Dispatch Board
              </h2>
              <p className="mt-1 hidden max-w-3xl text-sm leading-6 text-slate-400 sm:block">
                Live coordination queue for plan readiness, crew assignment,
                and schedule placement across operational work.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Clock}
              value={String(queueMetrics.active)}
              label="In progress"
              variant="active"
            />
            <MetricCard
              icon={CheckCircle2}
              value={String(queueMetrics.ready)}
              label="Ready"
              variant="success"
            />
            <MetricCard
              icon={CalendarDays}
              value={String(queueMetrics.scheduled)}
              label="Scheduled"
              variant="info"
            />
            <MetricCard
              icon={AlertTriangle}
              value={String(queueMetrics.blocked)}
              label="Blocked"
              variant="warning"
            />
          </div>
        </div>
      </SurfaceCard>

      {/* ── Dispatch Board ── */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Send className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">Dispatch Queue</h3>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-slate-400">
            {queueMetrics.total} plans
          </span>
        </div>

        <DispatchJobBoard initialSnapshot={snapshot} />
      </div>

      {/* ── Crew Schedule — Today ── */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Users className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">
            Crew Schedule — Today
          </h3>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-slate-400">
            {todayBlocks.length} blocks
          </span>
        </div>

        {todayBlocks.length === 0 ? (
          <SurfaceCard>
            <div className="p-8 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm text-slate-500">
                No schedule blocks for today.
              </p>
            </div>
          </SurfaceCard>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {todayBlocks.map((block) => (
              <CrewScheduleCard key={block.id} block={block} />
            ))}
          </div>
        )}
      </div>

      {/* ── Dispatch Events ── */}
      {recentEvents.length > 0 ? (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-400" />
            <h3 className="text-lg font-semibold text-white">Recent Events</h3>
          </div>
          <DispatchEventLog events={recentEvents} />
        </div>
      ) : (
        <EmptyState
          title="No dispatch events yet"
          description="Crew assignments, schedule changes, and dispatch coordination events will appear here."
          icon={<Clock className="h-5 w-5" />}
          className="border-white/10 bg-white/[0.02]"
        />
      )}

      {/* ── Dispatchability Model ── */}
      <SurfaceCard>
        <div className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white">
            Dispatchability Formula
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Dispatchability is derived from four independent readiness domains.
            Each domain explains a distinct reason why work can or cannot move.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReadinessDomain
              label="Material Readiness"
              source="Inventory"
              description="Equipment and materials reserved, picked, and loaded."
            />
            <ReadinessDomain
              label="Technical Readiness"
              source="Installed Systems"
              description="Installed system profile confirmed. Technical truth complete."
            />
            <ReadinessDomain
              label="Customer Readiness"
              source="Dispatch"
              description="Customer confirmed execution date, access, and appointment."
            />
            <ReadinessDomain
              label="Crew Readiness"
              source="Dispatch"
              description="Qualified crew with correct certifications is available."
            />
          </div>

          <div className="mt-5 rounded-2xl border border-blue-500/15 bg-blue-500/5 px-5 py-4">
            <p className="text-sm text-blue-300">
              <span className="font-semibold">Product Law:</span> Dispatch
              should only schedule work that is operationally ready. The calendar
              is a view of dispatch truth — not its source.
            </p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

// ------------------------------------------------------------------
// Dispatch Event Log
// ------------------------------------------------------------------

function DispatchEventLog({ events }: { events: DispatchEvent[] }) {
  return (
    <SurfaceCard>
      <div className="divide-y divide-white/5">
        {events.map((event) => {
          const time = new Date(event.timestamp).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          const date = new Date(event.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          return (
            <div key={event.id} className="flex items-start gap-4 p-4">
              <EventTypeIndicator type={event.type} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200">{event.description}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-slate-400">{time}</p>
                <p className="text-xs text-slate-600">{date}</p>
              </div>
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}

function EventTypeIndicator({ type }: { type: DispatchEventType }) {
  const colorMap: Record<DispatchEventType, string> = {
    job_scheduled: "bg-blue-500",
    crew_assigned: "bg-emerald-500",
    schedule_changed: "bg-amber-500",
    crew_dispatched: "bg-violet-500",
    job_rescheduled: "bg-orange-500",
    crew_delayed: "bg-red-500",
    dispatch_plan_created: "bg-slate-500",
  };

  return (
    <div
      className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${colorMap[type]}`}
    />
  );
}

// ------------------------------------------------------------------
// Readiness Domain Tile
// ------------------------------------------------------------------

function ReadinessDomain({
  label,
  source,
  description,
}: {
  label: string;
  source: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
        {source}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

// ------------------------------------------------------------------
// Metric Card
// ------------------------------------------------------------------

function MetricCard({
  icon: Icon,
  value,
  label,
  variant,
}: {
  icon: typeof CheckCircle2;
  value: string;
  label: string;
  variant: "success" | "info" | "active" | "warning" | "neutral";
}) {
  const iconColor =
    variant === "success"
      ? "text-emerald-300"
      : variant === "info"
        ? "text-blue-300"
        : variant === "active"
          ? "text-violet-300"
          : variant === "warning"
            ? "text-amber-300"
            : "text-slate-400";

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{value}</p>
    </div>
  );
}
