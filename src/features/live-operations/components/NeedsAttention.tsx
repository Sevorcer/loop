import { AlertTriangle, Info } from "lucide-react";

import type { OperationalEvent } from "../types/liveOps";

interface NeedsAttentionProps {
  attention: OperationalEvent[];
}

const severityConfig = {
  critical: {
    icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
    iconBg: "bg-red-500/10",
    border: "border-red-500/20",
    labelColor: "text-red-300",
    label: "Critical",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
    iconBg: "bg-yellow-500/10",
    border: "border-yellow-500/15",
    labelColor: "text-yellow-300",
    label: "Warning",
  },
  info: {
    icon: <Info className="h-4 w-4 text-blue-400" />,
    iconBg: "bg-blue-500/10",
    border: "border-blue-500/15",
    labelColor: "text-blue-300",
    label: "Info",
  },
};

export function NeedsAttention({ attention }: NeedsAttentionProps) {
  if (attention.length === 0) {
    return null;
  }

  // Sort: critical first, then warning
  const sorted = [...attention].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Needs Attention
        </h2>
        <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-xs font-semibold text-orange-300">
          {sorted.length} item{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {sorted.map((event) => {
          const cfg = severityConfig[event.severity];
          return (
            <div
              key={event.id}
              className={[
                "flex gap-3 rounded-2xl border p-4",
                cfg.border,
                "bg-white/[0.02]",
              ].join(" ")}
            >
              {/* Icon */}
              <div
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                  cfg.iconBg,
                ].join(" ")}
              >
                {cfg.icon}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{event.title}</p>
                  <span className="shrink-0 text-xs text-slate-600">{event.timeLabel}</span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-slate-400">
                  {event.description}
                </p>
                {event.actionRecommendation && (
                  <p className="mt-2 text-xs font-medium text-slate-300">
                    <span className={cfg.labelColor}>Suggested: </span>
                    {event.actionRecommendation}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
