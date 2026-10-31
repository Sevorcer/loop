import { describe, expect, it } from "vitest";

import { refusalForProfileRoleChange } from "@/services/profileRoleGuard";

describe("refusalForProfileRoleChange", () => {
  it("lets an owner change someone else in the same company", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "owner-1",
        targetId: "tech-1",
        sameCompany: true,
        currentRole: "tech",
        nextRole: "office",
      }),
    ).toBeNull();
  });

  it("refuses a role change on the caller's own row", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "owner-1",
        targetId: "owner-1",
        sameCompany: true,
        currentRole: "owner",
        nextRole: "tech",
      }),
    ).toBe("Changing your own role is denied.");
  });

  it("allows a person to keep the same role while saving their name", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "owner-1",
        targetId: "owner-1",
        sameCompany: true,
        currentRole: "owner",
        nextRole: "owner",
      }),
    ).toBeNull();
  });

  it("refuses a person from another company", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "owner-1",
        targetId: "tech-9",
        sameCompany: false,
        currentRole: "tech",
        nextRole: "owner",
      }),
    ).toBe("That person is not in your company.");
  });

  it("refuses a role the app does not know", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "owner-1",
        targetId: "tech-1",
        sameCompany: true,
        currentRole: "tech",
        nextRole: "superuser",
      }),
    ).toBe("That role is invalid.");
  });
});
