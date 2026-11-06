/**
 * Update-password flow tests.
 *
 * Covers the recovery-link fragment parser and the updateUserPassword
 * auth-client helper that power the /update-password page.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { parseRecoveryHash } from "@/features/auth/lib/recoveryLink";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateUser = vi.fn();
const mockGetSession = vi.fn();
const mockGetSupabaseBrowserClient = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: (...args: unknown[]) =>
    mockGetSupabaseBrowserClient(...args),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import {
  establishPasswordLinkSession,
  updateUserPassword,
  getRecoverySession,
} from "@/services/authClient";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// parseRecoveryHash
// ---------------------------------------------------------------------------

describe("parseRecoveryHash", () => {
  it("recognizes a recovery fragment with an access token", () => {
    expect(parseRecoveryHash("#access_token=abc123&type=recovery")).toEqual({
      isRecovery: true,
      hasAccessToken: true,
    });
  });

  it("accepts a fragment without a leading #", () => {
    expect(parseRecoveryHash("access_token=abc123&type=recovery")).toEqual({
      isRecovery: true,
      hasAccessToken: true,
    });
  });

  it("rejects non-recovery flows such as magic links", () => {
    expect(parseRecoveryHash("#access_token=abc123&type=magiclink")).toEqual({
      isRecovery: false,
      hasAccessToken: true,
    });
  });

  it("rejects an empty fragment", () => {
    expect(parseRecoveryHash("")).toEqual({
      isRecovery: false,
      hasAccessToken: false,
    });
  });

  it("rejects an error fragment with no token", () => {
    expect(
      parseRecoveryHash("#error=access_denied&error_description=expired")
    ).toEqual({ isRecovery: false, hasAccessToken: false });
  });
});

// ---------------------------------------------------------------------------
// getRecoverySession
// ---------------------------------------------------------------------------

describe("getRecoverySession", () => {
  function mockClient(sessionResult: unknown) {
    mockGetSupabaseBrowserClient.mockReturnValue({
      auth: {
        updateUser: mockUpdateUser,
        getSession: mockGetSession.mockResolvedValue(sessionResult),
      },
    });
  }

  it("returns the session when one exists", async () => {
    const session = { access_token: "tok", user: { id: "u1" } };
    mockClient({ data: { session }, error: null });

    await expect(getRecoverySession()).resolves.toBe(session);
  });

  it("returns null when getSession reports an error", async () => {
    mockClient({
      data: { session: null },
      error: { name: "AuthApiError", message: "expired" },
    });

    await expect(getRecoverySession()).resolves.toBeNull();
  });

  it("returns null when there is no session", async () => {
    mockClient({ data: { session: null }, error: null });

    await expect(getRecoverySession()).resolves.toBeNull();
  });

  it("returns null when the client is not configured", async () => {
    mockGetSupabaseBrowserClient.mockReturnValue(null);

    await expect(getRecoverySession()).resolves.toBeNull();
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});

describe("updateUserPassword", () => {
  it("returns ok:true and forwards the new password on success", async () => {
    mockGetSupabaseBrowserClient.mockReturnValue({
      auth: { updateUser: mockUpdateUser.mockResolvedValue({ error: null }) },
    });

    const result = await updateUserPassword("new-secure-password");

    expect(result).toEqual({ ok: true });
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: "new-secure-password",
    });
  });

  it("returns the supabase error when the update fails", async () => {
    mockGetSupabaseBrowserClient.mockReturnValue({
      auth: {
        updateUser: mockUpdateUser.mockResolvedValue({
          error: { name: "AuthApiError", message: "Token expired" },
        }),
      },
    });

    const result = await updateUserPassword("new-secure-password");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AuthApiError");
      expect(result.error.message).toBe("Token expired");
    }
  });

  it("returns SUPABASE_NOT_CONFIGURED when the client is missing", async () => {
    mockGetSupabaseBrowserClient.mockReturnValue(null);

    const result = await updateUserPassword("new-secure-password");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SUPABASE_NOT_CONFIGURED");
    }
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

describe("establishPasswordLinkSession", () => {
  const mockSetSession = vi.fn();
  const mockVerifyOtp = vi.fn();
  const mockExchangeCode = vi.fn();

  function mockAuth(overrides?: {
    setSession?: unknown;
    verifyOtp?: unknown;
    exchangeCode?: unknown;
  }) {
    mockGetSupabaseBrowserClient.mockReturnValue({
      auth: {
        setSession: mockSetSession.mockResolvedValue(overrides?.setSession ?? { error: null }),
        verifyOtp: mockVerifyOtp.mockResolvedValue(overrides?.verifyOtp ?? { error: null }),
        exchangeCodeForSession: mockExchangeCode.mockResolvedValue(
          overrides?.exchangeCode ?? { error: null },
        ),
      },
    });
  }

  it("applies an invite hash with setSession and does not send a role", async () => {
    mockAuth();

    await expect(
      establishPasswordLinkSession({
        accessToken: "invite-access",
        refreshToken: "invite-refresh",
        tokenHash: null,
        otpType: "invite",
        code: null,
      }),
    ).resolves.toBe(true);

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "invite-access",
      refresh_token: "invite-refresh",
    });
    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("verifies an invite token hash as type invite", async () => {
    mockAuth();

    await expect(
      establishPasswordLinkSession({
        accessToken: null,
        refreshToken: null,
        tokenHash: "hash-1",
        otpType: "invite",
        code: null,
      }),
    ).resolves.toBe(true);

    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "hash-1", type: "invite" });
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("verifies a recovery token hash as type recovery", async () => {
    mockAuth();

    await establishPasswordLinkSession({
      accessToken: null,
      refreshToken: null,
      tokenHash: "hash-2",
      otpType: "recovery",
      code: null,
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "hash-2", type: "recovery" });
  });

  it("returns false when the invite session cannot be stored", async () => {
    mockAuth({ setSession: { error: { message: "invalid" } } });

    await expect(
      establishPasswordLinkSession({
        accessToken: "invite-access",
        refreshToken: "invite-refresh",
        tokenHash: null,
        otpType: "invite",
        code: null,
      }),
    ).resolves.toBe(false);
  });
});
