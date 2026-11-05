import { describe, it, expect } from "vitest";
import {
  hasPermissionWithOverrides,
  isLockedDeny,
  isEmptySetInvariant,
  getCodeMatrixPermission,
  type RoleOverride,
  type UserOverride,
} from "../authorization";

describe("hasPermissionWithOverrides", () => {
  // Priority: user override > role override > code matrix

  it("falls back to code matrix when no overrides provided", () => {
    expect(hasPermissionWithOverrides("tech", "jobs", "select")).toBe(true);
    expect(hasPermissionWithOverrides("tech", "jobs", "delete")).toBe(false);
  });

  it("role override beats code matrix", () => {
    const roleOverrides: RoleOverride[] = [
      { role: "tech", table: "jobs", action: "delete", allowed: true },
    ];
    expect(
      hasPermissionWithOverrides("tech", "jobs", "delete", { roleOverrides }),
    ).toBe(true);
  });

  it("user override beats role override", () => {
    const roleOverrides: RoleOverride[] = [
      { role: "tech", table: "jobs", action: "delete", allowed: true },
    ];
    const userOverrides: UserOverride[] = [
      { userId: "user-1", table: "jobs", action: "delete", allowed: false },
    ];
    expect(
      hasPermissionWithOverrides("tech", "jobs", "delete", {
        userId: "user-1",
        roleOverrides,
        userOverrides,
      }),
    ).toBe(false);
  });

  it("user override beats code matrix default", () => {
    const userOverrides: UserOverride[] = [
      { userId: "user-1", table: "jobs", action: "select", allowed: false },
    ];
    expect(
      hasPermissionWithOverrides("tech", "jobs", "select", {
        userId: "user-1",
        userOverrides,
      }),
    ).toBe(false);
  });

  // Owner lockout prevention

  it("owner always has permission (even if role override says deny)", () => {
    const roleOverrides: RoleOverride[] = [
      { role: "owner", table: "jobs", action: "delete", allowed: false },
    ];
    expect(
      hasPermissionWithOverrides("owner", "jobs", "delete", { roleOverrides }),
    ).toBe(true);
  });

  it("owner is still denied on empty-set invariants", () => {
    expect(hasPermissionWithOverrides("owner", "job_activity", "update")).toBe(false);
  });

  // Append-only / empty-set invariant enforcement

  it("cannot grant delete on append-only table via role override", () => {
    const roleOverrides: RoleOverride[] = [
      { role: "tech", table: "job_activity", action: "delete", allowed: true },
    ];
    expect(
      hasPermissionWithOverrides("tech", "job_activity", "delete", { roleOverrides }),
    ).toBe(false);
  });

  it("cannot grant update on append-only table via user override", () => {
    const userOverrides: UserOverride[] = [
      { userId: "user-1", table: "job_notes", action: "update", allowed: true },
    ];
    expect(
      hasPermissionWithOverrides("tech", "job_notes", "update", {
        userId: "user-1",
        userOverrides,
      }),
    ).toBe(false);
  });

  it("empty-set invariant blocks all overrides", () => {
    const roleOverrides: RoleOverride[] = [
      { role: "manager", table: "job_financials_history", action: "update", allowed: true },
    ];
    const userOverrides: UserOverride[] = [
      { userId: "user-1", table: "job_financials_history", action: "update", allowed: true },
    ];
    expect(
      hasPermissionWithOverrides("manager", "job_financials_history", "update", {
        userId: "user-1",
        roleOverrides,
        userOverrides,
      }),
    ).toBe(false);
  });
});

describe("isLockedDeny", () => {
  it("returns true for append-only table actions", () => {
    expect(isLockedDeny("job_activity", "update")).toBe(true);
    expect(isLockedDeny("job_activity", "delete")).toBe(true);
    expect(isLockedDeny("job_notes", "update")).toBe(true);
    expect(isLockedDeny("job_notes", "delete")).toBe(true);
    expect(isLockedDeny("job_callbacks", "update")).toBe(true);
    expect(isLockedDeny("job_financials_history", "update")).toBe(true);
    expect(isLockedDeny("job_financials_history", "delete")).toBe(true);
  });

  it("returns false for normal table actions", () => {
    expect(isLockedDeny("jobs", "select")).toBe(false);
    expect(isLockedDeny("jobs", "delete")).toBe(false);
    expect(isLockedDeny("customers", "update")).toBe(false);
  });

  it("returns true for empty-set invariants", () => {
    expect(isLockedDeny("db_health_check_runs", "insert")).toBe(true);
    expect(isLockedDeny("db_health_check_runs", "update")).toBe(true);
    expect(isLockedDeny("db_health_check_runs", "delete")).toBe(true);
  });
});

describe("isEmptySetInvariant", () => {
  it("identifies empty-set actions", () => {
    expect(isEmptySetInvariant("job_activity", "update")).toBe(true);
    expect(isEmptySetInvariant("job_activity", "delete")).toBe(true);
    expect(isEmptySetInvariant("db_health_check_runs", "insert")).toBe(true);
  });

  it("returns false for non-empty sets", () => {
    expect(isEmptySetInvariant("jobs", "select")).toBe(false);
    expect(isEmptySetInvariant("jobs", "delete")).toBe(false);
  });
});

describe("getCodeMatrixPermission", () => {
  it("returns code matrix default for owner", () => {
    expect(getCodeMatrixPermission("owner", "jobs", "select")).toBe(true);
    expect(getCodeMatrixPermission("owner", "jobs", "delete")).toBe(true);
  });

  it("returns false for owner on empty-set invariants", () => {
    expect(getCodeMatrixPermission("owner", "job_activity", "update")).toBe(false);
  });

  it("returns correct defaults for other roles", () => {
    expect(getCodeMatrixPermission("tech", "jobs", "select")).toBe(true);
    expect(getCodeMatrixPermission("tech", "jobs", "delete")).toBe(false);
    expect(getCodeMatrixPermission("sales", "customers", "select")).toBe(true);
  });
});
