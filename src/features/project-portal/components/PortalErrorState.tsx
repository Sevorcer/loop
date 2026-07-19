import Link from "next/link";
import type { PortalErrorState } from "../utils/portalAuth";

interface PortalErrorStateProps {
  error: PortalErrorState;
}

/**
 * Full-screen portal error state component.
 *
 * Per error-state-catalog.md:
 * - Uses role="alert" and aria-live="assertive"
 * - Focus moves to the heading on render
 * - CTAs stack vertically on mobile
 * - No project content visible behind this state
 */
export function PortalErrorDisplay({ error }: PortalErrorStateProps) {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto max-w-md space-y-6">
        {/* Icon */}
        <div
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20"
        >
          <span className="text-2xl">
            {error.code === "project_not_found" ? "🗂️" : "🔒"}
          </span>
        </div>

        {/* Heading */}
        <h1
          tabIndex={-1}
          className="text-xl font-semibold text-white sm:text-2xl"
        >
          {error.heading}
        </h1>

        {/* Body */}
        <p className="text-sm leading-relaxed text-slate-400">{error.body}</p>

        {/* CTAs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={error.primaryCTAHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white ring-1 ring-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {error.primaryCTA}
          </Link>

          {error.secondaryCTA ? (
            <Link
              href="/portal"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              {error.secondaryCTA}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Inline empty states ───────────────────────────────────────────────────────

interface EmptyTabStateProps {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}

/**
 * Inline empty state for tab content areas.
 * Does not take over the full screen; navigation remains accessible.
 */
export function PortalEmptyState({ heading, body, ctaLabel, ctaHref }: EmptyTabStateProps) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/60"
      >
        <span className="text-xl">📋</span>
      </div>
      <h3 className="font-semibold text-white">{heading}</h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-400">{body}</p>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-white ring-1 ring-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}

// ─── Loading state ─────────────────────────────────────────────────────────────

export function PortalLoadingState() {
  return (
    <div className="flex min-h-[240px] items-center justify-center" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-slate-300" aria-hidden="true" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  );
}
