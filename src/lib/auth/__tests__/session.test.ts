/**
 * Unit tests for auth session utilities.
 *
 * These tests verify the pure logic and error-path behavior of the session
 * module without requiring a live Supabase connection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock server-only and next/headers before importing the module under test.
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

// ---------------------------------------------------------------------------
// Mock @supabase/ssr createServerClient
// ---------------------------------------------------------------------------

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
// Tests
// ---------------------------------------------------------------------------

import { getAuthSession, getCurrentUser, requireSession } from "../session";
import type { User, Session } from "@supabase/supabase-js";

const mockUser: User = {
  id: "user-123",
  email: "test@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: { full_name: "Test User" },
  created_at: new Date().toISOString(),
} as User;

const mockSession: Session = {
  access_token: "tok_abc",
  refresh_token: "refresh_abc",
  expires_in: 3600,
  token_type: "bearer",
  user: mockUser,
} as Session;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset env vars
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("getAuthSession", () => {
  it("returns null when getUser errors", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("JWT expired") });

    const result = await getAuthSession();
    expect(result).toBeNull();
  });

  it("returns null when user is null", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getAuthSession();
    expect(result).toBeNull();
  });

  it("returns null when session is null despite valid user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await getAuthSession();
    expect(result).toBeNull();
  });

  it("returns AuthSession when user and session are valid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const result = await getAuthSession();
    expect(result).not.toBeNull();
    expect(result?.user.id).toBe("user-123");
    expect(result?.session.access_token).toBe("tok_abc");
  });
});

describe("getCurrentUser", () => {
  it("returns null when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("returns User when authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const user = await getCurrentUser();
    expect(user?.id).toBe("user-123");
    expect(user?.email).toBe("test@example.com");
  });
});

describe("requireSession", () => {
  it("redirects to sign-in when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(requireSession()).rejects.toThrow("REDIRECT:/sign-in");
  });

  it("returns AuthSession when authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const authSession = await requireSession();
    expect(authSession.user.id).toBe("user-123");
  });
});
