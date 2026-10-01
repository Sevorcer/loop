import { UsersScreen } from "@/features/settings"; import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function UsersPage() { const supabase = await createSupabaseServerClient(); const { data: authData } = await supabase.auth.getUser(); let appRole: string | null = null; if (authData.user) { const { data: profileRow } = await supabase.from("user_profiles").select("app_role").eq("id", authData.user.id).maybeSingle(); appRole = (profileRow as { app_role?: string | null } | null)?.app_role ?? null; } if (appRole && appRole !== "owner" && appRole !== "manager") { return (<div className="mx-auto max-w-lg space-y-3 py-16 text-center"><h1 className="text-xl font-semibold text-white">Users settings are not available for your role</h1><p className="text-sm text-slate-400">Team management is limited to owners and managers. Your jobs and calendar are still available from the sidebar.</p></div>); }
  return <UsersScreen />;
}
