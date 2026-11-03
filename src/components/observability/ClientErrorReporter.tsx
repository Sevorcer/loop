"use client";

/**
 * Global client-side error reporter.
 *
 * DIAGNOSTIC: LOOP has no client-error reporting, which is why a form-breaking
 * bug (New Job navigation failing on mobile) shipped unseen. This component
 * makes invisible client-side errors VISIBLE in the server logs.
 *
 * Mounted high in the authed app shell so it covers every authenticated page.
 * It listens for uncaught errors and unhandled promise rejections and does a
 * best-effort POST to `/api/client-errors`, which emits a structured
 * `[CLIENT_ERROR]` log line visible in Vercel runtime logs.
 *
 * Safety contract:
 *   - Every path is wrapped in try/catch; this component can NEVER break the app.
 *   - Reports are capped (debounced) to avoid log floods.
 *   - No cookies, tokens, form values, or PII are sent — only error
 *     text/stack/url/UA.
 */

import { useEffect } from "react";

// Cap: at most this many reports inside the rolling window below.
const MAX_REPORTS_PER_WINDOW = 10;
const WINDOW_MS = 60_000;
// Defensive cap on how much error text we ever send.
const MAX_FIELD_LENGTH = 4_000;

interface ClientErrorPayload {
  message: string;
  stack: string | null;
  source: string | null;
  line: number | null;
  col: number | null;
  url: string;
  userAgent: string;
  ts: string;
}

function truncate(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.length > MAX_FIELD_LENGTH ? value.slice(0, MAX_FIELD_LENGTH) : value;
}

/**
 * Best-effort report of a client error to the server log endpoint.
 * Exported so route-level error boundaries can reuse the exact same path.
 * Never throws.
 */
export function reportClientError(payload: Partial<ClientErrorPayload>): void {
  try {
    const body: ClientErrorPayload = {
      message: truncate(payload.message) ?? "Unknown client error",
      stack: truncate(payload.stack ?? null),
      source: truncate(payload.source ?? null),
      line: typeof payload.line === "number" ? payload.line : null,
      col: typeof payload.col === "number" ? payload.col : null,
      url:
        typeof payload.url === "string" && payload.url.length > 0
          ? payload.url
          : typeof location !== "undefined"
            ? location.pathname
            : "unknown",
      userAgent:
        typeof payload.userAgent === "string" && payload.userAgent.length > 0
          ? payload.userAgent
          : typeof navigator !== "undefined"
            ? navigator.userAgent
            : "unknown",
      ts: payload.ts ?? new Date().toISOString(),
    };

    void fetch("/api/client-errors", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {
      // Reporting is best-effort; swallow network/transport failures.
    });
  } catch {
    // Reporting must never throw and never break the host app.
  }
}

export default function ClientErrorReporter() {
  useEffect(() => {
    // Rolling-window rate limiter shared by both listeners.
    let windowStart = Date.now();
    let countInWindow = 0;

    const allow = (): boolean => {
      try {
        const now = Date.now();
        if (now - windowStart > WINDOW_MS) {
          windowStart = now;
          countInWindow = 0;
        }
        if (countInWindow >= MAX_REPORTS_PER_WINDOW) return false;
        countInWindow += 1;
        return true;
      } catch {
        return false;
      }
    };

    const onError = (event: ErrorEvent) => {
      try {
        if (!allow()) return;
        reportClientError({
          message: event.message || event.error?.message || "Uncaught error",
          stack: event.error?.stack ?? null,
          source: event.filename ?? null,
          line: typeof event.lineno === "number" ? event.lineno : null,
          col: typeof event.colno === "number" ? event.colno : null,
        });
      } catch {
        // Never let the handler throw.
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      try {
        if (!allow()) return;
        const reason = event.reason;
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Unhandled promise rejection";
        reportClientError({
          message,
          stack: reason instanceof Error ? (reason.stack ?? null) : null,
          source: "unhandledrejection",
        });
      } catch {
        // Never let the handler throw.
      }
    };

    try {
      window.addEventListener("error", onError);
      window.addEventListener("unhandledrejection", onRejection);
    } catch {
      // If listener registration fails, do nothing — app is unaffected.
    }

    return () => {
      try {
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onRejection);
      } catch {
        // Ignore teardown failures.
      }
    };
  }, []);

  return null;
}
