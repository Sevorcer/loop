import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppRole } from "@/services/authorization";

const APP_ROLES = new Set<AppRole>([
  "owner",
  "manager",
  "dispatch",
  "tech",
  "office",
  "sales",
  "portal",
]);

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.has(value as AppRole);
}

export interface TechnicianProfile {
  id: string;
  name: string;
}

export interface OwnProfile {
  name: string | null;
  role: AppRole | null;
}

function displayName(row: { full_name?: string | null; email?: string | null }): string {
  return (row.full_name ?? "").trim() || (row.email ?? "").trim() || "Team member";
}

/** Technicians the job form can assign. */
export async function listFieldTechnicians(): Promise<TechnicianProfile[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, email")
    .eq("app_role", "tech");
  if (error) return [];
  return ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>)
    .map((profile) => ({ id: profile.id, name: displayName(profile) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** The signed-in person's own profile row. */
export async function loadOwnProfile(userId: string): Promise<OwnProfile> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { name: null, role: null };
  const { data } = await supabase
    .from("user_profiles")
    .select("full_name, app_role")
    .eq("id", userId)
    .maybeSingle();
  const row = data as { full_name?: string | null; app_role?: string | null } | null;
  const name = row && typeof row.full_name === "string" && row.full_name.trim() ? row.full_name.trim() : null;
  const role = row && isAppRole(row.app_role) ? row.app_role : null;
  return { name, role };
}

/**
 * Display name for the signed-in user. Falls back from the auth id to the
 * email when the profile id does not match the session user.
 */
export async function lookupProfileName(input: {
  id?: string | null;
  email?: string | null;
}): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  if (input.id) {
    const byId = await supabase
      .from("user_profiles")
      .select("full_name,email")
      .eq("id", input.id)
      .maybeSingle();
    const row = byId.data as { full_name?: string | null } | null;
    if (row?.full_name?.trim()) return row.full_name.trim();
  }

  if (input.email) {
    const byEmail = await supabase
      .from("user_profiles")
      .select("full_name,email")
      .eq("email", input.email)
      .maybeSingle();
    const row = byEmail.data as { full_name?: string | null } | null;
    if (row?.full_name?.trim()) return row.full_name.trim();
  }

  return null;
}

export async function loadProfileNames(userIds: readonly string[]): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || userIds.length === 0) return {};
  const { data } = await supabase
    .from("user_profiles")
    .select("id, full_name, email")
    .in("id", [...userIds]);
  const names: Record<string, string> = {};
  for (const row of data ?? []) {
    const profile = row as { id: string; full_name: string | null; email: string | null };
    names[profile.id] = displayName(profile);
  }
  return names;
}

/** True when the signed-in profile is a field technician. */
export async function signedInUserIsTech(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return false;
  const profile = await loadOwnProfile(userId);
  return profile.role === "tech";
}
