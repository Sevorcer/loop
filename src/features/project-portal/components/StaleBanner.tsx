"use client";

import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useState } from "react";

<<<<<<< HEAD
import type { FreshnessState } from "../types/portalTypes";
import { getStaleBannerCopy } from "../utils/freshnessUtils";

interface StaleBannerProps {
  freshness: FreshnessState;
  onRefresh?: () => void;
}

/**
 * Sticky stale-data banner rendered beneath the portal navigation bar.
 *
 * Per error-state-catalog.md ES-05:
 * - role="status" + aria-live="polite" (non-interruptive)
 * - Does not occupy full screen
 * - Dismissible by tap/keyboard
 * - Does not obscure primary content
 */
export function StaleBanner({ freshness, onRefresh }: StaleBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (freshness.level === "fresh" || dismissed) return null;

  const copy = getStaleBannerCopy(freshness);
  const isElevated =
    freshness.level === "elevated_stale" || freshness.level === "unavailable";
=======
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
>>>>>>> origin/main

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
<<<<<<< HEAD
        "flex items-start gap-3 px-4 py-3 text-sm",
        isElevated
          ? "bg-amber-950/60 text-amber-300 border-b border-amber-800/50"
          : "bg-slate-800/80 text-slate-300 border-b border-slate-700/50",
      ].join(" ")}
    >
      <AlertTriangle
        size={16}
        aria-hidden="true"
        className={[
          "mt-0.5 shrink-0",
          isElevated ? "text-amber-400" : "text-slate-400",
        ].join(" ")}
      />

      <div className="flex-1 min-w-0">
        <span className="font-medium">{copy.heading} </span>
        <span className="text-slate-400">{copy.body}</span>
        {copy.showSupportLink ? (
          <>
            {" "}
            <a
              href="mailto:support@loop.app"
              className="underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
            >
              Contact support
            </a>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh data"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:min-h-0 sm:min-w-0 min-h-[44px] min-w-[44px]"
          >
            <RefreshCw size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notification"
          className="rounded p-1 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
        >
          <X size={14} aria-hidden="true" />
=======
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
>>>>>>> origin/main
        </button>
      </div>
    </div>
  );
}
