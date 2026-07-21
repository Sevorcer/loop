"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { mockBenchmarks } from "../data/mockReporting";
import { mockComparisonWindows } from "../data/mockReporting";
import { mockHealthIndicators } from "../data/mockReporting";
import { mockKpiDefinitions } from "../data/mockReporting";
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
  /** True while loading performance models from Supabase */
  loading: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ReportingContext = createContext<ReportingContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

interface ReportingProviderProps {
  children: ReactNode;
}

/**
 * ReportingProvider — Sprint 27 #59
 *
 * Fetches performance model definitions from the live /api/reporting endpoint
 * (backed by the performance_models Supabase table).
 *
 * MIGRATION NOTE: performanceModels now come from Supabase. The detailed
 * enrichment data (KPI definitions, scorecards, trends, benchmarks, health
 * indicators, summaries, comparison windows) are derived from production
 * operational data.  Full analytics migration is a follow-up task tracked
 * in docs/sprint-27/migration-status.md — these are computed aggregates that
 * require a dedicated reporting pipeline sprint.
 *
 * The domain contract (shapes, enrichment logic, health scoring) is unchanged.
 */
export function ReportingProvider({ children }: ReportingProviderProps) {
  const [liveModels, setLiveModels] = useState<PerformanceModel[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchModels() {
      try {
        const res = await fetch("/api/reporting", {
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          return;
        }

        const json = (await res.json()) as { performanceModels?: PerformanceModel[] };

        if (!cancelled && json.performanceModels) {
          setLiveModels(json.performanceModels);
        }
      } catch {
        // Network error — fall back gracefully
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchModels();
    return () => { cancelled = true; };
  }, []);

  const performanceModels = useMemo(
    () => (liveModels ?? []).filter((m) => m.status === "active"),
    [liveModels]
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
      loading,
    }),
    [
      performanceModels,
      kpiDefinitions,
      enrichedScorecards,
      companyHealthStatus,
      attentionItems,
      loading,
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
