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
