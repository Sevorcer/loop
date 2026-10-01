"use client";

/**
 * RoleContext — current user role provider for the LOOP application shell.
 *
 * Role resolution follows the hydrated auth session so server render and client
 * hydration agree in production. A dev localStorage override still wins when
 * present so role simulation continues to work.
 *
 * Development helper: open the browser console and call
 *   `localStorage.setItem("loop_dev_role", "tech"); location.reload()`
 * to simulate a different role.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AppRole } from "@/services/authorization";
import { useAuth } from "./state/AuthProvider"; import { useSession } from "./SessionProvider";
import {
  DEV_ROLE_KEY,
  DEFAULT_APP_ROLE,
  readStoredDevRole,
  resolveAuthUserRole,
} from "./utils/appRole";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface RoleContextValue {
  /** The current user's role. Null only during SSR before client hydration. */
  role: AppRole | null;
  /** Development helper: override the active role and persist to localStorage. */
  setDevRole: (role: AppRole) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Mount at the application shell boundary (e.g. the shell layout) so every
 * feature screen can access the current role without prop drilling.
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const { session, user, isLoading } = useAuth();
  const [devRoleOverride, setDevRoleOverride] = useState<AppRole | null>(() =>
    readStoredDevRole()
  );
  const authUser = session?.user ?? user; const { role: sessionRole, loading: sessionLoading } = useSession();

  const role = useMemo<AppRole | null>(() => {
    if (isLoading || sessionLoading) {
      return null;
    }

    return devRoleOverride ?? sessionRole ?? resolveAuthUserRole(authUser) ?? DEFAULT_APP_ROLE;
  }, [authUser, devRoleOverride, isLoading, sessionRole, sessionLoading]);

  const setDevRole = useCallback((next: AppRole) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEV_ROLE_KEY, next);
    }
    setDevRoleOverride(next);
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({ role, setDevRole }),
    [role, setDevRole],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current user's role and a dev helper to switch it.
 *
 * Must be called inside a component tree wrapped by `RoleProvider`.
 */
export function useCurrentRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (ctx === null) {
    throw new Error("useCurrentRole must be used within a RoleProvider.");
  }
  return ctx;
}
