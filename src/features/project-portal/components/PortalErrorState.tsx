"use client";

import Link from "next/link";
import { PORTAL_ROUTES } from "@/lib/routes";
import type { AuthorizationErrorCode } from "../types/portal";
import type { PortalErrorState as PortalErrorStateData } from "../utils/portalAuth";

// ─── Code-based error state (22A API — used by error pages) ──────────────────

interface PortalErrorStateProps {
  code: AuthorizationErrorCode;
  /** When true renders as a full-screen takeover. Default true. */
  fullScreen?: boolean;
}

interface ErrorConfig {
  heading: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  ariaRole: "alert" | "status";
}

const ERROR_CONFIG: Record<AuthorizationErrorCode, ErrorConfig> = {
  unauthorized: {
    heading: "You don't have access to this project.",
    body: "Your account isn't linked to this project. If you believe this is a mistake, contact your contractor or project manager.",
    primaryLabel: "Contact Contractor",
    primaryHref: "mailto:office@sunstatehvac.com",
    secondaryLabel: "Return to Portal",
    secondaryHref: PORTAL_ROUTES.ROOT,
    ariaRole: "alert",
  },
  expired_invite: {
    heading: "Your invitation has expired.",
    body: "This invitation link is no longer valid. Ask your contractor to send a new invitation.",
    primaryLabel: "Request New Invite",
    primaryHref: "mailto:office@sunstatehvac.com?subject=New Portal Invite Request",
    secondaryLabel: "Contact Contractor",
    secondaryHref: "mailto:office@sunstatehvac.com",
    ariaRole: "alert",
  },
  revoked_access: {
    heading: "Your access has been removed.",
    body: "Your contractor has removed your access to this project. If you have questions, contact them directly.",
    primaryLabel: "Contact Contractor",
    primaryHref: "mailto:office@sunstatehvac.com",
    ariaRole: "alert",
  },
  missing_project: {
    heading: "This project isn't available.",
    body: "This project no longer exists or has been archived. Contact your contractor if you think this is a mistake.",
    primaryLabel: "Return to Portal",
    primaryHref: PORTAL_ROUTES.ROOT,
    secondaryLabel: "Contact Contractor",
    secondaryHref: "mailto:office@sunstatehvac.com",
    ariaRole: "alert",
  },
  stale_feed: {
    heading: "Information may be outdated.",
    body: "We're working to refresh your project data. You can continue browsing with the last known information.",
    primaryLabel: "Refresh",
    primaryHref: "#",
    ariaRole: "status",
  },
  service_unavailable: {
    heading: "LOOP is temporarily unavailable.",
    body: "We're working on it. Please try again in a few minutes.",
    primaryLabel: "Try Again",
    primaryHref: "#",
    secondaryLabel: "Contact Support",
    secondaryHref: "mailto:support@loop.app",
    ariaRole: "alert",
  },
};

/**
 * Full-screen portal error state — renders by error code.
 * Used by /portal/error/* pages.
 */
export function PortalErrorState({
  code,
  fullScreen = true,
}: PortalErrorStateProps) {
  const config = ERROR_CONFIG[code];

  return (
    <div
      className={[
        "flex flex-col items-center justify-center px-6 text-center",
        fullScreen ? "min-h-[60vh]" : "py-16",
      ].join(" ")}
    >
      <div
        role={config.ariaRole}
        aria-live={config.ariaRole === "alert" ? "assertive" : "polite"}
        className="flex max-w-md flex-col items-center gap-4"
        tabIndex={-1}
      >
        <div
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-elevated text-muted-foreground"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-foreground">{config.heading}</h1>

        <p className="text-sm leading-relaxed text-muted-foreground">{config.body}</p>

        <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          {config.primaryHref.startsWith("mailto:") || config.primaryHref === "#" ? (
            <a
              href={config.primaryHref}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
              onClick={
                config.primaryHref === "#"
                  ? (e) => { e.preventDefault(); window.location.reload(); }
                  : undefined
              }
            >
              {config.primaryLabel}
            </a>
          ) : (
            <Link
              href={config.primaryHref}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
            >
              {config.primaryLabel}
            </Link>
          )}

          {config.secondaryLabel && config.secondaryHref ? (
            config.secondaryHref.startsWith("mailto:") ? (
              <a
                href={config.secondaryHref}
                className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground sm:w-auto"
              >
                {config.secondaryLabel}
              </a>
            ) : (
              <Link
                href={config.secondaryHref}
                className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground sm:w-auto"
              >
                {config.secondaryLabel}
              </Link>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Object-based error display (22B API — used by PortalShell) ───────────────

interface PortalErrorDisplayProps {
  error: PortalErrorStateData;
}

/**
 * Renders a portal error using a pre-resolved error state object.
 * Used by PortalShell after calling getErrorState().
 */
export function PortalErrorDisplay({ error }: PortalErrorDisplayProps) {
  const isElevated = error.code === "access_revoked" || error.code === "service_unavailable";

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto max-w-md space-y-6">
        <div
          aria-hidden="true"
          className={[
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-1",
            isElevated
              ? "bg-red-500/10 ring-red-500/20"
              : "bg-border ring-border",
          ].join(" ")}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 tabIndex={-1} className="text-xl font-semibold text-foreground sm:text-2xl">
          {error.heading}
        </h1>

        <p className="text-sm leading-relaxed text-muted-foreground">{error.body}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={error.primaryCTAHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {error.primaryCTA}
          </a>

          {error.secondaryCTA ? (
            <Link
              href="/portal"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
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
 * Does not take over the full screen — navigation remains accessible.
 */
export function PortalEmptyState({ heading, body, ctaLabel, ctaHref }: EmptyTabStateProps) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      </div>
      <h3 className="font-semibold text-foreground">{heading}</h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
    <div
      className="flex min-h-[240px] items-center justify-center"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
