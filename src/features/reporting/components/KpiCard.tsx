import type { EnrichedKpi } from "../types/reporting";
import {
  formatBenchmarkSummary,
  formatKpiValue,
  trendArrow,
} from "../utils/reportingUtils";

interface KpiCardProps {
  enrichedKpi: EnrichedKpi;
}

function getTrendColor(direction: string): string {
  if (direction === "improving") return "text-emerald-300";
  if (direction === "declining") return "text-red-300";
  return "text-slate-400";
}

function getHealthBorderColor(status: string): string {
  if (status === "healthy") return "border-l-emerald-400";
  if (status === "improving") return "border-l-blue-400";
  if (status === "at-risk") return "border-l-amber-400";
  if (status === "deteriorating") return "border-l-red-400";
  return "border-l-slate-500";
}

export function KpiCard({ enrichedKpi }: KpiCardProps) {
  const { definition, trend, benchmark, healthIndicator, currentValue } =
    enrichedKpi;

  const healthStatus = healthIndicator?.status ?? "healthy";
  const borderColor = getHealthBorderColor(healthStatus);

  return (
    <div
      className={[
        "rounded-2xl border border-white/10 bg-white/[0.03] p-5 border-l-4",
        borderColor,
      ].join(" ")}
    >
      {/* KPI Name & Purpose */}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {definition.sourceDomains.join(" · ")}
        </p>
        <h3 className="text-sm font-semibold text-white">
          {definition.name}
        </h3>
      </div>

      {/* Current Value */}
      <div className="mt-4 flex items-end justify-between">
        <p className="text-3xl font-bold text-white">
          {formatKpiValue(currentValue, definition)}
        </p>

        {trend ? (
          <div
            className={[
              "flex items-center gap-1 text-sm font-medium",
              getTrendColor(trend.direction),
            ].join(" ")}
          >
            <span className="text-base">{trendArrow(trend.direction)}</span>
            <span>{Math.abs(trend.rateOfChange).toFixed(1)}%</span>
          </div>
        ) : null}
      </div>

      {/* Trend velocity */}
      {trend ? (
        <p className="mt-1 text-xs capitalize text-slate-400">
          {trend.velocityLabel}
        </p>
      ) : null}

      {/* Benchmark comparison */}
      {benchmark ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-xs text-slate-400">
            {formatBenchmarkSummary(benchmark)}
          </p>
        </div>
      ) : null}

      {/* Interpretation */}
      {healthIndicator ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {healthIndicator.summary}
        </p>
      ) : null}
    </div>
  );
}
