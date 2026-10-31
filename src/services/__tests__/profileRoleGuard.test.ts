import { describe, expect, it } from "vitest";

import {
  canGrantOwnerRole,
  refusalForOwnerInvite,
  refusalForProfileRoleChange,
} from "@/services/profileRoleGuard";

describe("refusalForProfileRoleChange", () => {
  it("lets an owner change someone else in the same company", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "owner-1",
        targetId: "tech-1",
        callerRole: "owner",
        sameCompany: true,
        currentRole: "tech",
        nextRole: "office",
      }),
    ).toBeNull();
  });

  it("lets an owner grant the owner role to someone else", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "owner-1",
        targetId: "manager-1",
        callerRole: "owner",
        sameCompany: true,
        currentRole: "manager",
        nextRole: "owner",
      }),
    ).toBeNull();
  });

  it("refuses a role change on the caller's own row", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "owner-1",
        targetId: "owner-1",
        callerRole: "owner",
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
        callerRole: "owner",
        sameCompany: true,
        currentRole: "owner",
        nextRole: "owner",
      }),
    ).toBeNull();
  });

  it("refuses a manager promoting someone to owner", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "manager-1",
        targetId: "tech-1",
        callerRole: "manager",
        sameCompany: true,
        currentRole: "tech",
        nextRole: "owner",
      }),
    ).toBe("Only an owner can grant or remove the owner role.");
  });

  it("refuses a manager demoting an owner", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "manager-1",
        targetId: "owner-1",
        callerRole: "manager",
        sameCompany: true,
        currentRole: "owner",
        nextRole: "tech",
      }),
    ).toBe("Only an owner can grant or remove the owner role.");
  });

  it("lets a manager change a technician to office", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "manager-1",
        targetId: "tech-1",
        callerRole: "manager",
        sameCompany: true,
        currentRole: "tech",
        nextRole: "office",
      }),
    ).toBeNull();
  });

  it("refuses a person from another company", () => {
    expect(
      refusalForProfileRoleChange({
        callerId: "owner-1",
        targetId: "tech-9",
        callerRole: "owner",
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
        callerRole: "owner",
        sameCompany: true,
        currentRole: "tech",
        nextRole: "superuser",
      }),
    ).toBe("That role is invalid.");
  });
});

describe("refusalForOwnerInvite", () => {
  it("lets an owner invite another owner", () => {
    expect(refusalForOwnerInvite({ callerRole: "owner", appRole: "owner" })).toBeNull();
  });

  it("refuses a manager inviting an owner", () => {
    expect(refusalForOwnerInvite({ callerRole: "manager", appRole: "owner" })).toBe(
      "Only an owner can grant the owner role.",
    );
  });

  it("lets a manager invite office staff", () => {
    expect(refusalForOwnerInvite({ callerRole: "manager", appRole: "office" })).toBeNull();
    expect(canGrantOwnerRole("manager")).toBe(false);
    expect(canGrantOwnerRole("owner")).toBe(true);
  });
});
