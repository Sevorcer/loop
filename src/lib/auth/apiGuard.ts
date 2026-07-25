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

import {
  classifyUnauthorizedReason,
  unauthorizedResponse,
  applyTraceHeaders,
  createCorrelationId,
  getRequestTraceContext,
  incrementAuthMetric,
  logAuthEvent,
} from "@/lib/observability/auth";
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

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const reason = classifyUnauthorizedReason(error);
    logAuthEvent({
      event: "unauthorized_access_attempt",
      outcome: "deny",
      route: trace.route,
      statusCode: 401,
      requestId: trace.requestId,
      correlationId: trace.correlationId,
      errorCode: reason.toUpperCase(),
      details: {
        message: error?.message ?? "No authenticated user found.",
        reason,
      },
    });
    incrementAuthMetric("auth_401_total", { route: trace.route, category: reason });
    return {
      error: applyTraceHeaders(unauthorizedResponse(undefined, reason), trace),
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
    userId: user.id,
  });

  return { error: null, user };
}
