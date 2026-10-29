import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser, mockGetSession, mockSignOut } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetSession: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
      signOut: mockSignOut,
    },
  })),
}));

import { proxy } from "@/proxy";

function incoming(path: string) {
  return new NextRequest(new URL(path, "https://loop.example"));
}

function asUnauthenticated() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
  });
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  mockSignOut.mockResolvedValue({ error: null });
}

function asAuthenticated() {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  mockGetSession.mockResolvedValue({
    data: {
      session: {
        expires_at: expiresAt,
        access_token: "access",
        refresh_token: "refresh",
        token_type: "bearer",
        user: { id: "user-1" },
      },
    },
    error: null,
  });
  mockSignOut.mockResolvedValue({ error: null });
}

describe("proxy session guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    asUnauthenticated();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets CI token routes through without a session so the handler can check the bearer token", async () => {
    for (const path of ["/api/admin/db-health/check", "/api/admin/smoke-test", "/api/admin/smoke-test/"]) {
      mockGetUser.mockClear();
      const response = await proxy(incoming(path));
      expect(response.status, path).toBe(200);
      expect(mockGetUser, path).not.toHaveBeenCalled();
    }
  });

  it("still rejects other API routes when there is no session", async () => {
    for (const path of [
      "/api/jobs",
      "/api/admin/db-health/runs",
      "/api/admin/db-health/check/extra",
      "/api/admin/db-health/checkup",
    ]) {
      const response = await proxy(incoming(path));
      expect(response.status, path).toBe(401);
      const body = await response.json();
      expect(body.error, path).toBe("UNAUTHORIZED");
    }
  });

  it("redirects anonymous visitors away from shell routes that were missing from the guard", async () => {
    for (const path of ["/command-center", "/calendar", "/operations", "/ops/feedback", "/dashboard"]) {
      const response = await proxy(incoming(path));
      expect(response.status, path).toBe(307);
      const location = new URL(response.headers.get("location") ?? "", "https://loop.example");
      expect(location.pathname, path).toBe("/sign-in");
      expect(location.searchParams.get("next"), path).toBe(path);
    }
  });

  it("does not redirect an authenticated visitor from those shell routes", async () => {
    asAuthenticated();
    const response = await proxy(incoming("/command-center"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps the sign-in page public", async () => {
    const response = await proxy(incoming("/sign-in"));
    expect(response.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("still lets CI token routes through when production has no Supabase env", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const health = await proxy(incoming("/api/admin/db-health/check"));
    expect(health.status).toBe(200);

    const jobs = await proxy(incoming("/api/jobs"));
    expect(jobs.status).toBe(307);
    expect(new URL(jobs.headers.get("location") ?? "", "https://loop.example").pathname).toBe(
      "/sign-in",
    );
  });
});
