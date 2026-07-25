/**
 * Refresh token scenario matrix — Sprint S3.
 *
 * Covers every supported refresh scenario with deterministic expectations:
 *
 *   1.  valid refresh                    → success, authenticated
 *   2.  missing refresh token            → missing, unauthenticated
 *   3.  expired refresh token            → expired, unauthenticated
 *   4.  malformed / parse error          → malformed, unauthenticated
 *   5.  invalid JWT (bad structure)      → malformed, unauthenticated
 *   6.  invalid signature                → malformed, unauthenticated
 *   7.  revoked token                    → revoked, unauthenticated
 *   8.  rotated (replay) token           → replay_denied, unauthenticated
 *   9.  replay via "already used"        → replay_denied, unauthenticated
 *  10.  concurrent conflict — exhausted  → concurrency_conflict, unauthenticated
 *  11.  concurrent conflict — recovered  → success, authenticated (after retry)
 *  12.  near-expiry inside skew window   → expired, unauthenticated
 *  13.  session cleared after failure    → clearSession called
 *  14.  no session leak on replay denial → session cleared
 */

import { describe, it, expect, vi } from "vitest";

import { resolveAuthRefresh } from "@/lib/auth/refreshResolver";
import type { Session, User } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser: User = {
  id: "user-s3",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
} as User;

const futureSession = (offsetMs = 3_600_000): Session => ({
  access_token: "access",
  refresh_token: "refresh",
  token_type: "bearer",
  expires_in: Math.floor(offsetMs / 1000),
  expires_at: Math.floor((Date.now() + offsetMs) / 1000),
  user: mockUser,
}) as Session;

// ---------------------------------------------------------------------------
// 1. Valid refresh
// ---------------------------------------------------------------------------

describe("scenario 1 — valid refresh", () => {
  it("returns authenticated + success when user and session are valid", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({ data: { user: mockUser }, error: null }),
      getSession: async () => ({ data: { session: futureSession() }, error: null }),
    });

    expect(result.status).toBe("authenticated");
    expect(result.resolution).toBe("success");
    expect(result.user?.id).toBe("user-s3");
    expect(result.session).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it("returns success without session when getSession is not provided", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({ data: { user: mockUser }, error: null }),
    });

    expect(result.status).toBe("authenticated");
    expect(result.resolution).toBe("success");
    expect(result.session).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Missing refresh token
// ---------------------------------------------------------------------------

describe("scenario 2 — missing refresh token", () => {
  it("classifies AuthSessionMissingError as missing and clears session", async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);

    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthSessionMissingError", message: "Auth session missing", status: 401 },
      }),
      clearSession,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("missing");
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("classifies session_not_found message as missing", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "session_not_found", status: 404 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("missing");
  });

  it("retries once on missing before giving up", async () => {
    const getUser = vi
      .fn()
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: "AuthSessionMissingError", message: "session missing", status: 401 },
      })
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: "AuthSessionMissingError", message: "session missing", status: 401 },
      });

    const result = await resolveAuthRefresh({ getUser, maxRetries: 1 });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("missing");
    expect(result.attempts).toBe(2);
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Expired refresh token
// ---------------------------------------------------------------------------

describe("scenario 3 — expired refresh token", () => {
  it("classifies JWT expired error as expired", async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);

    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "JWT expired", status: 401 },
      }),
      clearSession,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("expired");
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("classifies token expired message as expired", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "Token expired", status: 401 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("expired");
  });

  it("classifies session expired message as expired", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "session expired", status: 401 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("expired");
  });
});

// ---------------------------------------------------------------------------
// 4. Malformed token (parse error)
// ---------------------------------------------------------------------------

describe("scenario 4 — malformed token (parse error)", () => {
  it("classifies Malformed JWT as malformed and clears session", async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);

    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "Malformed JWT", status: 400 },
      }),
      clearSession,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("malformed");
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("classifies parse error as malformed", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "SyntaxError", message: "Failed to parse JWT token", status: 400 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("malformed");
  });
});

// ---------------------------------------------------------------------------
// 5. Invalid JWT (bad structure)
// ---------------------------------------------------------------------------

describe("scenario 5 — invalid JWT structure", () => {
  it("classifies invalid JWT as malformed", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "invalid JWT", status: 400 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("malformed");
  });

  it("classifies bad JWT as malformed", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "bad JWT format", status: 400 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("malformed");
  });
});

// ---------------------------------------------------------------------------
// 6. Invalid signature
// ---------------------------------------------------------------------------

describe("scenario 6 — invalid signature", () => {
  it("classifies invalid signature as malformed (JWT category)", async () => {
    // Supabase auth surfaces invalid signature as a JWT-level error.
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "Invalid JWT: invalid signature", status: 401 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    // Invalid signature is a malformed-token scenario (bad structure/key mismatch).
    expect(result.resolution).toBe("malformed");
  });
});

// ---------------------------------------------------------------------------
// 7. Revoked token
// ---------------------------------------------------------------------------

describe("scenario 7 — revoked token", () => {
  it("classifies revoked message as revoked and clears session", async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);

    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "Refresh token revoked", status: 401 },
      }),
      clearSession,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("revoked");
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("classifies refresh token not found as revoked", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "refresh token not found", status: 404 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("revoked");
  });

  it("classifies invalid refresh token as revoked", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "invalid refresh token", status: 401 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("revoked");
  });
});

