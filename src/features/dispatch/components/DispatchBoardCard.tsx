"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  XCircle,
} from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";

import type { DispatchPlan } from "../types/dispatch";
import {
  formatTargetDate,
  getDispatchStatusLabel,
} from "../utils/dispatchUtils";

interface DispatchBoardCardProps {
  plan: DispatchPlan;
  crewName?: string;
}

const statusVariant = {
  ready_to_schedule: "success",
  scheduled: "info",
  in_progress: "active",
  awaiting_materials: "blocked",
  awaiting_technical_readiness: "blocked",
  awaiting_customer_confirmation: "warning",
  awaiting_crew_availability: "warning",
  completed: "neutral",
} as const;

type Variant = "success" | "info" | "active" | "blocked" | "warning" | "neutral";

const variantStyles: Record<Variant, { badge: string; icon: string }> = {
  success: {
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    icon: "text-emerald-400",
  },
  info: {
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    icon: "text-blue-400",
  },
  active: {
    badge: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    icon: "text-violet-400",
  },
  blocked: {
    badge: "border-red-500/20 bg-red-500/10 text-red-300",
    icon: "text-red-400",
  },
  warning: {
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    icon: "text-amber-400",
  },
  neutral: {
    badge: "border-slate-700 bg-white/5 text-slate-400",
    icon: "text-slate-500",
  },
};

function StatusIcon({ variant }: { variant: Variant }) {
  const cls = `h-4 w-4 ${variantStyles[variant].icon}`;
  switch (variant) {
    case "success":
    case "info":
      return <CheckCircle2 className={cls} />;
    case "active":
      return <Clock className={cls} />;
    case "blocked":
      return <XCircle className={cls} />;
    case "warning":
      return <AlertTriangle className={cls} />;
    default:
      return <CheckCircle2 className={cls} />;
  }
}

export function DispatchBoardCard({ plan, crewName }: DispatchBoardCardProps) {
  const variant: Variant =
    statusVariant[plan.dispatchStatus] ?? "neutral";
  const styles = variantStyles[variant];

  const blockingConstraints = plan.constraints.filter(
    (c) => c.severity === "blocking"
  );

  return (
    <SurfaceCard className="group transition-all duration-200 hover:border-white/20">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-slate-500">
                {plan.jobNumber}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${styles.badge}`}
              >
                <StatusIcon variant={variant} />
                {getDispatchStatusLabel(plan.dispatchStatus)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-500">
                {plan.jobType}
              </span>
            </div>

            <div className="mt-2">
              <p className="text-sm font-semibold text-white">
                {plan.customerName}
              </p>
              <p className="text-xs text-slate-400">{plan.propertyName}</p>
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <p className="text-xs font-medium text-slate-300">
              {formatTargetDate(plan.targetDate)}
            </p>
            <p className="text-xs text-slate-500">
              {plan.estimatedDurationHours}h estimated
            </p>
          </div>
        </div>

        {/* Readiness indicators */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <ReadinessChip
            label="Materials"
            state={plan.dispatchability.materialReadiness.state}
          />
          <ReadinessChip
            label="Technical"
            state={plan.dispatchability.technicalReadiness.state}
          />
          <ReadinessChip
            label="Customer"
            state={plan.dispatchability.customerReadiness.state}
          />
          <ReadinessChip
            label="Crew"
            state={plan.dispatchability.crewReadiness.state}
          />
        </div>

        {/* Crew assignment or blocker */}
        <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-4 flex-wrap">
          {crewName ? (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Users className="h-3.5 w-3.5 text-slate-500" />
              {crewName}
            </span>
          ) : (
            <span className="text-xs text-slate-600">No crew assigned</span>
          )}

          {blockingConstraints.length > 0 && (
            <span className="ml-auto text-xs text-red-400">
              {blockingConstraints[0].label}
            </span>
          )}

          {plan.sequencingNotes && (
            <span
              className="ml-auto max-w-xs truncate text-xs text-slate-500"
              title={plan.sequencingNotes}
            >
              {plan.sequencingNotes}
            </span>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}

function ReadinessChip({
  label,
  state,
}: {
  label: string;
  state: "satisfied" | "attention_needed" | "not_satisfied";
}) {
  const styles =
    state === "satisfied"
      ? "border-emerald-500/15 bg-emerald-500/5 text-emerald-400"
      : state === "attention_needed"
        ? "border-amber-500/15 bg-amber-500/5 text-amber-400"
        : "border-red-500/15 bg-red-500/5 text-red-400";

  const dot =
    state === "satisfied"
      ? "bg-emerald-500"
      : state === "attention_needed"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="truncate">{label}</span>
    </div>
  );
}
