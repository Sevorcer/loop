"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { mockBenchmarks } from "../data/mockReporting";
import { mockComparisonWindows } from "../data/mockReporting";
import { mockHealthIndicators } from "../data/mockReporting";
import { mockKpiDefinitions } from "../data/mockReporting";
import { mockPerformanceModels } from "../data/mockReporting";
import { mockPerformanceSummaries } from "../data/mockReporting";
import { mockScorecards } from "../data/mockReporting";
import { mockTrends } from "../data/mockReporting";
import type {
  Benchmark,
  ComparisonWindow,
  EnrichedScorecard,
  HealthIndicator,
  HealthStatus,
  KpiDefinition,
  PerformanceModel,
  PerformanceSummary,
  Scorecard,
  Trend,
} from "../types/reporting";
import {
  aggregateHealthStatus,
  attentionCount,
  enrichScorecard,
} from "../utils/reportingUtils";

// ─── Context Shape ────────────────────────────────────────────────────────────

interface ReportingContextValue {
  /** All active performance models */
  performanceModels: PerformanceModel[];
  /** All KPI definitions */
  kpiDefinitions: KpiDefinition[];
  /** All trends */
  trends: Trend[];
  /** All benchmarks */
  benchmarks: Benchmark[];
  /** All scorecards */
  scorecards: Scorecard[];
  /** All health indicators */
  healthIndicators: HealthIndicator[];
  /** All performance summaries */
  performanceSummaries: PerformanceSummary[];
  /** All comparison windows */
  comparisonWindows: ComparisonWindow[];

  /** Fully enriched scorecards — the primary consumption surface */
  enrichedScorecards: EnrichedScorecard[];
  /** Aggregated company health status across all active models */
  companyHealthStatus: HealthStatus;
  /** Number of indicators that require attention */
  attentionItemCount: number;
  /** Health indicators flagged as requiring management attention */
  attentionItems: HealthIndicator[];
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ReportingContext = createContext<ReportingContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface ReportingProviderProps {
  children: ReactNode;
}

/**
 * ReportingProvider is the state layer for the Reporting domain.
 *
 * It derives performance intelligence from canonical mock data and exposes
 * enriched scorecards, health status, and attention items to the UI.
 *
 * In production this would consume data from operational domain APIs,
 * but the domain contract (shapes, enrichment logic, health scoring) remains
 * identical regardless of data source.
 */
export function ReportingProvider({ children }: ReportingProviderProps) {
  const performanceModels = useMemo(
    () => mockPerformanceModels.filter((m) => m.status === "active"),
    []
  );

  const kpiDefinitions = useMemo(
    () => mockKpiDefinitions.filter((k) => k.status === "active"),
    []
  );

  const enrichedScorecards = useMemo(() => {
    return mockScorecards
      .filter((sc) => sc.status === "active")
      .map((sc) => {
        const model = performanceModels.find(
          (m) => m.id === sc.performanceModelId
        );
        if (!model) return null;
        return enrichScorecard(
          sc,
          model,
          kpiDefinitions,
          mockTrends,
          mockBenchmarks,
          mockHealthIndicators,
          mockPerformanceSummaries
        );
      })
      .filter((sc): sc is EnrichedScorecard => sc !== null);
  }, [performanceModels, kpiDefinitions]);

  const companyHealthStatus = useMemo(
    () => aggregateHealthStatus(mockHealthIndicators),
    []
  );

  const attentionItems = useMemo(
    () => mockHealthIndicators.filter((h) => h.requiresAttention),
    []
  );

  const value = useMemo<ReportingContextValue>(
    () => ({
      performanceModels,
      kpiDefinitions,
      trends: mockTrends,
      benchmarks: mockBenchmarks,
      scorecards: mockScorecards,
      healthIndicators: mockHealthIndicators,
      performanceSummaries: mockPerformanceSummaries,
      comparisonWindows: mockComparisonWindows,
      enrichedScorecards,
      companyHealthStatus,
      attentionItemCount: attentionCount(mockHealthIndicators),
      attentionItems,
    }),
    [
      performanceModels,
      kpiDefinitions,
      enrichedScorecards,
      companyHealthStatus,
      attentionItems,
    ]
  );

  return (
    <ReportingContext.Provider value={value}>
      {children}
    </ReportingContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useReporting(): ReportingContextValue {
  const ctx = useContext(ReportingContext);
  if (!ctx) {
    throw new Error("useReporting must be used within a ReportingProvider");
  }
  return ctx;
}