// ---------------------------------------------------------------------------
// 8. Rotated token (replay)
// ---------------------------------------------------------------------------

describe("scenario 8 — rotated/replay token", () => {
  it("classifies reused message as replay_denied and clears session", async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);

    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "Refresh token already used", status: 401 },
      }),
      clearSession,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("replay_denied");
    expect(clearSession).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 9. Replay via "already used"
// ---------------------------------------------------------------------------

describe("scenario 9 — replay via 'already used'", () => {
  it("classifies replay as replay_denied", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "Token has been replayed", status: 401 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("replay_denied");
  });

  it("clearSession is called on replay_denied to prevent stale session", async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);

    await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "Token reuse detected", status: 401 },
      }),
      clearSession,
    });

    expect(clearSession).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 10. Concurrent conflict — exhausted retries
// ---------------------------------------------------------------------------

describe("scenario 10 — concurrent conflict (exhausted retries)", () => {
  it("returns concurrency_conflict after maxRetries are exhausted", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "Concurrent refresh conflict", status: 409 },
    });

    const result = await resolveAuthRefresh({ getUser, maxRetries: 1 });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("concurrency_conflict");
    expect(result.attempts).toBe(2);
  });

  it("409 status alone triggers concurrency_conflict", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "lock timeout", status: 409 },
      }),
      maxRetries: 0,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("concurrency_conflict");
    expect(result.attempts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 11. Concurrent conflict — recovered on retry
// ---------------------------------------------------------------------------

describe("scenario 11 — concurrent conflict (recovered on retry)", () => {
  it("retries once and succeeds after transient conflict", async () => {
    const getUser = vi
      .fn()
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: "AuthApiError", message: "Concurrent refresh conflict", status: 409 },
      })
      .mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

    const result = await resolveAuthRefresh({
      getUser,
      getSession: async () => ({ data: { session: futureSession() }, error: null }),
      maxRetries: 1,
    });

    expect(result.status).toBe("authenticated");
    expect(result.resolution).toBe("success");
    expect(result.attempts).toBe(2);
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 12. Near-expiry inside skew window
// ---------------------------------------------------------------------------

describe("scenario 12 — near-expiry inside skew window", () => {
  it("treats session expiring within 30s skew as expired", async () => {
    const now = Date.now();
    const nearExpirySession: Session = {
      ...futureSession(),
      expires_at: Math.floor((now + 5_000) / 1000), // 5s away — inside 30s skew
    } as Session;

    const result = await resolveAuthRefresh({
      getUser: async () => ({ data: { user: mockUser }, error: null }),
      getSession: async () => ({ data: { session: nearExpirySession }, error: null }),
      now: () => now,
      expirySkewMs: 30_000,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("expired");
  });

  it("accepts a session that expires beyond the skew window", async () => {
    const now = Date.now();
    const safeSession: Session = {
      ...futureSession(),
      expires_at: Math.floor((now + 60_000) / 1000), // 60s away — outside 30s skew
    } as Session;

    const result = await resolveAuthRefresh({
      getUser: async () => ({ data: { user: mockUser }, error: null }),
      getSession: async () => ({ data: { session: safeSession }, error: null }),
      now: () => now,
      expirySkewMs: 30_000,
    });

    expect(result.status).toBe("authenticated");
    expect(result.resolution).toBe("success");
  });
});

// ---------------------------------------------------------------------------
// 13. Session cleared after failure
// ---------------------------------------------------------------------------

describe("scenario 13 — session cleared on all failure paths", () => {
  const failureCases: Array<{ name: string; message: string; expectedResolution: string }> = [
    { name: "expired", message: "JWT expired", expectedResolution: "expired" },
    { name: "revoked", message: "Refresh token revoked", expectedResolution: "revoked" },
    { name: "malformed", message: "Malformed JWT", expectedResolution: "malformed" },
  ];

  for (const { name, message, expectedResolution } of failureCases) {
    it(`clears session on ${name} failure`, async () => {
      const clearSession = vi.fn().mockResolvedValue(undefined);

      const result = await resolveAuthRefresh({
        getUser: async () => ({
          data: { user: null },
          error: { name: "AuthApiError", message, status: 401 },
        }),
        clearSession,
      });

      expect(result.resolution).toBe(expectedResolution);
      expect(clearSession).toHaveBeenCalledTimes(1);
    });
  }

  it("does not clear session on success", async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);

    await resolveAuthRefresh({
      getUser: async () => ({ data: { user: mockUser }, error: null }),
      getSession: async () => ({ data: { session: futureSession() }, error: null }),
      clearSession,
    });

    expect(clearSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 14. No session leak on replay denial
// ---------------------------------------------------------------------------

describe("scenario 14 — no session leak on replay denial", () => {
  it("user is null and session is null after replay denial", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "Refresh token already used", status: 401 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.user).toBeNull();
    expect(result.session).toBeNull();
  });

  it("user is null and session is null after revocation", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { name: "AuthApiError", message: "Refresh token revoked", status: 401 },
      }),
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.user).toBeNull();
    expect(result.session).toBeNull();
  });
});
