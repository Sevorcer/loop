// ─── Lifecycle ───────────────────────────────────────────────────────────────

export type PerformanceModelStatus = "draft" | "active" | "revised" | "retired";

// ─── Health ──────────────────────────────────────────────────────────────────

export type HealthStatus =
  | "healthy"
  | "improving"
  | "at-risk"
  | "deteriorating";

// ─── Trend ───────────────────────────────────────────────────────────────────

export type TrendDirection =
  | "improving"
  | "declining"
  | "stable"
  | "volatile";

// ─── Comparison Windows ──────────────────────────────────────────────────────

export type ComparisonWindowScope =
  | "today"
  | "this-week"
  | "last-7-days"
  | "month-to-date"
  | "quarter-to-date"
  | "custom";

// ─── Benchmark ───────────────────────────────────────────────────────────────

export type BenchmarkType =
  | "prior-period"
  | "company-average"
  | "team-average"
  | "target"
  | "location-baseline"
  | "expected-threshold";

// ─── KPI ─────────────────────────────────────────────────────────────────────

export type KpiUnits = "percent" | "count" | "ratio" | "score" | "minutes" | "days";

export type KpiThresholdDirection = "higher-is-better" | "lower-is-better";

export interface KpiThresholds {
  healthy: number;
  atRisk: number;
  deteriorating: number;
  direction: KpiThresholdDirection;
}

// ─── Domain Aggregate: PerformanceModel ──────────────────────────────────────

export type PerformanceModelScope =
  | "company"
  | "team"
  | "location"
  | "function";

export interface HealthScoringRule {
  kpiId: string;
  weight: number;
}

export interface BenchmarkConfig {
  defaultType: BenchmarkType;
  priorPeriodDays: number;
}

/**
 * PerformanceModel is the aggregate root of the Reporting domain.
 *
 * It is the canonical object that coordinates performance intelligence.
 * All KPI definitions, trends, benchmarks, scorecards, health indicators,
 * performance summaries, and comparison windows reference a performanceModelId.
 */
export interface PerformanceModel {
  id: string;
  title: string;
  description: string;
  owner: string;
  status: PerformanceModelStatus;
  scope: PerformanceModelScope;
  relatedDomains: string[];
  defaultComparisonWindow: ComparisonWindowScope;
  benchmarkConfig: BenchmarkConfig;
  healthScoringRules: HealthScoringRule[];
  createdAt: string;
  updatedAt: string;
}

// ─── KPI Definition ──────────────────────────────────────────────────────────

/**
 * Defines a single canonical metric.
 * A metric is not a label on a graph — it is a reusable business definition
 * with one authoritative home.
 */
export interface KpiDefinition {
  id: string;
  performanceModelId: string;
  name: string;
  purpose: string;
  formula: string;
  sourceDomains: string[];
  calculationRules: string;
  units: KpiUnits;
  thresholds: KpiThresholds;
  status: PerformanceModelStatus;
}

// ─── Trend ───────────────────────────────────────────────────────────────────

export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

/**
 * Represents metric movement over time.
 * A number without movement is weak intelligence.
 */
export interface Trend {
  id: string;
  performanceModelId: string;
  kpiId: string;
  direction: TrendDirection;
  periodStart: string;
  periodEnd: string;
  dataPoints: TrendDataPoint[];
  /** Percentage change over the period (positive = increasing, negative = decreasing) */
  rateOfChange: number;
  /** Human-readable velocity label: "slowly improving", "rapidly declining", etc. */
  velocityLabel: string;
  /** Contextual interpretation for management consumption */
  interpretation: string;
}

// ─── Benchmark ───────────────────────────────────────────────────────────────

/**
 * Performance only becomes meaningful when compared to something.
 */
export interface Benchmark {
  id: string;
  performanceModelId: string;
  kpiId: string;
  type: BenchmarkType;
  /** The reference value being compared against */
  comparisonValue: number;
  /** Label for the comparison (e.g. "Prior 30 days", "Company target") */
  comparisonLabel: string;
  /** Current metric value */
  currentValue: number;
  /** Absolute variance (positive = above benchmark, negative = below) */
  variance: number;
  /** Percentage variance */
  variancePercent: number;
  /** Human-readable interpretation */
  interpretation: string;
}

// ─── Scorecard ───────────────────────────────────────────────────────────────

/**
 * Groups meaningful performance signals into an operational summary.
 * A scorecard should explain what matters, what is healthy, what is
 * deteriorating, and where intervention may be needed.
 */
export interface Scorecard {
  id: string;
  performanceModelId: string;
  title: string;
  description: string;
  /** Intended audience: "Owner", "Manager", "Operations Leadership", etc. */
  audience: string;
  kpiIds: string[];
  /** High-level health narrative */
  healthSummary: string;
  /** Specific items requiring management attention */
  actionItems: string[];
  lastUpdated: string;
  status: PerformanceModelStatus;
}

// ─── Health Indicator ────────────────────────────────────────────────────────

/**
 * Derived operational health for an area of the business.
 * Health is interpreted, not merely measured.
 */
export interface HealthIndicator {
  id: string;
  performanceModelId: string;
  /** Optional reference to a specific KPI driving this health signal */
  kpiId?: string;
  /** Business area being assessed (e.g. "Morning Readiness", "Dispatch") */
  area: string;
  status: HealthStatus;
  /** One-sentence summary */
  summary: string;
  /** Supporting detail for management context */
  detail: string;
  requiresAttention: boolean;
  lastUpdated: string;
}

// ─── Performance Summary ─────────────────────────────────────────────────────

/**
 * Turns metrics and trends into concise business interpretation.
 * This is the intelligence layer — the part that explains the story.
 */
export interface PerformanceSummary {
  id: string;
  performanceModelId: string;
  /** Period label: "July 2026", "Week of July 14", etc. */
  period: string;
  /** Top-line narrative headline */
  headline: string;
  /** Full contextual interpretation */
  interpretation: string;
  /** What improved this period */
  highlights: string[];
  /** What deteriorated or requires attention */
  concerns: string[];
  generatedAt: string;
}

// ─── Comparison Window ───────────────────────────────────────────────────────

/**
 * Defines the time scope for a performance calculation.
 * Making time boundaries explicit ensures consistent measurement.
 */
export interface ComparisonWindow {
  id: string;
  performanceModelId: string;
  scope: ComparisonWindowScope;
  label: string;
  startDate: string;
  endDate: string;
  isDefault: boolean;
}

// ─── Derived / Computed Types ─────────────────────────────────────────────────

/**
 * A fully enriched KPI — the KPI definition plus its current calculated state
 * (trend, benchmark, health). Used in UI consumption.
 */
export interface EnrichedKpi {
  definition: KpiDefinition;
  trend: Trend | null;
  benchmark: Benchmark | null;
  healthIndicator: HealthIndicator | null;
  currentValue: number;
}

/**
 * A fully assembled scorecard including enriched KPIs and performance summary.
 */
export interface EnrichedScorecard {
  scorecard: Scorecard;
  performanceModel: PerformanceModel;
  enrichedKpis: EnrichedKpi[];
  summary: PerformanceSummary | null;
}
