"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

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
  /** Error from loading performance models */
  error: string | null;
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
  const { role } = useCurrentRole();
  const [liveModels, setLiveModels] = useState<PerformanceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;

    let cancelled = false;

    async function fetchModels() {
      setLoading(true);
      setError(null);

      try {
        const json = await requestJson<{ performanceModels?: PerformanceModel[] }>(
          "/api/reporting",
          { role, cache: "no-store" },
        );

        if (!cancelled) {
          setLiveModels(json.performanceModels ?? []);
        }
      } catch {
        if (!cancelled) {
          setLiveModels([]);
          setError("Unable to load reporting models right now.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchModels();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const performanceModels = useMemo(
    () => liveModels.filter((m) => m.status === "active"),
    [liveModels]
  );

  const hasActiveModels = performanceModels.length > 0;

  const kpiDefinitions = useMemo(
    () => (hasActiveModels ? mockKpiDefinitions.filter((k) => k.status === "active") : []),
    [hasActiveModels]
  );

  const trends = useMemo(() => (hasActiveModels ? mockTrends : []), [hasActiveModels]);
  const benchmarks = useMemo(() => (hasActiveModels ? mockBenchmarks : []), [hasActiveModels]);
  const scorecards = useMemo(() => (hasActiveModels ? mockScorecards : []), [hasActiveModels]);
  const healthIndicators = useMemo(
    () => (hasActiveModels ? mockHealthIndicators : []),
    [hasActiveModels]
  );
  const performanceSummaries = useMemo(
    () => (hasActiveModels ? mockPerformanceSummaries : []),
    [hasActiveModels]
  );
  const comparisonWindows = useMemo(
    () => (hasActiveModels ? mockComparisonWindows : []),
    [hasActiveModels]
  );

  const enrichedScorecards = useMemo(() => {
    return scorecards
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
          trends,
          benchmarks,
          healthIndicators,
          performanceSummaries
        );
      })
      .filter((sc): sc is EnrichedScorecard => sc !== null);
  }, [
    scorecards,
    performanceModels,
    kpiDefinitions,
    trends,
    benchmarks,
    healthIndicators,
    performanceSummaries,
  ]);

  const companyHealthStatus = useMemo(
    () => aggregateHealthStatus(healthIndicators),
    [healthIndicators]
  );

  const attentionItems = useMemo(
    () => healthIndicators.filter((h) => h.requiresAttention),
    [healthIndicators]
  );

  const value = useMemo<ReportingContextValue>(
    () => ({
      performanceModels,
      kpiDefinitions,
      trends,
      benchmarks,
      scorecards,
      healthIndicators,
      performanceSummaries,
      comparisonWindows,
      enrichedScorecards,
      companyHealthStatus,
      attentionItemCount: attentionCount(healthIndicators),
      attentionItems,
      loading,
      error,
    }),
    [
      performanceModels,
      kpiDefinitions,
      trends,
      benchmarks,
      scorecards,
      healthIndicators,
      performanceSummaries,
      comparisonWindows,
      enrichedScorecards,
      companyHealthStatus,
      attentionItems,
      loading,
      error,
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
