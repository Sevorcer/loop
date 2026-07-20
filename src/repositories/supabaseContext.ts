import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Deterministic local-development org used by seeded fixtures when no authenticated
// Supabase session is available but a service-role client is configured.
export const DEFAULT_DEVELOPMENT_ORG_ID = "00000000-0000-4000-8000-000000000001";

export interface RepositoryContext {
  orgId: string;
  supabase: SupabaseClient;
  mode: "session" | "development";
}

export async function getRepositoryContext(): Promise<RepositoryContext> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!profile?.org_id) {
      throw new Error("USER_PROFILE_NOT_FOUND");
    }

    return {
      orgId: profile.org_id,
      supabase,
      mode: "session",
    };
  }

  if (process.env.NODE_ENV !== "production") {
    const adminClient = getSupabaseAdminClient();

    if (adminClient) {
      return {
        orgId: process.env.LOOP_DEFAULT_ORG_ID ?? DEFAULT_DEVELOPMENT_ORG_ID,
        supabase: adminClient,
        mode: "development",
      };
    }
  }

  throw new Error("SUPABASE_SESSION_REQUIRED");
}
