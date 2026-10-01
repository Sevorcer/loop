"use client";

/**
 * SessionProvider — dev/mock session context for Sprint 25.
 *
 * Resolves the active role from the hydrated auth session first, then falls
 * back to the localStorage dev override and finally the default internal role.
 *
 * Security note: This is a UX-only guard. All sensitive operations are
 * enforced server-side via `assertPermission` in src/services/authorization.ts
 * and Supabase RLS policies in database/policies/.
 */

import {
  createContext,
  useContext,
  useEffect, useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AppRole } from "@/services/authorization";
import { useAuth } from "./state/AuthProvider"; import { getSupabaseBrowserClient } from "@/lib/supabase/client"; import { isAppRole } from "./utils/appRole";
import {
  DEFAULT_APP_ROLE,
  readStoredDevRole,
  resolveAuthUserRole,
} from "./utils/appRole";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface SessionContextValue {
  /** The resolved role for the current user. Null while loading. */
  role: AppRole | null;
  /** True until the session has been resolved from the auth provider. */
  loading: boolean; /** Current user's display name from their own user_profiles row. */ displayName: string | null; /** First-name token for compact greetings/menus. */ firstName: string | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function useDerivedSessionValue(): SessionContextValue {
  const { session, user, isLoading } = useAuth();
  const [devRole] = useState<AppRole | null>(() => readStoredDevRole());
  const authUser = session?.user ?? user; const authUserId = authUser?.id ?? null; const [profile, setProfile] = useState<{ userId: string; name: string | null; role: AppRole | null } | null>(null); useEffect(() => { if (!authUserId) { setProfile(null); return; } let cancelled = false; (async () => { let name: string | null = null; let profileRole: AppRole | null = null; try { const supabase = getSupabaseBrowserClient(); const { data } = await supabase.from("user_profiles").select("full_name, app_role").eq("id", authUserId).maybeSingle(); const row = data as { full_name?: string | null; app_role?: string | null } | null; if (row && typeof row.full_name === "string" && row.full_name.trim()) name = row.full_name.trim(); if (row && isAppRole(row.app_role)) profileRole = row.app_role; } catch { /* best-effort */ } if (!cancelled) setProfile({ userId: authUserId, name, role: profileRole }); })(); return () => { cancelled = true; }; }, [authUserId]);

  const role = useMemo<AppRole | null>(() => {
    if (isLoading || (authUserId && profile?.userId !== authUserId)) {
      return null;
    }

    // Fallback order: dev override → hydrated auth session/user metadata → owner.
    return devRole ?? profile?.role ?? resolveAuthUserRole(authUser) ?? DEFAULT_APP_ROLE;
  }, [authUser, devRole, isLoading, profile]);

  const displayName = profile?.name ?? (typeof authUser?.user_metadata?.full_name === "string" ? (authUser.user_metadata.full_name as string) : null); const firstName = displayName ? displayName.trim().split(/\s+/)[0] : null; return { role, loading: isLoading || Boolean(authUserId && profile?.userId !== authUserId), displayName, firstName };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useDerivedSessionValue();

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current session `{ role, loading }`.
 *
 * While `loading` is true, `role` is null and all permission guards render
 * null (no flash of unauthorized content).
 */
export function useSession(): SessionContextValue {
  const contextValue = useContext(SessionContext);
  const derivedValue = useDerivedSessionValue();
  // Sidebar and other legacy callers still consume this hook without mounting
  // SessionProvider, so fall back to the auth-derived value instead of hanging
  // in the default loading state from an uninitialized context.
  return contextValue ?? derivedValue;
}
