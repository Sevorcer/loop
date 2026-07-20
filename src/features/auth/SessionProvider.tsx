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
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AppRole } from "@/services/authorization";
import { useAuth } from "./state/AuthProvider";
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
  loading: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function useDerivedSessionValue(): SessionContextValue {
  const { session, user, isLoading } = useAuth();
  const [devRole] = useState<AppRole | null>(() => readStoredDevRole());
  const authUser = session?.user ?? user;

  const role = useMemo<AppRole | null>(() => {
    if (isLoading) {
      return null;
    }

    // Fallback order: dev override → hydrated auth session/user metadata → owner.
    return devRole ?? resolveAuthUserRole(authUser) ?? DEFAULT_APP_ROLE;
  }, [authUser, devRole, isLoading]);

  return { role, loading: isLoading };
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
