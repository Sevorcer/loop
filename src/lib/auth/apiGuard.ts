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
export async function requireApiSession(): Promise<ApiSessionResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: "UNAUTHORIZED", message: "A valid session is required.", code: 401 },
        { status: 401 }
      ),
      user: null,
    };
  }

  return { error: null, user };
}
