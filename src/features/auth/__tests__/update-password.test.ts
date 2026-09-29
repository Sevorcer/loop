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

import { updateUserPassword, getRecoverySession } from "@/services/authClient";

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
