"use client";

/**
 * [EDITDIAG] TEMPORARY DIAGNOSTIC — REMOVE WITH THE EDIT-JOB PROBE.
 *
 * Probe v2 for the Edit Job "silent no-op" bug. Probe v1 ([EDIT_PROBE] in
 * JobDetailScreen) proved the click is delivered and the React handler fires,
 * yet the client router fetches `/jobs/<id>/edit` (12x → 200) without ever
 * committing the navigation — and swapping router.push for a <Link> did not
 * help, so the fault is in the client-side commit of that segment, not the
 * trigger.
 *
 * This component beacons the remaining discriminators through the #312
 * reportClientError pipeline (grep Vercel runtime logs for `[EDITDIAG]`),
 * because the test browser cannot run a DevTools console. On job-detail mount
 * it reports, best-effort and PII-free:
 *   1. the controlling service worker (if any) + its registrations;
 *   2. a fetch of this job's /edit URL with the RSC flight header, and one
 *      plain — status, redirected flag, final URL, content-type, and the first
 *      ~200 chars of the body. A flight response is `text/x-component`; an HTML
 *      document (or a redirect) is what a silently-aborted soft-nav looks like.
 *   3. the first few history.pushState/replaceState calls after mount, so the
 *      Edit Job tap reveals whether the router even attempts a URL change.
 *
 * Safety: every path is wrapped in try/catch and can never break the page; the
 * /edit GETs are read-only idempotent page renders; history is restored on
 * unmount; the reporter is rate-capped at 10/min.
 */

import { useEffect } from "react";

import { reportClientError } from "@/components/observability/ClientErrorReporter";

interface EditNavDiagProps {
  jobId: string;
}

