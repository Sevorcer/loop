import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const callerMaybeSingle = vi.fn();
const targetMaybeSingle = vi.fn();
const inviteUserByEmail = vi.fn();
const updateUserById = vi.fn();
const getUserById = vi.fn();
const resetPasswordForEmail = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: callerMaybeSingle }),
      }),
    }),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    auth: {
      resetPasswordForEmail,
      admin: { inviteUserByEmail, updateUserById, getUserById },
    },
    from: () => ({
      upsert,
      select: () => ({
        eq: () => ({ maybeSingle: targetMaybeSingle }),
      }),
    }),
  })),
}));

import { inviteOrgUser, resendOrgInvite } from "@/services/settingsUsers";

const ORIGIN = "https://loop.example";
const SETUP_URL = "https://loop.example/update-password?flow=invite";

describe("inviteOrgUser account setup link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callerMaybeSingle.mockResolvedValue({
      data: { org_id: "org-1", app_role: "owner" },
      error: null,
    });
    inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });
    upsert.mockResolvedValue({ error: null });
    updateUserById.mockResolvedValue({ data: { user: {} }, error: null });
  });

  it("sends an invite link to the setup page and stores the office-chosen role on the profile", async () => {
    await inviteOrgUser(
      "owner-1",
      { email: "new@example.com", fullName: "New Person", appRole: "office" },
      { origin: ORIGIN },
    );

    expect(inviteUserByEmail).toHaveBeenCalledWith("new@example.com", {
      data: { app_role: "office", full_name: "New Person" },
      redirectTo: SETUP_URL,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-2",
        org_id: "org-1",
        full_name: "New Person",
        app_role: "office",
      }),
    );
    expect(updateUserById).toHaveBeenCalledWith("user-2", {
      app_metadata: { app_role: "office" },
    });
    expect(SETUP_URL).not.toContain("recovery");
  });
});

describe("resendOrgInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callerMaybeSingle.mockResolvedValue({
      data: { org_id: "org-1", app_role: "owner" },
      error: null,
    });
    targetMaybeSingle.mockResolvedValue({
      data: { org_id: "org-1", app_role: "tech" },
      error: null,
    });
    getUserById.mockResolvedValue({
      data: { user: { id: "user-2", email: "new@example.com", last_sign_in_at: null } },
      error: null,
    });
    inviteUserByEmail.mockResolvedValue({ data: { user: { id: "user-2" } }, error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("sends another invite without letting the caller change the role", async () => {
    await resendOrgInvite("owner-1", "user-2", { origin: ORIGIN });

    expect(inviteUserByEmail).toHaveBeenCalledWith("new@example.com", {
      redirectTo: SETUP_URL,
    });
    expect(inviteUserByEmail.mock.calls[0]?.[1]).not.toHaveProperty("data");
    expect(upsert).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("sends a setup link when the first invite was already opened", async () => {
    inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { code: "email_exists", message: "A user with this email address has already been registered" },
    });

    await resendOrgInvite("owner-1", "user-2", { origin: ORIGIN });

    expect(resetPasswordForEmail).toHaveBeenCalledWith("new@example.com", {
      redirectTo: SETUP_URL,
    });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses a resend after the person has signed in", async () => {
    getUserById.mockResolvedValue({
      data: {
        user: { id: "user-2", email: "new@example.com", last_sign_in_at: "2026-11-01T00:00:00.000Z" },
      },
      error: null,
    });

    await expect(resendOrgInvite("owner-1", "user-2", { origin: ORIGIN })).rejects.toThrow(
      /already signed in/i,
    );
    expect(inviteUserByEmail).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("does not resend an invite outside the caller's company", async () => {
    targetMaybeSingle.mockResolvedValue({
      data: { org_id: "org-2", app_role: "tech" },
      error: null,
    });

    await expect(resendOrgInvite("owner-1", "user-2", { origin: ORIGIN })).rejects.toThrow(
      /not in your company/i,
    );
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("does not let a technician resend an invite", async () => {
    callerMaybeSingle.mockResolvedValue({
      data: { org_id: "org-1", app_role: "tech" },
      error: null,
    });

    await expect(resendOrgInvite("tech-1", "user-2", { origin: ORIGIN })).rejects.toThrow(
      /owner or manager/i,
    );
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });
});
