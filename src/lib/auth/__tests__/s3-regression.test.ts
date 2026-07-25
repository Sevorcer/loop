/**
 * Sprint S3 — Auth/Session Regression Tests.
 *
 * Regression coverage for the auth/session reliability hardening sprint:
 *
 * 1. Auth context preserved through the request lifecycle (no partial-auth state)
 * 2. Auth decision emitted exactly once per request (no duplicate events)
 * 3. Correlation IDs propagated through auth deny responses
 * 4. requireApiSession and requirePermission fail closed — never grant access
 *    when session resolution fails
 * 5. Auth errors never expose session tokens or sensitive internal details
 *
 * These tests pin the behaviour fixed in the Sprint 27 auth/RLS regression
 * incident (see docs/incidents/auth-rls-write-path-closeout.md).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
      signOut: mockSignOut,
    },
  })),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { requireApiSession } from "@/lib/auth/apiGuard";
import { requireSession, getAuthSession } from "@/lib/auth/session";
import {
  resetAuthObservabilityStateForTests,
} from "@/lib/observability/auth";
import type { User, Session } from "@supabase/supabase-js";

const mockUser: User = {
  id: "regression-user-s3",
  email: "owner@loop.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { app_role: "owner" },
  user_metadata: {},
  created_at: new Date().toISOString(),
} as User;

const mockSession: Session = {
  access_token: "valid_access_token",
  refresh_token: "valid_refresh_token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: mockUser,
} as Session;

beforeEach(() => {
  vi.clearAllMocks();
  resetAuthObservabilityStateForTests();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  mockSignOut.mockResolvedValue({ error: null });
});

// ---------------------------------------------------------------------------
// Regression 1 — Auth context preserved (no partial-auth state)
// ---------------------------------------------------------------------------

describe("regression: auth context preserved through request lifecycle", () => {
  it("getAuthSession returns a complete AuthSession (user + session both present)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    const result = await getAuthSession();

    // Both user and session must be non-null — partial auth state must never leak.
    expect(result).not.toBeNull();
    expect(result?.user).not.toBeNull();
    expect(result?.session).not.toBeNull();
    expect(result?.user.id).toBe("regression-user-s3");
    expect(result?.session.access_token).toBe("valid_access_token");
  });

  it("returns null (not partial) when user is present but session is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    // Session is null — simulates the incident partial-auth state.
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    const result = await getAuthSession();

    // Must return null — never a partial {user, session: null} object.
    expect(result).toBeNull();
  });

  it("returns null when user is missing even if getSession would succeed", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    const result = await getAuthSession();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Regression 2 — requireSession/requireApiSession fail closed
// ---------------------------------------------------------------------------

describe("regression: fail-closed behavior on all error paths", () => {
  it("requireSession redirects to sign-in on expired token (never returns partial session)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "JWT expired", status: 401 },
    });

    await expect(requireSession()).rejects.toThrow(/REDIRECT/);
  });

  it("requireApiSession returns 401 on revoked token (never returns partial user)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "Refresh token revoked", status: 401 },
    });

    const result = await requireApiSession();
    expect(result.error).not.toBeNull();
    expect(result.user).toBeNull();
    expect(result.error?.status).toBe(401);
  });

  it("requireApiSession returns 401 on malformed token (never returns partial user)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "Malformed JWT", status: 400 },
    });

    const result = await requireApiSession();
    expect(result.error).not.toBeNull();
    expect(result.user).toBeNull();
  });

  it("requireApiSession returns 401 on replay denial and calls signOut", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "Refresh token already used", status: 401 },
    });

    const result = await requireApiSession();
    expect(result.error?.status).toBe(401);
    expect(result.user).toBeNull();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Regression 3 — Correlation IDs propagated through 401 responses
// ---------------------------------------------------------------------------

describe("regression: correlation IDs propagated through deny responses", () => {
  it("401 response from requireApiSession carries x-request-id header", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const request = new Request("http://localhost/api/jobs", {
      headers: {
        "x-request-id": "req-s3-regression-1",
        "x-correlation-id": "corr-s3-regression-1",
      },
    });

    const result = await requireApiSession(request);
    expect(result.error).not.toBeNull();
    expect(result.error?.headers.get("x-request-id")).toBe("req-s3-regression-1");
    expect(result.error?.headers.get("x-correlation-id")).toBe("corr-s3-regression-1");
  });

  it("401 response carries a generated x-request-id when no header is provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireApiSession(new Request("http://localhost/api/jobs"));
    expect(result.error).not.toBeNull();
    const requestId = result.error?.headers.get("x-request-id");
    expect(requestId).toBeTruthy();
    expect(typeof requestId).toBe("string");
  });

  it("401 body does not contain sensitive session details", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireApiSession(new Request("http://localhost/api/properties"));
    expect(result.error).not.toBeNull();
    const body = await result.error!.json() as Record<string, unknown>;

    // Must not leak tokens, email addresses, or internal stack traces.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("refresh_token");
    expect(serialized).not.toContain("supabase");
    expect(serialized).not.toContain("@");
    // Must only contain defined contract fields.
    expect(body.error).toBe("UNAUTHORIZED");
    expect(typeof body.message).toBe("string");
    expect(body.code).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Regression 4 — Auth decision emitted exactly once
// ---------------------------------------------------------------------------

describe("regression: auth decision emitted exactly once per request", () => {
  it("requireApiSession emits one session_refresh_success event on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await requireApiSession(new Request("http://localhost/api/jobs"));

    const authEvents = infoSpy.mock.calls.filter(
      (call) => typeof call[1] === "string" && call[1].includes("session_refresh_success"),
    );
    // Exactly one session_refresh_success — no duplicates.
    expect(authEvents.length).toBe(1);
  });

  it("requireApiSession emits one unauthorized_access_attempt event on failure", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await requireApiSession(new Request("http://localhost/api/jobs"));

    const denyEvents = infoSpy.mock.calls.filter(
      (call) => typeof call[1] === "string" && call[1].includes("unauthorized_access_attempt"),
    );
    // Exactly one deny event — no duplicates.
    expect(denyEvents.length).toBe(1);
  });

  it("getAuthSession emits one session_refresh_failure event on error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "JWT expired", status: 401 },
    });
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await getAuthSession();

    const failureEvents = infoSpy.mock.calls.filter(
      (call) => typeof call[1] === "string" && call[1].includes("session_refresh_failure"),
    );
    // Exactly one failure event — no duplicates.
    expect(failureEvents.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Regression 5 — 401 vs 403 semantics are consistent
// ---------------------------------------------------------------------------

describe("regression: 401 vs 403 response semantics", () => {
  it("missing session → 401 with UNAUTHORIZED and reason", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireApiSession();
    expect(result.error?.status).toBe(401);
    const body = await result.error!.json() as Record<string, unknown>;
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.code).toBe(401);
    expect(typeof body.reason).toBe("string");
  });

  it("401 response has WWW-Authenticate header", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireApiSession();
    const wwwAuth = result.error?.headers.get("www-authenticate");
    expect(wwwAuth).toContain("Bearer");
    expect(wwwAuth).toContain('realm="loop"');
  });

  it("401 response has no-store cache-control header", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireApiSession();
    expect(result.error?.headers.get("cache-control")).toBe("no-store");
  });

  it("expired token → 401 with expired_token reason", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "JWT expired", status: 401 },
    });

    const result = await requireApiSession();
    const body = await result.error!.json() as Record<string, unknown>;
    expect(result.error?.status).toBe(401);
    expect(body.reason).toBe("expired_token");
  });
});

// ---------------------------------------------------------------------------
// Regression 6 — Concurrent refresh retries and recovers
// ---------------------------------------------------------------------------

describe("regression: concurrent refresh — retry recovers without stale session", () => {
  it("recovers from transient concurrent conflict on first retry", async () => {
    mockGetUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: "AuthApiError", message: "Concurrent refresh conflict", status: 409 },
      })
      .mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    const result = await getAuthSession();
    expect(result).not.toBeNull();
    expect(result?.user.id).toBe("regression-user-s3");
    // Two getUser calls: first conflict, second success.
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });

  it("after recovery the returned session is not stale", async () => {
    mockGetUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: "AuthApiError", message: "concurrent", status: 409 },
      })
      .mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    const result = await getAuthSession();
    // Session must be the one returned after the retry, not a cached/stale value.
    expect(result?.session.access_token).toBe("valid_access_token");
  });
});