export function EditNavDiag({ jobId }: EditNavDiagProps) {
  useEffect(() => {
    const editUrl = `/jobs/${jobId}/edit`;

    const beacon = (label: string, detail: Record<string, unknown>) => {
      try {
        reportClientError({
          message: `[EDITDIAG] ${label}`,
          stack: JSON.stringify(detail).slice(0, 3800),
          source: "editdiag",
        });
      } catch {
        // never throw
      }
    };

    // Capture the ORIGINAL fetch up front so our own probe/beacon calls below
    // don't get caught by the wrapper we install.
    const origFetch = window.fetch.bind(window);

    // KEY: wrap fetch to observe the ROUTER's real RSC exchange for /edit — the
    // request's RSC/router headers and the response's status/content-type. This
    // discriminates "SW/route returned something unapplyable" from "router got
    // clean flight but won't commit the transition". Excludes /api (our beacon
    // channel) to avoid recursion, and only reports /edit traffic.
    let fetchReports = 0;
    const wrappedFetch: typeof window.fetch = (input, init) => {
      let url = "";
      let method = "GET";
      let routerHeaders: Record<string, string | null> = {};
      try {
        url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;
        const reqHeaders =
          init?.headers ??
          (typeof input === "object" && input !== null && "headers" in input
            ? (input as Request).headers
            : undefined);
        const h = new Headers(reqHeaders as HeadersInit | undefined);
        routerHeaders = {
          rsc: h.get("RSC"),
          prefetch: h.get("Next-Router-Prefetch"),
          stateTree: h.get("Next-Router-State-Tree") ? "present" : null,
          nextUrl: h.get("Next-Url"),
        };
        method =
          init?.method ??
          (typeof input === "object" && input !== null && "method" in input
            ? (input as Request).method
            : "GET");
      } catch {
        // fall through to the real fetch regardless
      }

      const p = origFetch(input as RequestInfo | URL, init);

      try {
        if (url.includes("/edit") && !url.includes("/api/") && fetchReports < 6) {
          fetchReports += 1;
          void p
            .then(async (res) => {
              let bodyHead = "";
              try {
                bodyHead = (await res.clone().text()).slice(0, 120);
              } catch {
                bodyHead = "<clone read failed>";
              }
              beacon("router-fetch", {
                url,
                method,
                reqHeaders: routerHeaders,
                status: res.status,
                redirected: res.redirected,
                finalUrl: res.url,
                type: res.type,
                contentType: res.headers.get("content-type"),
                bodyHead,
              });
            })
            .catch((e) => beacon("router-fetch-error", { url, error: String(e) }));
        }
      } catch {
        // never let instrumentation break the real request
      }

      return p;
    };
    try {
      window.fetch = wrappedFetch;
    } catch {
      // if we can't patch fetch, the rest of the probe still runs
    }

    // KEY: the Navigation API fires `navigate` for SPA navigations in Chromium.
    // If it fires for /edit, the router DID start the navigation (so the fault
    // is in the commit); if it never fires on the tap, the click never
    // initiated a navigation at all.
    let navReports = 0;
    const navApi = (window as unknown as { navigation?: EventTarget }).navigation;
    const onNavigate = (event: Event) => {
      try {
        const e = event as Event & {
          destination?: { url?: string };
          navigationType?: string;
          canIntercept?: boolean;
          hashChange?: boolean;
          downloadRequest?: unknown;
        };
        const dest = e.destination?.url ?? "";
        if (dest.includes("/edit") && navReports < 4) {
          navReports += 1;
          beacon("navigate-event", {
            dest,
            navigationType: e.navigationType ?? null,
            canIntercept: e.canIntercept ?? null,
            hashChange: e.hashChange ?? null,
          });
        }
      } catch {
        // never throw
      }
    };
    try {
      navApi?.addEventListener?.("navigate", onNavigate);
    } catch {
      // Navigation API may be unavailable; non-fatal.
    }

    // 1) Service worker controlling this page?
    try {
      const controller =
        typeof navigator !== "undefined" && navigator.serviceWorker
          ? (navigator.serviceWorker.controller?.scriptURL ?? "NONE")
          : "unsupported";
      beacon("sw", { controller });
      if (typeof navigator !== "undefined" && navigator.serviceWorker) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            beacon("sw-regs", {
              scopes: regs.map((r) => ({
                scope: r.scope,
                script:
                  (r.active || r.installing || r.waiting)?.scriptURL ?? "?",
              })),
            });
          })
          .catch((e) => beacon("sw-regs-error", { error: String(e) }));
      }
    } catch (e) {
      beacon("sw-error", { error: String(e) });
    }

    // 2) What does the server actually return for the edit segment?
    const probeFetch = async (mode: "rsc" | "plain") => {
      try {
        const res = await origFetch(editUrl, {
          headers: mode === "rsc" ? { RSC: "1" } : {},
          cache: "no-store",
        });
        let body = "";
        try {
          body = (await res.text()).slice(0, 200);
        } catch {
          body = "<body read failed>";
        }
        beacon(`fetch:${mode}`, {
          status: res.status,
          redirected: res.redirected,
          finalUrl: res.url,
          type: res.type,
          contentType: res.headers.get("content-type"),
          nextUrl: res.headers.get("x-nextjs-redirect") ?? res.headers.get("location") ?? null,
          bodyHead: body,
        });
      } catch (e) {
        beacon(`fetch:${mode}-error`, { error: String(e) });
      }
    };
    void probeFetch("rsc");
    void probeFetch("plain");

    // 3) Does the Edit Job tap reach the history API at all?
    let historyReports = 0;
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    const wrap =
      (name: string, orig: typeof history.pushState) =>
      function (this: History, ...args: Parameters<typeof history.pushState>) {
        try {
          if (historyReports < 4) {
            historyReports += 1;
            beacon("history", { method: name, url: String(args[2] ?? "") });
          }
        } catch {
          // never throw
        }
        return orig.apply(this, args);
      };
    try {
      history.pushState = wrap("pushState", origPush);
      history.replaceState = wrap("replaceState", origReplace);
    } catch {
      // if patching fails, the app is unaffected
    }

    return () => {
      try {
        history.pushState = origPush;
        history.replaceState = origReplace;
      } catch {
        // ignore teardown failures
      }
      try {
        if (window.fetch === wrappedFetch) window.fetch = origFetch;
      } catch {
        // ignore teardown failures
      }
      try {
        navApi?.removeEventListener?.("navigate", onNavigate);
      } catch {
        // ignore teardown failures
      }
    };
  }, [jobId]);

  return null;
}
