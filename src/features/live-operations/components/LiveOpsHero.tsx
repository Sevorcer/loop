import {
  Activity,
  AlertTriangle,
  Clock,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

import type { LiveOpsHeroMetrics, OperationalHealthSummary } from "../types/liveOps";
import { ROUTES } from "@/lib/routes";
import { formatStartTime } from "@/features/daily-plans/utils/planUtils";

interface LiveOpsHeroProps {
  date: string;
  startedAt: string;
  metrics: LiveOpsHeroMetrics;
  health: OperationalHealthSummary;
}

const healthColors: Record<string, { ring: string; bg: string; dot: string; text: string }> = {
  healthy: {
    ring: "border-green-500/25",
    bg: "bg-green-500/[0.06]",
    dot: "bg-green-400",
    text: "text-green-300",
  },
  minor_issues: {
    ring: "border-yellow-500/25",
    bg: "bg-yellow-500/[0.05]",
    dot: "bg-yellow-400",
    text: "text-yellow-300",
  },
  needs_attention: {
    ring: "border-orange-500/30",
    bg: "bg-orange-500/[0.06]",
    dot: "bg-orange-400",
    text: "text-orange-300",
  },
  critical: {
    ring: "border-red-500/30",
    bg: "bg-red-500/[0.07]",
    dot: "bg-red-400",
    text: "text-red-300",
  },
};

export function LiveOpsHero({
  date,
  startedAt,
  metrics,
  health,
}: LiveOpsHeroProps) {
  const colors = healthColors[health.state] ?? healthColors.healthy;

  const startLabel = formatStartTime(startedAt);
  const today = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className={[
        "rounded-3xl border p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all duration-500 sm:p-6",
        colors.ring,
        colors.bg,
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:gap-6 xl:flex-row xl:items-start xl:justify-between">
        {/* Left: identity + health */}
        <div className="space-y-3 sm:space-y-4">
          {/* Status badge */}
          <div className="hidden items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300 sm:inline-flex">
            <Activity className="h-3.5 w-3.5" />
            Live Operations
          </div>

          {/* Title */}
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">
              Day in Progress
            </h1>
            <p className="mt-0.5 text-xs text-slate-400 sm:mt-1 sm:text-sm sm:leading-6">
              {today} · Started at {startLabel}
            </p>
          </div>

          {/* Health pill */}
          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold",
                colors.ring,
                colors.text,
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-2 w-2 rounded-full",
                  colors.dot,
                  health.state !== "healthy" ? "animate-pulse" : "",
                ].join(" ")}
              />
              {health.label}
            </span>
            {health.reasons.length > 0 && (
              <span className="hidden text-sm text-slate-500 sm:inline">
                ·{" "}
                {health.reasons.join(" · ")}
              </span>
            )}
          </div>
        </div>

        {/* Right: stat tiles */}
        <div className="flex flex-wrap gap-2 sm:gap-3 xl:justify-end">
          <StatTile
            icon={<Users className="h-4 w-4 text-blue-300" />}
            value={metrics.activeCrews}
            label="Active Crews"
          />
          <StatTile
            icon={<Zap className="h-4 w-4 text-indigo-300" />}
            value={metrics.jobsRunning}
            label="Jobs Running"
          />
          {metrics.delays > 0 && (
            <StatTile
              icon={<Clock className="h-4 w-4 text-yellow-300" />}
              value={metrics.delays}
              label={metrics.delays === 1 ? "Delay" : "Delays"}
              highlight="warning"
            />
          )}
          {metrics.criticalIssues > 0 && (
            <StatTile
              icon={<AlertTriangle className="h-4 w-4 text-red-300" />}
              value={metrics.criticalIssues}
              label={metrics.criticalIssues === 1 ? "Needs Attention" : "Critical Issues"}
              highlight="critical"
            />
          )}
        </div>
      </div>

      {/* Footer: last update + return link */}
      {metrics.lastEventTimeLabel && (
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 sm:mt-5 sm:pt-4">
          <p className="text-xs text-slate-500">
            Last update · {metrics.lastEventTimeLabel}
          </p>
          <Link
            href={ROUTES.DAILY_PLANS}
            className="text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            ← Morning Operations
          </Link>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Internal stat tile
// ------------------------------------------------------------------

interface StatTileProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  highlight?: "warning" | "critical";
}

function StatTile({ icon, value, label, highlight }: StatTileProps) {
  const borderColor = highlight === "critical"
    ? "border-red-500/25"
    : highlight === "warning"
      ? "border-yellow-500/20"
      : "border-white/10";

  const bgColor = highlight === "critical"
    ? "bg-red-500/[0.07]"
    : highlight === "warning"
      ? "bg-yellow-500/[0.05]"
      : "bg-white/[0.04]";

  const valueColor = highlight === "critical"
    ? "text-red-300"
    : highlight === "warning"
      ? "text-yellow-200"
      : "text-white";

  return (
    <div
      className={[
        "flex min-w-[96px] flex-col items-center gap-1 rounded-2xl border px-4 py-3",
        borderColor,
        bgColor,
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={["text-xl font-bold tabular-nums leading-none", valueColor].join(" ")}>
          {value}
        </span>
      </div>
      <span className="text-center text-xs text-slate-400">{label}</span>
    </div>
  );
}
