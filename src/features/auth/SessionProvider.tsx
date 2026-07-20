"use client";

/**
 * SessionProvider — dev/mock session context for Sprint 25.
 *
 * Resolves the active role from localStorage key `loop_dev_role` (default:
 * "owner") so any role can be simulated in the browser without a real auth
 * backend.
 *
 * TODO: Replace the localStorage resolver with a real Supabase session hook
 * once auth is integrated. The context shape and hook API are stable.
 *
 * Security note: This is a UX-only guard. All sensitive operations are
 * enforced server-side via `assertPermission` in src/services/authorization.ts
 * and Supabase RLS policies in database/policies/.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { AppRole } from "@/services/authorization";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface SessionContextValue {
  /** The resolved role for the current user. Null while loading. */
  role: AppRole | null;
  /** True until the session has been resolved from the auth provider. */
  loading: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  role: null,
  loading: true,
});

// ---------------------------------------------------------------------------
// DEV_ROLE_KEY
//
// In development, set this localStorage key to any AppRole value to simulate
// a different role without requiring a real auth flow.
//
// Example (browser console): localStorage.setItem("loop_dev_role", "tech")
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

function resolveDevRole(): AppRole {
  try {
    const stored = localStorage.getItem(DEV_ROLE_KEY);
    if (stored && VALID_ROLES.has(stored)) {
      return stored as AppRole;
    }
  } catch {
    // localStorage unavailable (e.g. SSR or privacy mode)
  }
  return DEFAULT_ROLE;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Resolve synchronously from localStorage on mount. A real implementation
    // would await a Supabase getSession() call here.
    const resolved = resolveDevRole();
    setRole(resolved);
    setLoading(false);
  }, []);

  return (
    <SessionContext.Provider value={{ role, loading }}>
      {children}
    </SessionContext.Provider>
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
  return useContext(SessionContext);
}
