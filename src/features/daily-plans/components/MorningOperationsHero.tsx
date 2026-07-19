"use client";

import { useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock,
  Printer,
  Rocket,
  ShieldAlert,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import type { DailyPlanStatus, MorningAlert, MorningDashboardMetrics } from "../types/dailyPlan";
import { formatPlanDate, getDayLabel, getReadinessStatus } from "../utils/planUtils";
import { ActivationDialog } from "./ActivationDialog";
import { DayNavigator } from "./DayNavigator";

interface MorningOperationsHeroProps {
  date: string;
  status: DailyPlanStatus;
  startedAt: string | null;
  metrics: MorningDashboardMetrics;
  alerts: MorningAlert[];
  blockerCount: number;
  onActivate: () => void;
  onPrintPackets: () => void;
}

function formatStartTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function MorningOperationsHero({
  date,
  status,
  startedAt,
  metrics,
  alerts,
  blockerCount,
  onActivate,
  onPrintPackets,
}: MorningOperationsHeroProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const readinessStatus = getReadinessStatus(metrics.readinessScore);
  const isActive = status === "active";
  const criticalAlerts = alerts.filter((a) => a.severity === "critical");

  const handleStartClick = () => {
    setDialogOpen(true);
  };

  const handleConfirm = () => {
    setDialogOpen(false);
    onActivate();
  };

  const handleCancel = () => {
    setDialogOpen(false);
  };

  return (
    <>
      <ActivationDialog
        open={dialogOpen}
        blockerCount={blockerCount}
        alertCount={alerts.length}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <div
        className={[
          "rounded-3xl border p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all duration-500",
          isActive
            ? "border-green-500/20 bg-gradient-to-br from-green-500/[0.06] to-white/[0.02]"
            : "border-white/10 bg-white/[0.04]",
        ].join(" ")}
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          {/* Left: Branding + readiness */}
          <div className="space-y-4">
            {/* Status label */}
            <div
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                isActive
                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                  : "border-blue-500/20 bg-blue-500/10 text-blue-300",
              ].join(" ")}
            >
              {isActive ? (
                <Activity className="h-3.5 w-3.5" />
              ) : (
                <CalendarDays className="h-3.5 w-3.5" />
              )}
              {isActive ? "Operations Underway" : "Morning Operations"}
            </div>

            {/* Title row */}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {isActive ? "Day in Progress" : getDayLabel(date)}
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {isActive
                  ? formatPlanDate(date)
                  : `Preparing operations for ${formatPlanDate(date)}`}
              </p>
            </div>

            {/* Active: started timestamp + handoff cue */}
            {isActive && startedAt ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/[0.06] px-3 py-2">
                  <Clock className="h-3.5 w-3.5 text-green-300" />
                  <span className="text-xs font-medium text-green-200">
                    Started at {formatStartTime(startedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2">
                  <Zap className="h-3.5 w-3.5 text-indigo-300" />
                  <span className="text-xs font-medium text-indigo-200">
                    Live Operations — coming soon
                  </span>
                </div>
              </div>
            ) : null}

            {/* Planning: readiness summary */}
            {!isActive ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className={["text-2xl font-bold tabular-nums", readinessStatus.color].join(" ")}>
                    {metrics.readinessScore}
                    <span className="text-sm font-normal text-slate-500">/100</span>
                  </span>
                  <span className={["text-sm font-semibold", readinessStatus.color].join(" ")}>
                    {readinessStatus.label}
                  </span>
                </div>

                {blockerCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-200">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
                  </span>
                ) : criticalAlerts.length === 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    No blockers
                  </span>
                ) : null}

                {criticalAlerts.length > 0 && blockerCount === 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-200">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {criticalAlerts.length} critical alert{criticalAlerts.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Right: Navigator + actions */}
          <div className="flex flex-col gap-4 xl:items-end">
            <DayNavigator />

            {isActive ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={onPrintPackets}
                  className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print packets
                </Button>
                <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-2">
                  <Activity className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-xs font-semibold text-green-300">Operations active</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={onPrintPackets}
                  className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print packets
                </Button>
                <Button
                  onClick={handleStartClick}
                  className={[
                    "h-9 gap-2 rounded-xl px-4 text-sm font-semibold transition-all",
                    blockerCount > 0
                      ? "border border-yellow-500/30 bg-yellow-500/15 text-yellow-100 hover:bg-yellow-500/25"
                      : "bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:bg-green-500 hover:shadow-[0_0_24px_rgba(34,197,94,0.3)]",
                  ].join(" ")}
                >
                  <Rocket className="h-3.5 w-3.5" />
                  Start today&apos;s operations
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Active state: readiness bar at the bottom for reference */}
        {isActive && (
          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Launch readiness at start
              </span>
              <span className={["text-sm font-semibold", readinessStatus.color].join(" ")}>
                {metrics.readinessScore}/100 — {readinessStatus.label}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
