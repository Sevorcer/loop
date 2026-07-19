import { AlertTriangle, ChevronRight } from "lucide-react";

import type { OperationalEvent } from "../types/liveOps";

interface DecisionFeedProps {
  decisions: OperationalEvent[];
}

const urgencyConfig: Record<string, { border: string; bg: string; badge: string; badgeText: string }> = {
  critical: {
    border: "border-red-500/25",
    bg: "bg-red-500/[0.06]",
    badge: "bg-red-500/15 border-red-500/30 text-red-300",
    badgeText: "Decision Needed",
  },
  warning: {
    border: "border-yellow-500/20",
    bg: "bg-yellow-500/[0.05]",
    badge: "bg-yellow-500/15 border-yellow-500/25 text-yellow-300",
    badgeText: "Decision Needed",
  },
};

function getConfig(severity: OperationalEvent["severity"]) {
  return urgencyConfig[severity] ?? urgencyConfig.warning;
}

export function DecisionFeed({ decisions }: DecisionFeedProps) {
  if (decisions.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <SectionLabel count={0} />
        <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-center">
          <p className="text-sm font-medium text-slate-400">No decisions pending</p>
          <p className="mt-1 text-xs text-slate-600">All active situations are being monitored.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <SectionLabel count={decisions.length} />

      <div className="mt-4 space-y-3">
        {decisions.map((event) => {
          const cfg = getConfig(event.severity);
          return (
            <div
              key={event.id}
              className={[
                "rounded-2xl border p-4",
                cfg.border,
                cfg.bg,
              ].join(" ")}
            >
              {/* Badge + time */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    cfg.badge,
                  ].join(" ")}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {cfg.badgeText}
                </span>
                <span className="text-xs text-slate-600">{event.timeLabel}</span>
              </div>

              {/* Title */}
              <p className="mt-2 text-sm font-semibold text-white">{event.title}</p>

              {/* Description */}
              <p className="mt-1 text-xs leading-5 text-slate-400">{event.description}</p>

              {/* Options */}
              {event.decisionOptions && event.decisionOptions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {event.decisionOptions.map((option) => (
                    <button
                      key={option}
                      className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.10] hover:text-white"
                    >
                      {option}
                      <ChevronRight className="h-3 w-3 opacity-50" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionLabel({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Decision Feed
      </h2>
      {count > 0 && (
        <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-300">
          {count} pending
        </span>
      )}
    </div>
  );
}
