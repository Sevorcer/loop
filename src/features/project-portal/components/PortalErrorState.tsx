import Link from "next/link";

import { PORTAL_ROUTES } from "@/lib/routes";
import type { AuthorizationErrorCode } from "../types/portal";

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
  telemetry: string;
  ariaRole: "alert" | "status";
}

const ERROR_CONFIG: Record<AuthorizationErrorCode, ErrorConfig> = {
  unauthorized: {
    heading: "You don't have access to this project.",
    body: "Your account isn't linked to this project. If you believe this is a mistake, contact your contractor or project manager.",
    primaryLabel: "Contact Contractor",
    primaryHref: PORTAL_ROUTES.ERROR_UNAUTHORIZED,
    secondaryLabel: "Return to Dashboard",
    secondaryHref: PORTAL_ROUTES.ROOT,
    telemetry: "portal.error.unauthorized",
    ariaRole: "alert",
  },
  expired_invite: {
    heading: "Your invitation has expired.",
    body: "This invitation link is no longer valid. Ask your contractor to send a new invitation.",
    primaryLabel: "Request New Invite",
    primaryHref: "mailto:office@sunstatehvac.com?subject=New Portal Invite Request",
    secondaryLabel: "Contact Contractor",
    secondaryHref: "mailto:office@sunstatehvac.com",
    telemetry: "portal.error.invite_expired",
    ariaRole: "alert",
  },
  revoked_access: {
    heading: "Your access has been removed.",
    body: "Your contractor has removed your access to this project. If you have questions, contact them directly.",
    primaryLabel: "Contact Contractor",
    primaryHref: "mailto:office@sunstatehvac.com",
    telemetry: "portal.error.access_revoked",
    ariaRole: "alert",
  },
  missing_project: {
    heading: "This project isn't available.",
    body: "This project no longer exists or has been archived. Contact your contractor if you think this is a mistake.",
    primaryLabel: "Return to Dashboard",
    primaryHref: PORTAL_ROUTES.ROOT,
    secondaryLabel: "Contact Contractor",
    secondaryHref: "mailto:office@sunstatehvac.com",
    telemetry: "portal.error.project_not_found",
    ariaRole: "alert",
  },
  stale_feed: {
    heading: "Information may be outdated.",
    body: "We're working to refresh your project data. You can continue browsing with the last known information.",
    primaryLabel: "Refresh",
    primaryHref: "#",
    secondaryLabel: "Dismiss",
    secondaryHref: "#",
    telemetry: "portal.feed.stale",
    ariaRole: "status",
  },
  service_unavailable: {
    heading: "LOOP is temporarily unavailable.",
    body: "We're working on it. Please try again in a few minutes. If this continues, contact support.",
    primaryLabel: "Try Again",
    primaryHref: "#",
    secondaryLabel: "Contact Support",
    secondaryHref: "mailto:support@loop.app",
    telemetry: "portal.error.service_unavailable",
    ariaRole: "alert",
  },
};

/**
 * Shared error state renderer for all portal error codes.
 * Per error-state-catalog.md — each error renders correct copy and CTAs.
 *
 * Accessibility: heading uses role="alert" or role="status" per catalog spec.
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
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={-1}
        id="portal-error-heading"
      >
        {/* Icon placeholder — aria-hidden since text is sufficient */}
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

        <h1 className="text-xl font-semibold text-foreground">
          {config.heading}
        </h1>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {config.body}
        </p>

        <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          {config.primaryHref.startsWith("mailto:") ||
          config.primaryHref === "#" ? (
            <a
              href={config.primaryHref}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
              onClick={
                config.primaryHref === "#"
                  ? (e) => {
                      e.preventDefault();
                      window.location.reload();
                    }
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
            config.secondaryHref.startsWith("mailto:") ||
            config.secondaryHref === "#" ? (
              <a
                href={config.secondaryHref}
                className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground sm:w-auto"
                onClick={
                  config.secondaryHref === "#"
                    ? (e) => e.preventDefault()
                    : undefined
                }
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
