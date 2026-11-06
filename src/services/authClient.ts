import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

export type AuthSession = Session;
export type AuthUser = User;

export interface AuthClientError {
  code: string;
  message: string;
}

export function isAuthClientConfigured(): boolean {
  return getSupabaseBrowserClient() !== null;
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return {
      ok: false as const,
      error: {
        code: "SUPABASE_NOT_CONFIGURED",
        message: "Authentication is not configured. Please contact support.",
      },
    };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      ok: false as const,
      error: {
        code: error.name,
        message: error.message,
      },
    };
  }

  return { ok: true as const };
}

/**
 * Returns the current browser session, if any.
 *
 * Used by the password-recovery page: the Supabase browser client consumes
 * the recovery session from the URL fragment on initialization
 * (detectSessionInUrl), so by the time this runs the session is available
 * via getSession(). Returns null when auth is unconfigured, the fragment
 * carried no usable token, or the link expired.
 */
export async function getRecoverySession(): Promise<AuthSession | null> {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();

  if (error) return null;

  return data.session;
}

/**
 * Turn an invite or recovery link into a session.
 *
 * Admin emails (invite and the office "reset password" action) redirect back
 * with the session in the URL hash. The SSR browser client is PKCE-only and
 * will not read that hash, so the tokens have to be applied here. `token_hash`
 * covers a template that points at this app instead of Supabase's verify URL.
 * `code` covers a PKCE recovery that was started in this browser.
 */
export async function establishPasswordLinkSession(input: {
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  otpType: "invite" | "recovery" | null;
  code: string | null;
}): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) return false;

  if (input.accessToken && input.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
    });
    return !error;
  }

  if (input.tokenHash && input.otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: input.tokenHash,
      type: input.otpType,
    });
    return !error;
  }

  if (input.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(input.code);
    return !error;
  }

  return false;
}

export async function signOutFromAuthClient() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return {
      ok: false as const,
      error: {
        code: "SUPABASE_NOT_CONFIGURED",
        message: "Authentication is not configured.",
      },
    };
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      ok: false as const,
      error: {
        code: error.name,
        message: error.message,
      },
    };
  }

  return { ok: true as const };
}

export async function updateUserPassword(newPassword: string) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return {
      ok: false as const,
      error: {
        code: "SUPABASE_NOT_CONFIGURED",
        message: "Authentication is not configured.",
      },
    };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return {
      ok: false as const,
      error: {
        code: error.name,
        message: error.message,
      },
    };
  }

  return { ok: true as const };
}

export function subscribeToAuthSession(
  callback: (event: AuthChangeEvent, session: AuthSession | null) => void
): (() => void) | null {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) return null;

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (event: AuthChangeEvent, session: Session | null) => {
      callback(event, session);
    }
  );

  return () => subscription.unsubscribe();
}
