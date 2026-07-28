import Link from "next/link";

import type { CommandCenterKPIs } from "../types/commandCenter";
import { KPI_DEFINITIONS, formatAvgHours } from "../utils/commandCenterUtils";

interface KPIStripProps {
  kpis: CommandCenterKPIs;
}

function formatKPIValue(
  key: keyof CommandCenterKPIs,
  kpis: CommandCenterKPIs,
): string {
  const value = kpis[key];
  if (key === "avgCompletionHours") {
    return formatAvgHours(value as number | null);
  }
  return String(value ?? 0);
}

/** Returns a semantic color class for KPIs that indicate problems when elevated. */
function valueColorClass(
  key: keyof CommandCenterKPIs,
  kpis: CommandCenterKPIs,
): string {
  const value = kpis[key];
  if (typeof value !== "number" || value === 0) return "text-primary";
  const dangerKeys: Array<keyof CommandCenterKPIs> = [
    "jobsRunningLate",
    "callbacks",
    "waitingOnPermit",
  ];
  const warningKeys: Array<keyof CommandCenterKPIs> = [
    "waitingOnInspection",
  ];
  if (dangerKeys.includes(key)) return "text-danger";
  if (warningKeys.includes(key)) return "text-warning";
  return "text-primary";
}

/**
 * KPIStrip — 8-metric horizontal strip for the Command Center header.
 *
 * Every metric is a clickable link to a relevant filtered view.
 * Server component — no client JS required for interaction.
 */
export function KPIStrip({ kpis }: KPIStripProps) {
  return (
    <div className="grid grid-cols-2 gap-px rounded-xl border border-default bg-border sm:grid-cols-4 xl:grid-cols-8">
      {KPI_DEFINITIONS.map((def, idx) => {
        const displayValue = formatKPIValue(def.key, kpis);
        const colorClass = valueColorClass(def.key, kpis);
        const isFirst = idx === 0;
        const isLast = idx === KPI_DEFINITIONS.length - 1;

        return (
          <Link
            key={def.key}
            href={def.href}
            className={[
              "group flex flex-col justify-between gap-1 bg-surface px-4 py-4 transition-colors hover:bg-surface-elevated",
              isFirst ? "rounded-tl-xl rounded-bl-xl" : "",
              isLast ? "rounded-tr-xl rounded-br-xl" : "",
            ]
              .join(" ")
              .trim()}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              {def.label}
              {def.helpText ? (
                <span
                  className="ml-1 align-middle text-muted/80"
                  title={def.helpText}
                  aria-label={def.helpText}
                >
                  ⓘ
                </span>
              ) : null}
            </p>
            <p
              className={[
                "text-2xl font-bold tracking-tight transition-colors group-hover:opacity-90",
                colorClass,
              ].join(" ")}
            >
              {displayValue}
            </p>
            <p className="text-[11px] text-muted">{def.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
