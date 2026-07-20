/**
 * Supabase server client factory.
 *
 * Creates a cookie-aware Supabase client for use in:
 *   - Server Components
 *   - Route Handlers (API routes)
 *   - Server Actions
 *   - Next.js Middleware (via `createMiddlewareClient`)
 *
 * The server client reads and writes the Supabase session token via the
 * Next.js cookies API so that auth state is available server-side without
 * requiring an extra round-trip to the client.
 *
 * IMPORTANT: This module must only be imported in server-side contexts.
 * Import `server-only` to enforce that boundary at build time.
 */

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase server client that reads/writes cookies via the
 * Next.js `cookies()` store.
 *
 * Call this once per request — do NOT cache the result across requests.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` may be called from Server Components where cookie writes
          // are not possible. The middleware handles token refresh, so these
          // set failures in RSCs are safe to ignore.
        }
      },
    },
  });
}
