import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, updateOrgUserMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  updateOrgUserMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/services/settingsUsers", () => ({
  updateOrgUser: updateOrgUserMock,
  setOrgUserStatus: vi.fn(),
}));

import { PATCH } from "@/app/api/settings/users/[id]/route";

describe("PATCH /api/settings/users/[id] role change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { userId: "owner-1", role: "owner" },
    });
    updateOrgUserMock.mockResolvedValue(undefined);
  });

  it("passes the caller id so a person cannot change their own role", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/settings/users/tech-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: "Alex", role: "office" }),
      }),
      { params: Promise.resolve({ id: "tech-1" }) },
    );

    expect(response.status).toBe(200);
    expect(updateOrgUserMock).toHaveBeenCalledWith("owner-1", "tech-1", {
      fullName: "Alex",
      role: "office",
    });
  });
});
