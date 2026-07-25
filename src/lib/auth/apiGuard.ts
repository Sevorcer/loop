/**
 * API route auth guard.
 *
 * Provides `requireApiSession()` — a helper for Route Handlers that must
 * reject unauthenticated requests with a 401 JSON response instead of
 * redirecting to a sign-in page.
 *
 * Usage (in an API route handler):
 *
 *   const sessionResult = await requireApiSession();
 *   if (sessionResult.error) return sessionResult.error;
 *   const { user } = sessionResult;
 *
 * Design notes:
 *   - Returns a discriminated union so callers can early-return cleanly.
 *   - Uses `getUser()` for server-side JWT validation (not cached session).
 *   - Pair with `assertPermission()` for role-level authorization checks.
 *
 * IMPORTANT: Server-only. Do not import this in Client Components.
 */

import "server-only";

import { NextResponse } from "next/server";

import {
  applyTraceHeaders,
  createCorrelationId,
  getRequestTraceContext,
  incrementAuthMetric,
  logAuthEvent,
} from "@/lib/observability/auth";
import { resolveAuthRefresh } from "@/lib/auth/refreshResolver";
import { unauthorizedResponse } from "@/lib/auth/unauthorized";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApiSessionSuccess = { error: null; user: User };
type ApiSessionFailure = { error: NextResponse; user: null };
export type ApiSessionResult = ApiSessionSuccess | ApiSessionFailure;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates the current session for a Route Handler.
 *
 * Returns `{ error: null, user }` on success.
 * Returns `{ error: NextResponse(401), user: null }` when unauthenticated.
 *
 * @example
 *   export async function GET() {
 *     const sessionResult = await requireApiSession();
 *     if (sessionResult.error) return sessionResult.error;
 *     const { user } = sessionResult;
 *     // ... handler logic
 *   }
 */
export async function requireApiSession(request?: Request): Promise<ApiSessionResult> {
  const generatedId = createCorrelationId();
  const trace = request
    ? getRequestTraceContext(request)
    : { route: "unknown", requestId: generatedId, correlationId: generatedId };
  const supabase = await createSupabaseServerClient();
  const resolved = await resolveAuthRefresh({
    getUser: () => supabase.auth.getUser(),
    clearSession: async () => {
      await supabase.auth.signOut();
    },
  });

  if (resolved.status !== "authenticated" || !resolved.user) {
    logAuthEvent({
      event: "unauthorized_access_attempt",
      outcome: "deny",
      route: trace.route,
      statusCode: 401,
      requestId: trace.requestId,
      correlationId: trace.correlationId,
      errorCode: resolved.error?.name ?? resolved.resolution,
      refreshOutcome: resolved.resolution,
      refreshAttempts: resolved.attempts,
      details: {
        message: resolved.error?.message ?? "No authenticated user found.",
      },
    });
    incrementAuthMetric("auth_401_total", { route: trace.route });
    return {
      error: applyTraceHeaders(
        unauthorizedResponse(),
        trace,
      ),
      user: null,
    };
  }

  logAuthEvent({
    event: "session_refresh_success",
    outcome: "success",
    route: trace.route,
    statusCode: 200,
    requestId: trace.requestId,
    correlationId: trace.correlationId,
    userId: resolved.user.id,
    refreshOutcome: resolved.resolution,
    refreshAttempts: resolved.attempts,
    details: {
      resolution: resolved.resolution,
    },
  });

  return { error: null, user: resolved.user };
}
