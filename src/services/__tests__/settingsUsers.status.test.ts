/**
 * setOrgUserStatus — org-scope, self, and last-owner guards.
 *
 * The admin ban call (auth.admin.updateUserById) is org-blind, so
 * setOrgUserStatus must refuse before it runs when the target is in another
 * company, is the caller themselves, or is the org's last active owner.
 * These tests assert the ban call is NOT reached in each refusal case.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Caller profile row (read through the session/server client).
const callerProfile = vi.fn();
// Target profile row (read through the admin client).
const targetProfile = vi.fn();
// Owner list for the last-active-owner check (admin client).
const ownerList = vi.fn();
// auth.admin calls.
const updateUserById = vi.fn().mockResolvedValue({ data: {}, error: null });
const listUsers = vi.fn().mockResolvedValue({ data: { users: [] }, error: null });

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: callerProfile,
          single: callerProfile,
        }),
      }),
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    auth: { admin: { updateUserById, listUsers } },
    from: () => ({
      select: () => ({
        // `.eq('id', …).maybeSingle()` → single target profile read.
        // `.eq('org_id', …).eq('app_role', 'owner')` → owner list (thenable).
        eq: () => ({
          maybeSingle: targetProfile,
          eq: () => ownerList(),
        }),
      }),
    }),
  })),
}));

import { setOrgUserStatus } from "@/services/settingsUsers";

const CALLER = "caller-owner-1";

function callerIsOwnerOfOrg1() {
  callerProfile.mockResolvedValue({
    data: { org_id: "org-1", app_role: "owner" },
    error: null,
  });
}

function bannedUntilNextCentury() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 50).toISOString();
}

describe("setOrgUserStatus guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateUserById.mockResolvedValue({ data: {}, error: null });
    listUsers.mockResolvedValue({ data: { users: [] }, error: null });
  });

  it("refuses a caller who is not an owner or manager", async () => {
    callerProfile.mockResolvedValue({
      data: { org_id: "org-1", app_role: "tech" },
      error: null,
    });

    await expect(
      setOrgUserStatus(CALLER, "target-1", "inactive"),
    ).rejects.toThrow(/owner or manager/i);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses a target in another company", async () => {
    callerIsOwnerOfOrg1();
    targetProfile.mockResolvedValue({
      data: { org_id: "org-2", app_role: "tech" },
      error: null,
    });

    await expect(
      setOrgUserStatus(CALLER, "other-org-user", "inactive"),
    ).rejects.toThrow(/not in your company/i);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses an unknown target (no profile row)", async () => {
    callerIsOwnerOfOrg1();
    targetProfile.mockResolvedValue({ data: null, error: null });

    await expect(
      setOrgUserStatus(CALLER, "ghost", "inactive"),
    ).rejects.toThrow(/not in your company/i);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses changing your own status", async () => {
    callerIsOwnerOfOrg1();
    targetProfile.mockResolvedValue({
      data: { org_id: "org-1", app_role: "owner" },
      error: null,
    });

    await expect(
      setOrgUserStatus(CALLER, CALLER, "inactive"),
    ).rejects.toThrow(/your own active status/i);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses deactivating the org's only owner", async () => {
    callerIsOwnerOfOrg1();
    targetProfile.mockResolvedValue({
      data: { org_id: "org-1", app_role: "owner" },
      error: null,
    });
    // Only the target is an owner.
    ownerList.mockResolvedValue({ data: [{ id: "sole-owner" }], error: null });

    await expect(
      setOrgUserStatus(CALLER, "sole-owner", "inactive"),
    ).rejects.toThrow(/last active owner/i);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("refuses deactivating an owner when every other owner is already inactive", async () => {
    callerIsOwnerOfOrg1();
    targetProfile.mockResolvedValue({
      data: { org_id: "org-1", app_role: "owner" },
      error: null,
    });
    ownerList.mockResolvedValue({
      data: [{ id: "target-owner" }, { id: "other-owner" }],
      error: null,
    });
    // The only other owner is banned → no active owner would remain.
    listUsers.mockResolvedValue({
      data: { users: [{ id: "other-owner", banned_until: bannedUntilNextCentury() }] },
      error: null,
    });

    await expect(
      setOrgUserStatus(CALLER, "target-owner", "inactive"),
    ).rejects.toThrow(/last active owner/i);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("deactivates an owner when another owner is still active", async () => {
    callerIsOwnerOfOrg1();
    targetProfile.mockResolvedValue({
      data: { org_id: "org-1", app_role: "owner" },
      error: null,
    });
    ownerList.mockResolvedValue({
      data: [{ id: "target-owner" }, { id: "other-owner" }],
      error: null,
    });
    listUsers.mockResolvedValue({
      data: { users: [{ id: "other-owner", banned_until: null }] },
      error: null,
    });

    await setOrgUserStatus(CALLER, "target-owner", "inactive");

    expect(updateUserById).toHaveBeenCalledWith(
      "target-owner",
      expect.objectContaining({ ban_duration: expect.not.stringMatching(/^none$/) }),
    );
  });

  it("deactivates a non-owner in the same company (happy path)", async () => {
    callerIsOwnerOfOrg1();
    targetProfile.mockResolvedValue({
      data: { org_id: "org-1", app_role: "tech" },
      error: null,
    });

    await setOrgUserStatus(CALLER, "tech-7", "inactive");

    expect(ownerList).not.toHaveBeenCalled(); // no owner check for a non-owner
    expect(updateUserById).toHaveBeenCalledWith(
      "tech-7",
      expect.objectContaining({ ban_duration: "876000h" }),
    );
  });

  it("reactivates a user without the last-owner check", async () => {
    callerIsOwnerOfOrg1();
    targetProfile.mockResolvedValue({
      data: { org_id: "org-1", app_role: "owner" },
      error: null,
    });

    await setOrgUserStatus(CALLER, "some-owner", "active");

    expect(ownerList).not.toHaveBeenCalled(); // reactivating never risks lockout
    expect(updateUserById).toHaveBeenCalledWith(
      "some-owner",
      expect.objectContaining({ ban_duration: "none" }),
    );
  });
});
