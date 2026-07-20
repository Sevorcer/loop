/**
 * Auth session utilities — server-side.
 *
 * This module is the **single source of truth** for resolving the current
 * authenticated user/session in server-side contexts (Server Components,
 * Route Handlers, Server Actions).
 *
 * Rules:
 *   - Always use `getSession()` or `getCurrentUser()` instead of calling the
 *     Supabase client directly.
 *   - Use `requireSession()` at protected call boundaries — it throws/redirects
 *     when no valid session exists.
 *   - Never use `getSession()` as a sole security gate; pair it with RLS and
 *     `assertPermission()` from `src/services/authorization.ts`.
 *
 * IMPORTANT: Server-only. Do not import this in Client Components.
 */

import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/routes";
import type { Session, User } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthSession {
  user: User;
  session: Session;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current Supabase session and user, or `null` if unauthenticated.
 *
 * Uses `getUser()` (server-side JWT validation) rather than the cached
 * `getSession()` to avoid stale token reads. Safe to call in any server
 * context per the Supabase SSR docs.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  // Gracefully return null when Supabase env vars are not configured (e.g.
  // during static prerendering at build time or local dev without a project).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  // Re-fetch the full session object after confirming the user is valid.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  return { user, session };
}

/**
 * Returns the current authenticated user, or `null` if unauthenticated.
 *
 * Convenience wrapper around `getAuthSession()` for callers that only need
 * the `User` object.
 */
export async function getCurrentUser(): Promise<User | null> {
  const authSession = await getAuthSession();
  return authSession?.user ?? null;
}

/**
 * Asserts that a valid session exists. Redirects to the sign-in page if not.
 *
 * Use at the top of Server Components or Route Handlers that must be
 * protected. Returns the resolved `AuthSession` on success.
 *
 * @example
 *   const { user } = await requireSession();
 */
export async function requireSession(): Promise<AuthSession> {
  const authSession = await getAuthSession();

  if (!authSession) {
    redirect(ROUTES.SIGN_IN);
  }

  return authSession;
}
