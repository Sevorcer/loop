"use client";

import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useState } from "react";

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

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
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
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
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
        </button>
      </div>
    </div>
  );
}
