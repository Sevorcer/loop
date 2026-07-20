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

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiSession } from "@/lib/auth/apiGuard";

export async function POST() {
  // Require an authenticated session before accepting a sign-out request.
  // This prevents unauthenticated callers from triggering server-side
  // session teardown against arbitrary cookies.
  const sessionResult = await requireApiSession();
  if (sessionResult.error) return sessionResult.error;

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true }, { status: 200 });
}
