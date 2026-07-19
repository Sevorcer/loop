import type { HealthIndicator, HealthStatus } from "../types/reporting";
import { healthStatusLabel } from "../utils/reportingUtils";

interface HealthIndicatorCardProps {
  indicator: HealthIndicator;
}

function getStatusColors(status: HealthStatus): {
  bg: string;
  border: string;
  dot: string;
  badge: string;
  badgeText: string;
} {
  switch (status) {
    case "healthy":
      return {
        bg: "bg-emerald-500/[0.08]",
        border: "border-emerald-500/20",
        dot: "bg-green-500",
        badge: "bg-emerald-500/[0.12]",
        badgeText: "text-emerald-200",
      };
    case "improving":
      return {
        bg: "bg-blue-500/[0.08]",
        border: "border-blue-500/20",
        dot: "bg-blue-500",
        badge: "bg-blue-500/[0.12]",
        badgeText: "text-blue-200",
      };
    case "at-risk":
      return {
        bg: "bg-amber-500/[0.08]",
        border: "border-amber-500/20",
        dot: "bg-amber-500",
        badge: "bg-amber-500/[0.12]",
        badgeText: "text-amber-200",
      };
    case "deteriorating":
      return {
        bg: "bg-red-500/[0.08]",
        border: "border-red-500/20",
        dot: "bg-red-500",
        badge: "bg-red-500/[0.12]",
        badgeText: "text-red-200",
      };
  }
}

export function HealthIndicatorCard({ indicator }: HealthIndicatorCardProps) {
  const colors = getStatusColors(indicator.status);

  return (
    <div
      className={[
        "rounded-xl border p-4 transition-shadow hover:shadow-sm",
        colors.bg,
        colors.border,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={[
              "mt-0.5 h-2 w-2 shrink-0 rounded-full",
              colors.dot,
            ].join(" ")}
          />
          <p className="truncate text-sm font-medium text-white">
            {indicator.area}
          </p>
        </div>
        <span
          className={[
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
            colors.badge,
            colors.badgeText,
          ].join(" ")}
        >
          {healthStatusLabel(indicator.status)}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-300">{indicator.summary}</p>

      {indicator.requiresAttention ? (
        <p className="mt-2 text-xs font-medium text-amber-200">
          ⚠ Requires attention
        </p>
      ) : null}
    </div>
  );
}
