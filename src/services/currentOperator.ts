import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CurrentOperator {
  name: string;
  appRole: string | null;
}

/** Signed-in user's display name and role, from their own profile row. */
export async function getCurrentOperator(): Promise<CurrentOperator> {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { name: "Team", appRole: null };

  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("full_name, app_role")
    .eq("id", authData.user.id)
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
