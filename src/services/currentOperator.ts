import "server-only";

import { readRequestAuth } from "@/lib/auth/requestAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentOperator {
  name: string;
  appRole: string | null;
}

/** Signed-in user's display name and role, from their own profile row. */
export async function getCurrentOperator(): Promise<CurrentOperator> {
  const remembered = readRequestAuth();
  const supabase = remembered?.supabase ?? (await createSupabaseServerClient());
  let userId = remembered?.userId ?? null;
  if (!userId) {
    const { data: authData } = await supabase.auth.getUser();
    userId = authData.user?.id ?? null;
  }
  if (!userId) return { name: "Team", appRole: null };

  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("full_name, app_role")
    .eq("id", userId)
    .maybeSingle();

  const row = profileRow as { full_name?: string | null; app_role?: string | null } | null;
  const name =
    row && typeof row.full_name === "string" && row.full_name.trim()
      ? row.full_name.trim()
      : "Team";

  return {
    name,
    appRole: typeof row?.app_role === "string" ? row.app_role : null,
  };
}
