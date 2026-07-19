"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Send,
  Users,
  XCircle,
} from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";

import { DispatchBoardCard } from "../components/DispatchBoardCard";
import { CrewScheduleCard } from "../components/CrewScheduleCard";
import { useDispatch } from "../state/DispatchProvider";
import type { DispatchPlan } from "../types/dispatch";
import { getCrewAssignmentForPlan, getDispatchBoardGroup, getLocalTodayISO } from "../utils/dispatchUtils";

// ------------------------------------------------------------------
// Board group definitions
// ------------------------------------------------------------------

const BOARD_GROUPS: {
  key: "active" | "ready" | "scheduled" | "blocked";
  label: string;
  emptyMessage: string;
}[] = [
  {
    key: "active",
    label: "In Progress",
    emptyMessage: "No jobs currently in progress.",
  },
  {
    key: "ready",
    label: "Ready to Schedule",
    emptyMessage: "No jobs ready to schedule.",
  },
  {
    key: "scheduled",
    label: "Scheduled",
    emptyMessage: "No jobs currently scheduled.",
  },
  {
    key: "blocked",
    label: "Waiting",
    emptyMessage: "No jobs waiting on conditions.",
  },
];

// ------------------------------------------------------------------
// Dispatch Screen
// ------------------------------------------------------------------

export function DispatchScreen() {
  const { snapshot } = useDispatch();
  const { metrics } = snapshot;

  const todayStr = getLocalTodayISO();
  const todayBlocks = snapshot.scheduleBlocks.filter(
    (b) => b.scheduledDate === todayStr
  );

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              <Send className="h-3.5 w-3.5" />
              Dispatch · Coordination
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Dispatch Planning
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Dispatch coordinates the right crew, at the right time, with the
                right work, using the right materials. A job becomes
                dispatchable only when all four readiness conditions are true:{" "}
                <span className="font-medium text-slate-200">
                  materials, technical truth, customer confirmation, and crew.
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={CheckCircle2}
              value={String(metrics.readyToSchedule)}
              label="Ready to schedule"
              variant="success"
            />
            <MetricCard
              icon={CalendarDays}
              value={String(metrics.scheduled)}
              label="Scheduled"
              variant="info"
            />
            <MetricCard
              icon={Clock}
              value={String(metrics.inProgress)}
              label="In progress"
              variant="active"
            />
            <MetricCard
              icon={AlertTriangle}
              value={String(
                metrics.awaitingMaterials +
                  metrics.awaitingCustomer +
                  metrics.awaitingCrew
              )}
              label="Waiting"
              variant="warning"
            />
          </div>
        </div>
      </SurfaceCard>

      {/* ── Architecture Note ── */}
      <SurfaceCard>
        <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[1.4fr_1fr]">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Dispatch Plan is the aggregate root
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Dispatch does not own jobs, materials, or installed systems — it
              coordinates them. A Dispatch Plan is the single source of
              scheduling truth. Crew Assignments, Schedule Blocks, and Dispatch
              Events all reference the Dispatch Plan, not each other. The
              calendar renders Dispatch Plans; it does not define them.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <ol className="space-y-2 text-sm text-slate-300">
              <li>1. Estimate accepted → job created</li>
              <li>2. Material + Technical + Customer readiness confirmed</li>
              <li>3. Dispatch Plan created</li>
              <li>4. Crew assigned → Schedule Block placed</li>
              <li>5. Crew dispatched → work begins</li>
            </ol>
          </div>
        </div>
      </SurfaceCard>

      {/* ── Dispatch Board ── */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Send className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">Dispatch Board</h3>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-slate-400">
            {snapshot.dispatchPlans.length} plans
          </span>
        </div>

        <DispatchBoard plans={snapshot.dispatchPlans} />
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
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-white">Recent Events</h3>
        </div>
        <DispatchEventLog />
      </div>

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
// Dispatch Board
// ------------------------------------------------------------------

function DispatchBoard({ plans }: { plans: DispatchPlan[] }) {
  const { snapshot } = useDispatch();

  return (
    <div className="space-y-6">
      {BOARD_GROUPS.map((group) => {
        const groupPlans = plans.filter(
          (p) => getDispatchBoardGroup(p.dispatchStatus) === group.key
        );

        return (
          <div key={group.key}>
            <div className="mb-3 flex items-center gap-2">
              <BoardGroupIcon groupKey={group.key} />
              <h4 className="text-sm font-semibold text-slate-300">
                {group.label}
              </h4>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-500">
                {groupPlans.length}
              </span>
            </div>

            {groupPlans.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-5 text-sm text-slate-600">
                {group.emptyMessage}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {groupPlans.map((plan) => {
                  const assignment = getCrewAssignmentForPlan(
                    snapshot.crewAssignments,
                    plan.id
                  );
                  return (
                    <DispatchBoardCard
                      key={plan.id}
                      plan={plan}
                      crewName={assignment?.crewName}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BoardGroupIcon({
  groupKey,
}: {
  groupKey: "active" | "ready" | "scheduled" | "blocked";
}) {
  switch (groupKey) {
    case "active":
      return <Clock className="h-4 w-4 text-violet-400" />;
    case "ready":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "scheduled":
      return <CalendarDays className="h-4 w-4 text-blue-400" />;
    case "blocked":
      return <XCircle className="h-4 w-4 text-amber-400" />;
  }
}

// ------------------------------------------------------------------
// Dispatch Event Log
// ------------------------------------------------------------------

function DispatchEventLog() {
  const { snapshot } = useDispatch();

  const recentEvents = [...snapshot.dispatchEvents]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8);

  return (
    <SurfaceCard>
      <div className="divide-y divide-white/5">
        {recentEvents.map((event) => {
          const plan = snapshot.dispatchPlans.find(
            (p) => p.id === event.dispatchPlanId
          );
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
                {plan && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {plan.jobNumber} · {plan.customerName}
                  </p>
                )}
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

function EventTypeIndicator({
  type,
}: {
  type: import("../types/dispatch").DispatchEventType;
}) {
  const colorMap: Record<typeof type, string> = {
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
