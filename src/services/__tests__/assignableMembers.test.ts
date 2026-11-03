/**
 * listAssignableMembers — the source for the job assignee picker.
 *
 * The picker must offer active org members with a profile, the owner included,
 * and must never offer a deactivated / auth-banned account or the external
 * portal role. The list is derived from listOrgUsers (the same profiles +
 * auth-ban merge as Settings > Users), so these tests mock that source and
 * assert the inclusion/exclusion filter on top of it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const listOrgUsers = vi.fn();

vi.mock("@/services/settingsUsers", () => ({
  listOrgUsers: (...args: unknown[]) => listOrgUsers(...args),
}));

import { listAssignableMembers } from "@/services/assignableMembers";
import type { OrgUser } from "@/features/settings/types";

const CALLER = "caller-1";

function orgUser(overrides: Partial<OrgUser>): OrgUser {
  return {
    id: "user-x",
    email: "user@example.com",
    fullName: "User X",
    role: "tech",
    status: "active",
    lastSignInAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("listAssignableMembers", () => {
  beforeEach(() => {
    listOrgUsers.mockReset();
  });

  it("includes the owner and active internal members, sorted by name", async () => {
    listOrgUsers.mockResolvedValue([
      orgUser({ id: "owner-1", fullName: "Collin", role: "owner", status: "active" }),
      orgUser({ id: "tech-1", fullName: "Antonio Vilchez", role: "tech", status: "active" }),
      orgUser({ id: "office-1", fullName: "Brian Ramirez", role: "office", status: "active" }),
    ]);

    const result = await listAssignableMembers(CALLER);

    expect(listOrgUsers).toHaveBeenCalledWith(CALLER);
    expect(result).toEqual([
      { id: "tech-1", name: "Antonio Vilchez" },
      { id: "office-1", name: "Brian Ramirez" },
      { id: "owner-1", name: "Collin" },
    ]);
  });

  it("excludes deactivated / auth-banned accounts (status inactive)", async () => {
    listOrgUsers.mockResolvedValue([
      orgUser({ id: "tech-1", fullName: "Antonio Vilchez", role: "tech", status: "active" }),
      orgUser({ id: "left-1", fullName: "Sean Ryan", role: "tech", status: "inactive" }),
      orgUser({ id: "qa-1", fullName: null, email: "qacheck@legacyoneheating.net", role: "tech", status: "inactive" }),
    ]);

    const result = await listAssignableMembers(CALLER);

    expect(result).toEqual([{ id: "tech-1", name: "Antonio Vilchez" }]);
    expect(result.some((member) => member.id === "left-1")).toBe(false);
    expect(result.some((member) => member.id === "qa-1")).toBe(false);
  });

  it("excludes the external customer-portal role", async () => {
    listOrgUsers.mockResolvedValue([
      orgUser({ id: "tech-1", fullName: "Antonio Vilchez", role: "tech", status: "active" }),
      orgUser({ id: "portal-1", fullName: "Portal Customer", role: "portal", status: "active" }),
    ]);

    const result = await listAssignableMembers(CALLER);

    expect(result).toEqual([{ id: "tech-1", name: "Antonio Vilchez" }]);
  });

  it("falls back to the email when a profile has no full_name", async () => {
    listOrgUsers.mockResolvedValue([
      orgUser({ id: "noname-1", fullName: null, email: "dispatch@legacyoneheating.net", role: "dispatch", status: "active" }),
    ]);

    const result = await listAssignableMembers(CALLER);

    expect(result).toEqual([{ id: "noname-1", name: "dispatch@legacyoneheating.net" }]);
  });
});
