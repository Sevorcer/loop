/**
 * Supabase browser client factory.
 *
 * Use this in Client Components where cookie-based session management is not
 * needed (read-only data fetches, subscriptions). For mutations and protected
 * operations that need a verified server-side session, always use the server
 * client or call a Next.js Server Action / Route Handler instead.
 *
 * Only call `getSupabaseBrowserClient` in "use client" modules.
 */

import { createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Returns a singleton Supabase browser client, or `null` when the required
 * environment variables are not configured.
 *
 * Returning `null` (rather than throwing) allows the component tree to render
 * gracefully during static prerendering or local development without a
 * Supabase project configured. Callers should guard against null before making
 * any auth calls.
 */
export function getSupabaseBrowserClient(): ReturnType<typeof createBrowserClient> | null {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;

  _client = createBrowserClient(url, key);
  return _client;
}
