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
        bg: "bg-green-50",
        border: "border-green-200",
        dot: "bg-green-500",
        badge: "bg-green-100",
        badgeText: "text-green-700",
      };
    case "improving":
      return {
        bg: "bg-blue-50",
        border: "border-blue-200",
        dot: "bg-blue-500",
        badge: "bg-blue-100",
        badgeText: "text-blue-700",
      };
    case "at-risk":
      return {
        bg: "bg-amber-50",
        border: "border-amber-200",
        dot: "bg-amber-500",
        badge: "bg-amber-100",
        badgeText: "text-amber-700",
      };
    case "deteriorating":
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        dot: "bg-red-500",
        badge: "bg-red-100",
        badgeText: "text-red-700",
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
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={[
              "mt-0.5 h-2 w-2 shrink-0 rounded-full",
              colors.dot,
            ].join(" ")}
          />
          <p className="text-sm font-medium text-slate-900 truncate">
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

      <p className="mt-2 text-sm text-slate-600">{indicator.summary}</p>

      {indicator.requiresAttention ? (
        <p className="mt-2 text-xs font-medium text-amber-700">
          ⚠ Requires attention
        </p>
      ) : null}
    </div>
  );
}
