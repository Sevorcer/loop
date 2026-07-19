"use client";

import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useState } from "react";

import type { FreshnessStatus } from "../types/portal";

interface StaleBannerProps {
  freshness: FreshnessStatus;
}

/**
 * Stale-data banner per event-contract-spec.md stale-data behavior section.
 *
 * - fresh: no banner rendered
 * - stale_warning: yellow banner with "Last synchronized X minutes ago"
 * - stale_elevated: orange banner with support link (>15 min)
 * - unavailable: red banner for service disruption
 *
 * Telemetry event: portal.feed.stale (tracked externally on mount)
 *
 * Accessibility: role="status" + aria-live="polite" (non-interruptive).
 */
export function StaleBanner({ freshness }: StaleBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (freshness.state === "fresh" || dismissed) return null;

  const config = {
    stale_warning: {
      bg: "bg-amber-500/[0.10]",
      border: "border-amber-500/30",
      text: "text-amber-200",
      icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
      message: `Information may be outdated. Last synchronized ${freshness.minutesSinceSync} minute${freshness.minutesSinceSync !== 1 ? "s" : ""} ago.`,
      showSupport: false,
    },
    stale_elevated: {
      bg: "bg-orange-500/[0.10]",
      border: "border-orange-500/30",
      text: "text-orange-200",
      icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
      message: `Information may be significantly outdated. Last synchronized ${freshness.minutesSinceSync} minutes ago.`,
      showSupport: true,
    },
    unavailable: {
      bg: "bg-red-500/[0.10]",
      border: "border-red-500/30",
      text: "text-red-200",
      icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
      message: "Live updates are currently unavailable. Showing last known data.",
      showSupport: true,
    },
  } as const;

  const { bg, border, text, icon, message, showSupport } =
    config[freshness.state];

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        bg,
        border,
        text,
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5">{icon}</span>
        <span>
          {message}
          {showSupport ? (
            <>
              {" "}
              <a
                href="mailto:support@loop.app"
                className="underline underline-offset-2"
              >
                Contact support
              </a>
              .
            </>
          ) : null}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label="Refresh"
          onClick={() => window.location.reload()}
          className="rounded p-1 transition-colors hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="rounded p-1 transition-colors hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
