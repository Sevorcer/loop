import { describe, it, expect, vi } from "vitest";

import { resolveAuthRefresh } from "@/lib/auth/refreshResolver";
import type { Session, User } from "@supabase/supabase-js";

const mockUser: User = {
  id: "user-1",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
} as User;

const validSession: Session = {
  access_token: "access",
  refresh_token: "refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: mockUser,
} as Session;

describe("resolveAuthRefresh", () => {
  it("returns success when user and session are valid", async () => {
    const result = await resolveAuthRefresh({
      getUser: async () => ({ data: { user: mockUser }, error: null }),
      getSession: async () => ({ data: { session: validSession }, error: null }),
    });

    expect(result.status).toBe("authenticated");
    expect(result.resolution).toBe("success");
    expect(result.user?.id).toBe("user-1");
  });

  it("classifies refresh token reuse as replay_denied and clears session", async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);

    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { message: "Refresh token already used", name: "AuthApiError", status: 401 },
      }),
      clearSession,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("replay_denied");
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("classifies malformed token failures and clears session", async () => {
    const clearSession = vi.fn().mockResolvedValue(undefined);

    const result = await resolveAuthRefresh({
      getUser: async () => ({
        data: { user: null },
        error: { message: "Malformed JWT", name: "AuthApiError", status: 400 },
      }),
      clearSession,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("malformed");
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("retries once on concurrency conflict before succeeding", async () => {
    const getUser = vi
      .fn()
      .mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Concurrent refresh conflict", status: 409, name: "AuthApiError" },
      })
      .mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

    const result = await resolveAuthRefresh({
      getUser,
      getSession: async () => ({ data: { session: validSession }, error: null }),
    });

    expect(result.status).toBe("authenticated");
    expect(result.resolution).toBe("success");
    expect(result.attempts).toBe(2);
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("treats near-expiry sessions inside skew window as expired", async () => {
    const now = Date.now();
    const expiringSession: Session = {
      ...validSession,
      expires_at: Math.floor((now + 5_000) / 1000),
    } as Session;

    const result = await resolveAuthRefresh({
      getUser: async () => ({ data: { user: mockUser }, error: null }),
      getSession: async () => ({ data: { session: expiringSession }, error: null }),
      now: () => now,
      expirySkewMs: 30_000,
    });

    expect(result.status).toBe("unauthenticated");
    expect(result.resolution).toBe("expired");
  });
});
