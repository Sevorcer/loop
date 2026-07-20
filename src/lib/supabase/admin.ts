import "server-only";

import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | null | undefined;

export function getSupabaseAdminClient(): ReturnType<typeof createClient> | null {
  if (adminClient !== undefined) {
    return adminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    adminClient = null;
    return adminClient;
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

export function createSupabaseAdminClient() {
  const client = getSupabaseAdminClient();

  if (!client) {
    throw new Error(
      "Missing Supabase admin environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }

  return client;
}
