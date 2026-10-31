import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const profileMaybeSingle = vi.fn();
const inviteUserByEmail = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: profileMaybeSingle,
          single: profileMaybeSingle,
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    auth: { admin: { inviteUserByEmail, updateUserById: vi.fn() } },
    from: () => ({
      upsert: vi.fn(),
      update: () => ({ eq: vi.fn() }),
      select: () => ({ eq: () => ({ maybeSingle: vi.fn() }) }),
    }),
  })),
}));

import { inviteOrgUser, updateOrgUser } from "@/services/settingsUsers";

describe("staff writes re-read the caller profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not invite an owner when the profile is a technician, even if metadata says owner", async () => {
    profileMaybeSingle.mockResolvedValue({
      data: { org_id: "org-1", app_role: "tech" },
      error: null,
    });

    await expect(
      inviteOrgUser("tech-1", {
        email: "new@example.com",
        fullName: "New Owner",
        appRole: "owner",
      }),
    ).rejects.toThrow(/owner or manager/i);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("does not let a technician profile change someone else's role", async () => {
    profileMaybeSingle.mockResolvedValue({
      data: { org_id: "org-1", app_role: "tech" },
      error: null,
    });

    await expect(
      updateOrgUser("tech-1", "other-1", { role: "owner", fullName: "Pat" }),
    ).rejects.toThrow(/owner or manager/i);
  });

  it("does not let a manager profile grant the owner role", async () => {
    profileMaybeSingle.mockResolvedValueOnce({
      data: { org_id: "org-1", app_role: "manager" },
      error: null,
    });

    await expect(
      inviteOrgUser("manager-1", {
        email: "new@example.com",
        fullName: "New Owner",
        appRole: "owner",
      }),
    ).rejects.toThrow(/only an owner can grant the owner role/i);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });
});
