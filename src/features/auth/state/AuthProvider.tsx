"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useRouter } from "next/navigation";

import { createCorrelationId, logAuthEvent } from "@/lib/observability/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/routes";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  /** The currently authenticated user, or `null` if unauthenticated. */
  user: User | null;
  /** The current Supabase session, or `null` if unauthenticated. */
  session: Session | null;
  /** `true` while the initial session is being resolved. */
  isLoading: boolean;
  /** Signs the user out and redirects to the sign-in page. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: ReactNode;
  /**
   * Initial session from the server, passed from the shell layout server
   * component so the client never renders in an unauthenticated flash state.
   */
  initialSession: Session | null;
}

export function AuthProvider({ children, initialSession }: AuthProviderProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [session, setSession] = useState<Session | null>(initialSession);
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // No-op when Supabase is not configured (e.g. local dev without env vars).
    if (!supabase) return;

    // Subscribe to auth state changes so the UI reacts to token refresh,
    // sign-out from another tab, and session expiry.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, newSession: Session | null) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);

      // If the session is lost while on a protected page, redirect to sign-in.
      if (!newSession) {
        router.push(ROUTES.SIGN_IN);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    const requestId = createCorrelationId();

    try {
      await supabase.auth.signOut();
      logAuthEvent({
        event: "sign_out",
        outcome: "success",
        route: ROUTES.SIGN_IN,
        requestId,
        correlationId: requestId,
        statusCode: 200,
        userId: user?.id,
      });
      // `onAuthStateChange` will fire and handle the redirect.
    } catch (error) {
      logAuthEvent({
        event: "sign_out",
        outcome: "failure",
        route: ROUTES.SIGN_IN,
        requestId,
        correlationId: requestId,
        statusCode: 500,
        userId: user?.id,
        errorCode: "CLIENT_SIGN_OUT_FAILED",
        details: {
          message: error instanceof Error ? error.message : "Unknown sign-out failure.",
        },
      });
      setIsLoading(false);
    }
  }, [supabase, user]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, session, isLoading, signOut }),
    [user, session, isLoading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Default no-op context — used when rendering outside of AuthProvider
// (e.g. root not-found page, error pages).
// ---------------------------------------------------------------------------

const defaultAuthContext: AuthContextValue = {
  user: null,
  session: null,
  isLoading: false,
  signOut: async () => {},
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current auth context.
 *
 * When called outside of an `AuthProvider` (e.g. error/not-found pages),
 * returns a safe no-op default rather than throwing.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext) ?? defaultAuthContext;
}
