import type {
  HealthStatus,
  HealthIndicator,
  KpiDefinition,
  KpiThresholds,
  Trend,
  TrendDirection,
  Benchmark,
  EnrichedKpi,
  EnrichedScorecard,
  Scorecard,
  PerformanceModel,
  PerformanceSummary,
} from "../types/reporting";

// ─── Health Scoring ───────────────────────────────────────────────────────────

/**
 * Derives the health status of a KPI value given its thresholds.
 * Supports both "higher-is-better" and "lower-is-better" directions.
 */
export function deriveHealthStatus(
  value: number,
  thresholds: KpiThresholds
): HealthStatus {
  const { healthy, atRisk, direction } = thresholds;

  if (direction === "higher-is-better") {
    if (value >= healthy) return "healthy";
    if (value >= atRisk) return "at-risk";
    return "deteriorating";
  } else {
    // lower-is-better
    if (value <= healthy) return "healthy";
    if (value <= atRisk) return "at-risk";
    return "deteriorating";
  }
}

/**
 * Returns a display label for a health status.
 */
export function healthStatusLabel(status: HealthStatus): string {
  const labels: Record<HealthStatus, string> = {
    healthy: "Healthy",
    improving: "Improving",
    "at-risk": "At Risk",
    deteriorating: "Deteriorating",
  };
  return labels[status];
}

// ─── Trend Analysis ──────────────────────────────────────────────────────────

/**
 * Calculates the percentage change between two values.
 * Returns a positive number when increasing, negative when decreasing.
 */
export function calcRateOfChange(from: number, to: number): number {
  if (from === 0) return 0;
  return Number((((to - from) / Math.abs(from)) * 100).toFixed(1));
}

/**
 * Derives a trend direction from a rate of change and KPI direction.
 */
export function deriveTrendDirection(
  rateOfChange: number,
  kpiDirection: "higher-is-better" | "lower-is-better"
): TrendDirection {
  const absChange = Math.abs(rateOfChange);
  if (absChange < 2) return "stable";

  const isIncreasing = rateOfChange > 0;
  const isImproving =
    kpiDirection === "higher-is-better" ? isIncreasing : !isIncreasing;

  return isImproving ? "improving" : "declining";
}

/**
 * Returns a user-facing label for trend direction with icon character.
 */
export function trendDirectionLabel(direction: TrendDirection): string {
  const labels: Record<TrendDirection, string> = {
    improving: "↑ Improving",
    declining: "↓ Declining",
    stable: "→ Stable",
    volatile: "~ Volatile",
  };
  return labels[direction];
}

/**
 * Returns a concise arrow character for a trend direction.
 */
export function trendArrow(direction: TrendDirection): string {
  const arrows: Record<TrendDirection, string> = {
    improving: "↑",
    declining: "↓",
    stable: "→",
    volatile: "~",
  };
  return arrows[direction];
}

// ─── Benchmark Comparison ────────────────────────────────────────────────────

/**
 * Returns whether the current value is above, at, or below benchmark.
 */
export function benchmarkPosition(
  benchmark: Benchmark
): "above" | "at" | "below" {
  if (Math.abs(benchmark.variancePercent) < 1) return "at";
  return benchmark.variance > 0 ? "above" : "below";
}

/**
 * Returns a human-readable benchmark summary.
 * e.g. "4 pts below target (–4.5%)"
 */
export function formatBenchmarkSummary(benchmark: Benchmark): string {
  const sign = benchmark.variance >= 0 ? "+" : "";
  return `${sign}${benchmark.variance.toFixed(1)} vs ${benchmark.comparisonLabel} (${sign}${benchmark.variancePercent.toFixed(1)}%)`;
}

// ─── KPI Value Formatting ────────────────────────────────────────────────────

/**
 * Formats a KPI value with its units for display.
 */
export function formatKpiValue(value: number, kpi: KpiDefinition): string {
  switch (kpi.units) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "ratio":
      return value.toFixed(1);
    case "score":
      return value.toFixed(0);
    case "count":
      return value.toFixed(0);
    case "minutes":
      return `${value.toFixed(0)}m`;
    case "days":
      return `${value.toFixed(1)}d`;
    default:
      return value.toFixed(1);
  }
}

// ─── Enrichment ──────────────────────────────────────────────────────────────

/**
 * Enriches a KPI definition with its current trend, benchmark, and health.
 */
export function enrichKpi(
  kpi: KpiDefinition,
  trends: Trend[],
  benchmarks: Benchmark[],
  healthIndicators: HealthIndicator[]
): EnrichedKpi {
  const trend = trends.find((t) => t.kpiId === kpi.id) ?? null;
  const benchmark =
    benchmarks.find(
      (b) => b.kpiId === kpi.id && b.type === "target"
    ) ??
    benchmarks.find((b) => b.kpiId === kpi.id) ??
    null;
  const healthIndicator =
    healthIndicators.find((h) => h.kpiId === kpi.id) ?? null;

  const currentValue = trend
    ? trend.dataPoints[trend.dataPoints.length - 1]?.value ?? 0
    : benchmark?.currentValue ?? 0;

  return { definition: kpi, trend, benchmark, healthIndicator, currentValue };
}

/**
 * Assembles an enriched scorecard from raw domain data.
 */
export function enrichScorecard(
  scorecard: Scorecard,
  performanceModel: PerformanceModel,
  kpiDefinitions: KpiDefinition[],
  trends: Trend[],
  benchmarks: Benchmark[],
  healthIndicators: HealthIndicator[],
  summaries: PerformanceSummary[]
): EnrichedScorecard {
  const scopedKpis = kpiDefinitions.filter((k) =>
    scorecard.kpiIds.includes(k.id)
  );

  const enrichedKpis = scopedKpis.map((kpi) =>
    enrichKpi(kpi, trends, benchmarks, healthIndicators)
  );

  const summary =
    summaries.find((s) => s.performanceModelId === scorecard.performanceModelId) ??
    null;

  return { scorecard, performanceModel, enrichedKpis, summary };
}

// ─── Aggregated Health ────────────────────────────────────────────────────────

/**
 * Calculates an overall health status from a set of health indicators.
 * Priority: deteriorating > at-risk > improving > healthy
 */
export function aggregateHealthStatus(indicators: HealthIndicator[]): HealthStatus {
  if (indicators.some((i) => i.status === "deteriorating")) return "deteriorating";
  if (indicators.some((i) => i.status === "at-risk")) return "at-risk";
  if (indicators.some((i) => i.status === "improving")) return "improving";
  return "healthy";
}

/**
 * Returns the count of indicators requiring attention.
 */
export function attentionCount(indicators: HealthIndicator[]): number {
  return indicators.filter((i) => i.requiresAttention).length;
}
