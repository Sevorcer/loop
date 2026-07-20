/**
 * POST /api/auth/sign-out
 *
 * Server-side sign-out route handler. Invalidates the Supabase session on the
 * server and clears session cookies. The client-side `signOut()` in
 * `AuthProvider` calls `supabase.auth.signOut()` directly (which handles
 * cookies via the browser client), so this route exists as a server-side
 * fallback for cases where a reliable server-driven sign-out is needed (e.g.
 * forced logout by an admin action or automated test harness).
 *
 * Returns 200 on success. The caller is responsible for the redirect.
 */

import { NextResponse } from "next/server";

import {
  applyTraceHeaders,
  getRequestTraceContext,
  logAuthEvent,
} from "@/lib/observability/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const trace = getRequestTraceContext(request);
  const supabase = await createSupabaseServerClient();

  try {
    await supabase.auth.signOut();
    logAuthEvent({
      event: "sign_out",
      outcome: "success",
      route: trace.route,
      statusCode: 200,
      requestId: trace.requestId,
      correlationId: trace.correlationId,
    });
    return applyTraceHeaders(NextResponse.json({ ok: true }, { status: 200 }), trace);
  } catch (error) {
    logAuthEvent({
      event: "sign_out",
      outcome: "failure",
      route: trace.route,
      statusCode: 500,
      requestId: trace.requestId,
      correlationId: trace.correlationId,
      errorCode: "SIGN_OUT_FAILED",
      details: {
        message: error instanceof Error ? error.message : "Unknown sign-out failure.",
      },
    });
    return applyTraceHeaders(
      NextResponse.json(
        { error: "SIGN_OUT_FAILED", message: "Failed to sign out.", code: 500 },
        { status: 500 },
      ),
      trace,
    );
  }
}
