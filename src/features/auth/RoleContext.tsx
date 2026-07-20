"use client";

/**
 * RoleContext — current user role provider for the LOOP application shell.
 *
 * Role resolution follows the same localStorage pattern used by the other
 * application providers (ContractorsProvider, JobsProvider, etc.):
 *
 *   - Server render: returns `null` (loading) so no restricted UI flashes
 *     before the client knows the real role.
 *   - Client: reads `loop_dev_role` from localStorage (default: `owner`).
 *
 * In production, replace the localStorage read in the `useState` initializer
 * with a JWT claim extraction from the Supabase session. The consumer API
 * (`useCurrentRole`, `PermissionGate`) does not change.
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEV_ROLE_KEY = "loop_dev_role";
const DEFAULT_ROLE: AppRole = "owner";

const VALID_ROLES: ReadonlySet<string> = new Set<AppRole>([
  "owner",
  "manager",
  "dispatch",
  "tech",
  "office",
  "sales",
  "portal",
]);

function isAppRole(value: string): value is AppRole {
  return VALID_ROLES.has(value);
}

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
  const [role, setRole] = useState<AppRole | null>(() => {
    // Server-side: window is unavailable; return null so the client hydration
    // matches the server render. The client snapshot takes over immediately.
    if (typeof window === "undefined") return null;

    const stored = window.localStorage.getItem(DEV_ROLE_KEY);
    if (stored !== null && isAppRole(stored)) return stored;
    return DEFAULT_ROLE;
  });

  const setDevRole = useCallback((next: AppRole) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEV_ROLE_KEY, next);
    }
    setRole(next);
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

