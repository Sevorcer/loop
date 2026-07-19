"use client";

import { BarChart3 } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/atlas";

import { HealthIndicatorCard } from "../components/HealthIndicatorCard";
import { ScorecardSection } from "../components/ScorecardSection";
import { useReporting } from "../state/ReportingProvider";

function CompanyHealthBanner({
  status,
  attentionCount,
}: {
  status: string;
  attentionCount: number;
}) {
  const colorMap: Record<string, { bg: string; border: string; text: string; label: string }> = {
    healthy: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-800",
      label: "Healthy",
    },
    improving: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800",
      label: "Improving",
    },
    "at-risk": {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-800",
      label: "At Risk",
    },
    deteriorating: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
      label: "Deteriorating",
    },
  };

  const colors = colorMap[status] ?? colorMap["healthy"];

  return (
    <div
      className={[
        "flex items-center justify-between rounded-xl border px-5 py-4",
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
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated across all active performance models
          </p>
        </div>
      </div>
      {attentionCount > 0 ? (
        <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
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
  } = useReporting();

  return (
    <div className="space-y-8">
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
        <SectionCard key={enriched.scorecard.id}>
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
              className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {model.title}
                </p>
                <p className="text-xs text-slate-500">{model.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {model.relatedDomains.map((domain) => (
                    <span
                      key={domain}
                      className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs text-slate-500"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-4 shrink-0 text-right">
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 capitalize">
                  {model.status}
                </span>
                <p className="mt-1 text-xs text-slate-400 capitalize">
                  {model.scope} · {model.owner}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Domain Boundary Note */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
          Domain Boundary
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Reporting interprets operational truth — it does not own it. Performance intelligence
          is derived from Morning Operations, Dispatch, Live Operations, and Inventory data.
          Operational facts remain in their source domains.
        </p>
      </div>
    </div>
  );
}
