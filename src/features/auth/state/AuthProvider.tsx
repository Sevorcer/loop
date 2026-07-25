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
import { ROUTES } from "@/lib/routes";
import {
  signOutFromAuthClient,
  subscribeToAuthSession,
  type AuthSession as Session,
  type AuthUser as User,
} from "@/services/authClient";

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

  const [session, setSession] = useState<Session | null>(initialSession);
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const logTokenRefresh = (newSession: Session | null) => {
      const traceId = createCorrelationId();
      if (newSession) {
        logAuthEvent({
          event: "session_refresh_success",
          outcome: "success",
          route: "client:auth-provider",
          requestId: traceId,
          correlationId: traceId,
          userId: newSession.user?.id,
          refreshOutcome: "success",
          refreshAttempts: 1,
        });
        return;
      }

      logAuthEvent({
        event: "session_refresh_failure",
        outcome: "failure",
        route: "client:auth-provider",
        requestId: traceId,
        correlationId: traceId,
        errorCode: "CLIENT_TOKEN_REFRESH_FAILED",
        refreshOutcome: "unknown_failure",
        refreshAttempts: 1,
      });
    };

    // Subscribe to auth state changes so the UI reacts to token refresh,
    // sign-out from another tab, and session expiry.
    const unsubscribe = subscribeToAuthSession((event, newSession: Session | null) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);

      if (event === "TOKEN_REFRESHED") {
        logTokenRefresh(newSession);
      }

      // If the session is lost while on a protected page, redirect to sign-in.
      if (!newSession) {
        router.push(ROUTES.SIGN_IN);
      }
    });

    if (!unsubscribe) return;
    return unsubscribe;
  }, [router]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    const requestId = createCorrelationId();

    try {
      const result = await signOutFromAuthClient();
      if (!result.ok) {
        throw new Error(result.error.message);
      }
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
  }, [user]);

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
