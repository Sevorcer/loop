import type { Session, User } from "@supabase/supabase-js";

export type RefreshResolution =
  | "success"
  | "expired"
  | "revoked"
  | "replay_denied"
  | "concurrency_conflict"
  | "malformed"
  | "missing"
  | "unknown_failure";

type AuthErrorLike = {
  message?: string;
  name?: string;
  code?: string;
  status?: number;
};

type UserLike = { id?: string };

type UserResult<TUser extends UserLike> = {
  data: { user: TUser | null };
  error: AuthErrorLike | null;
};

type SessionResult = {
  data: { session: Session | null };
  error?: AuthErrorLike | null;
};

export interface ResolveRefreshOptions<TUser extends UserLike = UserLike> {
  getUser: () => Promise<UserResult<TUser>>;
  getSession?: () => Promise<SessionResult>;
  clearSession?: () => Promise<void>;
  now?: () => number;
  expirySkewMs?: number;
  maxRetries?: number;
}

export interface RefreshResolutionResult<TUser extends UserLike = User> {
  status: "authenticated" | "unauthenticated";
  resolution: RefreshResolution;
  user: TUser | null;
  session: Session | null;
  attempts: number;
  error: AuthErrorLike | null;
}

// One retry balances resilience for transient refresh races without creating
// long retry chains that could hide persistent auth failures.
const DEFAULT_MAX_RETRIES = 1;
// Treat sessions expiring within 30s as expired to account for clock skew and
// network latency between refresh and downstream authorization checks.
const DEFAULT_EXPIRY_SKEW_MS = 30_000;

function normalizeText(error: AuthErrorLike | null | undefined): string {
  return `${error?.name ?? ""}|${error?.code ?? ""}|${error?.message ?? ""}`.toLowerCase();
}

function isSessionExpired(
  session: Session | null,
  now: number,
  expirySkewMs: number,
): boolean {
  if (!session?.expires_at) return false;
  const expiresAtMs = session.expires_at * 1000;
  return expiresAtMs <= now + expirySkewMs;
}

function classifyFailure(
  error: AuthErrorLike | null,
  session: Session | null,
  now: number,
  expirySkewMs: number,
): RefreshResolution {
  if (session && isSessionExpired(session, now, expirySkewMs)) {
    return "expired";
  }

  const status = error?.status;
  const token = normalizeText(error);

  if (
    token.includes("jwt expired") ||
    token.includes("token expired") ||
    token.includes("session expired")
  ) {
    return "expired";
  }

  if (
    token.includes("revoked") ||
    token.includes("refresh token not found") ||
    token.includes("invalid refresh token")
  ) {
    return "revoked";
  }

  if (
    token.includes("reused") ||
    token.includes("reuse") ||
    token.includes("replay") ||
    token.includes("already used")
  ) {
    return "replay_denied";
  }

  if (
    status === 409 ||
    token.includes("conflict") ||
    token.includes("concurrent") ||
    token.includes("lock timeout")
  ) {
    return "concurrency_conflict";
  }

  if (
    token.includes("malformed") ||
    token.includes("parse") ||
    token.includes("invalid jwt") ||
    token.includes("bad jwt")
  ) {
    return "malformed";
  }

  if (
    token.includes("authsessionmissingerror") ||
    token.includes("session missing") ||
    token.includes("session_not_found")
  ) {
    return "missing";
  }

  return "unknown_failure";
}

function shouldRetry(resolution: RefreshResolution): boolean {
  return resolution === "missing" || resolution === "concurrency_conflict";
}

function canRetry(
  attempts: number,
  maxAttempts: number,
  resolution: RefreshResolution,
): boolean {
  return attempts < maxAttempts && shouldRetry(resolution);
}

async function clearSessionIfNeeded(
  clearSession: (() => Promise<void>) | undefined,
  resolution: RefreshResolution,
): Promise<void> {
  if (!clearSession) return;
  if (resolution === "success") return;
  try {
    await clearSession();
  } catch {
    // Fail closed even when cleanup fails; caller still treats as unauthenticated.
  }
}

export async function resolveAuthRefresh<TUser extends UserLike = User>(
  options: ResolveRefreshOptions<TUser>,
): Promise<RefreshResolutionResult<TUser>> {
  const maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES);
  const maxAttempts = maxRetries + 1;
  const now = options.now ?? (() => Date.now());
  const expirySkewMs = options.expirySkewMs ?? DEFAULT_EXPIRY_SKEW_MS;

  let attempts = 0;
  let lastError: AuthErrorLike | null = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    const userResult = await options.getUser();
    const user = userResult.data.user;
    lastError = userResult.error;

    if (user && !lastError) {
      if (!options.getSession) {
        return {
          status: "authenticated",
          resolution: "success",
          user,
          session: null,
          attempts,
          error: null,
        };
      }

      const sessionResult = await options.getSession();
      const sessionError = sessionResult.error ?? null;
      const session = sessionResult.data.session;
      const sessionExpired = isSessionExpired(session, now(), expirySkewMs);

      if (!sessionError && session && !sessionExpired) {
        return {
          status: "authenticated",
          resolution: "success",
          user,
          session,
          attempts,
          error: null,
        };
      }

      const resolution = sessionExpired
        ? "expired"
        : classifyFailure(
            sessionError ?? {
              name: "SESSION_NOT_FOUND",
              message: "No session returned for authenticated user.",
            },
            session,
            now(),
            expirySkewMs,
          );

      if (canRetry(attempts, maxAttempts, resolution)) {
        continue;
      }

      await clearSessionIfNeeded(options.clearSession, resolution);
      return {
        status: "unauthenticated",
        resolution,
        user: null,
        session: null,
        attempts,
        error: sessionError,
      };
    }

    const resolution = classifyFailure(lastError, null, now(), expirySkewMs);
    if (canRetry(attempts, maxAttempts, resolution)) {
      continue;
    }

    await clearSessionIfNeeded(options.clearSession, resolution);
    return {
      status: "unauthenticated",
      resolution,
      user: null,
      session: null,
      attempts,
      error: lastError,
    };
  }

  await clearSessionIfNeeded(options.clearSession, "unknown_failure");
  return {
    status: "unauthenticated",
    resolution: "unknown_failure",
    user: null,
    session: null,
    attempts,
    error: lastError,
  };
}
