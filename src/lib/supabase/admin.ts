import "server-only";

import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | null | undefined;

export function getSupabaseAdminClient(): ReturnType<typeof createClient> | null {
  if (adminClient !== undefined) {
    return adminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    adminClient = null;
    return adminClient;
  }

  adminClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
