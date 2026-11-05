import "server-only";

import { getRepositoryContext } from "./supabaseContext";

/** Reads one org setting's jsonb value; null when unset or table missing. */
export async function readOrgSetting(key: string): Promise<unknown> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("org_settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", key)
    .maybeSingle();
  if (error) {
    // Table not migrated yet — callers fall back to defaults.
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw new Error(error.message);
  }
  return (data as { value?: unknown } | null)?.value ?? null;
}

export async function writeOrgSetting(
  key: string,
  value: unknown,
  userId: string | null,
): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase.from("org_settings").upsert(
    {
      org_id: orgId,
      key,
      value,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,key" },
  );
  if (error) throw new Error(error.message);
}
