/**
 * Auth flow integration tests.
 *
 * Verifies the behavior of the auth guard utilities and session resolution
 * logic that powers protected routes and API endpoints.
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

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const mockGetUser = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  })),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { requireApiSession } from "@/lib/auth/apiGuard";
import { requireSession, getAuthSession } from "@/lib/auth/session";
import type { User, Session } from "@supabase/supabase-js";

const mockUser: User = {
  id: "staff-user-456",
  email: "dispatcher@loop.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { role: "dispatch" },
  user_metadata: { full_name: "Alex Dispatcher" },
  created_at: new Date().toISOString(),
} as User;

const mockSession: Session = {
  access_token: "valid_token",
  refresh_token: "refresh_token",
  expires_in: 3600,
  token_type: "bearer",
  user: mockUser,
} as Session;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
});

// ---------------------------------------------------------------------------
// Positive path — valid login → access protected route + API
// ---------------------------------------------------------------------------

describe("positive: valid session", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
  });

  it("requireSession resolves with AuthSession containing user", async () => {
    const result = await requireSession();
    expect(result.user.id).toBe("staff-user-456");
    expect(result.user.email).toBe("dispatcher@loop.com");
  });

  it("requireApiSession returns success result with no error", async () => {
    const result = await requireApiSession();
    expect(result.error).toBeNull();
    expect(result.user?.id).toBe("staff-user-456");
  });

  it("getAuthSession returns user and session pair", async () => {
    const session = await getAuthSession();
    expect(session).not.toBeNull();
    expect(session?.session.access_token).toBe("valid_token");
  });
});

// ---------------------------------------------------------------------------
// Negative path — no session/token → 401 / redirect behavior
// ---------------------------------------------------------------------------

describe("negative: unauthenticated request", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("requireSession redirects to /sign-in", async () => {
    await expect(requireSession()).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("requireApiSession returns 401 response", async () => {
    const result = await requireApiSession();
    expect(result.error).not.toBeNull();
    expect(result.user).toBeNull();

    // Inspect the 401 response
    const response = result.error!;
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("getAuthSession returns null", async () => {
    const session = await getAuthSession();
    expect(session).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Expiry path — expired JWT error
// ---------------------------------------------------------------------------

describe("expiry: expired session triggers re-auth", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("JWT expired"),
    });
  });

  it("requireSession redirects to /sign-in on expired token", async () => {
    await expect(requireSession()).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("requireApiSession returns 401 on expired token", async () => {
    const result = await requireApiSession();
    expect(result.error).not.toBeNull();
    expect(result.user).toBeNull();
  });

  it("getAuthSession returns null on expired token", async () => {
    const session = await getAuthSession();
    expect(session).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Regression — getAuthSession is null-safe for partial state
// ---------------------------------------------------------------------------

describe("regression: partial auth state", () => {
  it("returns null when user is valid but session object is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const session = await getAuthSession();
    expect(session).toBeNull();
  });
});
