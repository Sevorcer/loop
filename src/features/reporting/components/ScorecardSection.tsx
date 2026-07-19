import type { EnrichedScorecard } from "../types/reporting";
import { KpiCard } from "./KpiCard";

interface ScorecardSectionProps {
  enrichedScorecard: EnrichedScorecard;
}

export function ScorecardSection({ enrichedScorecard }: ScorecardSectionProps) {
  const { scorecard, enrichedKpis, summary } = enrichedScorecard;

  return (
    <div className="space-y-5">
      {/* Scorecard Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            {scorecard.title}
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            {scorecard.audience}
          </span>
        </div>
        {scorecard.description ? (
          <p className="text-sm text-slate-500">{scorecard.description}</p>
        ) : null}
      </div>

      {/* Health Summary Narrative */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
          Interpretation
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">
          {scorecard.healthSummary}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {enrichedKpis.map((ek) => (
          <KpiCard key={ek.definition.id} enrichedKpi={ek} />
        ))}
      </div>

      {/* Action Items */}
      {scorecard.actionItems.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600 mb-3">
            Where Attention May Be Needed
          </p>
          <ul className="space-y-2">
            {scorecard.actionItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="mt-0.5 shrink-0 text-amber-500">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Performance Summary */}
      {summary ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">
              Period: {summary.period}
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {summary.headline}
            </p>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {summary.interpretation}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {summary.highlights.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">
                  What Improved
                </p>
                <ul className="space-y-1.5">
                  {summary.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {summary.concerns.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2">
                  What Requires Attention
                </p>
                <ul className="space-y-1.5">
                  {summary.concerns.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 shrink-0 text-amber-500">!</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
