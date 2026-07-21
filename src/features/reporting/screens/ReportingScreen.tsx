"use client";

import { BarChart3 } from "lucide-react";

import { EmptyState, ErrorState, LoadingState, PageHeader, SectionCard } from "@/components/atlas";

import { HealthIndicatorCard } from "../components/HealthIndicatorCard";
import { ScorecardSection } from "../components/ScorecardSection";
import { useReporting } from "../state/ReportingProvider";
import { resolveReportingUiState } from "../utils/uiState";

function CompanyHealthBanner({
  status,
  attentionCount,
}: {
  status: string;
  attentionCount: number;
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string; label: string }> = {
    healthy: {
      bg: "bg-emerald-500/[0.08]",
      border: "border-emerald-500/20",
      text: "text-emerald-200",
      label: "Healthy",
    },
    improving: {
      bg: "bg-blue-500/[0.08]",
      border: "border-blue-500/20",
      text: "text-blue-200",
      label: "Improving",
    },
    "at-risk": {
      bg: "bg-amber-500/[0.08]",
      border: "border-amber-500/20",
      text: "text-amber-200",
      label: "At Risk",
    },
    deteriorating: {
      bg: "bg-red-500/[0.08]",
      border: "border-red-500/20",
      text: "text-red-200",
      label: "Deteriorating",
    },
  };

  const colors = colorMap[status] ?? colorMap["healthy"];

  return (
    <div
      className={[
        "flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5",
        colors.bg,
        colors.border,
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <BarChart3 className={["h-5 w-5", colors.text].join(" ")} />
        <div>
          <p className={["text-sm font-semibold", colors.text].join(" ")}>
            Company Health: {colors.label}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Aggregated across all active performance models
          </p>
        </div>
      </div>
      {attentionCount > 0 ? (
        <div className="rounded-full border border-amber-500/20 bg-amber-500/[0.12] px-3 py-1 text-xs font-medium text-amber-200">
          {attentionCount} item{attentionCount !== 1 ? "s" : ""} require attention
        </div>
      ) : null}
    </div>
  );
}

export function ReportingScreen() {
  const {
    enrichedScorecards,
    healthIndicators,
    companyHealthStatus,
    attentionItemCount,
    performanceModels,
    loading,
    error,
  } = useReporting();

  const uiState = resolveReportingUiState({
    loading,
    error,
    modelCount: performanceModels.length,
  });

  if (uiState === "loading") {
    return <LoadingState message="Loading reporting models..." />;
  }

  if (uiState === "error") {
    return (
      <ErrorState
        title="Unable to load Reporting"
        description={
          error ?? "We couldn't load reporting models right now. Please try again shortly."
        }
      />
    );
  }

  if (uiState === "empty") {
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        <PageHeader
          title="Performance Intelligence"
          description="How is the company performing over time, and what patterns require attention?"
        />
        <EmptyState
          title="No active performance models"
          description="Reporting models will appear here after they are configured."
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <PageHeader
        title="Performance Intelligence"
        description="How is the company performing over time, and what patterns require attention?"
      />

      {/* Company Health Banner */}
      <CompanyHealthBanner
        status={companyHealthStatus}
        attentionCount={attentionItemCount}
      />

      {/* Health Indicators Grid */}
      <SectionCard
        title="Operational Health"
        description="Derived health signals across operational domains. Each indicator interprets recent performance, not just current state."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {healthIndicators.map((indicator) => (
            <HealthIndicatorCard key={indicator.id} indicator={indicator} />
          ))}
        </div>
      </SectionCard>

      {/* Scorecards */}
      {enrichedScorecards.map((enriched) => (
        <SectionCard key={enriched.scorecard.id} title={enriched.scorecard.title}>
          <ScorecardSection enrichedScorecard={enriched} />
        </SectionCard>
      ))}

      {/* Performance Models Summary */}
      <SectionCard
        title="Active Performance Models"
        description="The canonical performance models that define how LOOP measures, compares, and interprets operational health."
      >
        <div className="space-y-3">
          {performanceModels.map((model) => (
            <div
              key={model.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-white">
                  {model.title}
                </p>
                <p className="text-xs text-slate-400">{model.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {model.relatedDomains.map((domain) => (
                    <span
                      key={domain}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-300"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-left sm:ml-4 sm:text-right">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.12] px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-200">
                  {model.status}
                </span>
                <p className="mt-1 text-xs capitalize text-slate-500">
                  {model.scope} · {model.owner}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Domain Boundary Note */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Domain Boundary
        </p>
        <p className="text-sm leading-relaxed text-slate-300">
          Reporting interprets operational truth — it does not own it. Performance intelligence
          is derived from Morning Operations, Dispatch, Live Operations, and Inventory data.
          Operational facts remain in their source domains.
        </p>
      </div>
    </div>
  );
}
