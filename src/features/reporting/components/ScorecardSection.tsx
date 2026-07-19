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
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-white">
            {scorecard.title}
          </h2>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium text-slate-300">
            {scorecard.audience}
          </span>
        </div>
        {scorecard.description ? (
          <p className="text-sm text-slate-400">{scorecard.description}</p>
        ) : null}
      </div>

      {/* Health Summary Narrative */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Interpretation
        </p>
        <p className="text-sm leading-relaxed text-slate-300">
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
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-4 sm:px-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-amber-200">
            Where Attention May Be Needed
          </p>
          <ul className="space-y-2">
            {scorecard.actionItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-amber-100">
                <span className="mt-0.5 shrink-0 text-amber-300">→</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Performance Summary */}
      {summary ? (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4 sm:px-5">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Period: {summary.period}
            </p>
            <p className="text-sm font-semibold text-white">
              {summary.headline}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {summary.interpretation}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {summary.highlights.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-300">
                  What Improved
                </p>
                <ul className="space-y-1.5">
                  {summary.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                      <span className="mt-0.5 shrink-0 text-emerald-300">✓</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {summary.concerns.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-300">
                  What Requires Attention
                </p>
                <ul className="space-y-1.5">
                  {summary.concerns.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                      <span className="mt-0.5 shrink-0 text-amber-300">!</span>
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
