import { describe, it, expect } from "vitest";
import {
  getPermissionRowsForRole,
  getRolesForTableAction,
  OPERATIONAL_ROLES,
  ROLE_LABELS,
  DISPLAY_TABLES,
  ACTION_LABELS,
} from "../utils/permissionsMatrix";

describe("permissionsMatrix", () => {
  it("getPermissionRowsForRole returns a row for each display table", () => {
    const rows = getPermissionRowsForRole("owner");
    expect(rows).toHaveLength(DISPLAY_TABLES.length);
  });

  it("owner has select permission on all display tables", () => {
    const rows = getPermissionRowsForRole("owner");
    for (const row of rows) {
      expect(row.permissions.select).toBe(true);
    }
  });

  it("tech has select on jobs", () => {
    const rows = getPermissionRowsForRole("tech");
    const jobsRow = rows.find((r) => r.table === "jobs");
    expect(jobsRow?.permissions.select).toBe(true);
  });

  it("tech cannot delete jobs", () => {
    const rows = getPermissionRowsForRole("tech");
    const jobsRow = rows.find((r) => r.table === "jobs");
    expect(jobsRow?.permissions.delete).toBe(false);
  });

  it("only owner can manage user_profiles delete", () => {
    const allowed = getRolesForTableAction("user_profiles", "delete");
    expect(allowed).toContain("owner");
    expect(allowed).not.toContain("manager");
    expect(allowed).not.toContain("tech");
  });

  it("owner and manager can select user_profiles", () => {
    const allowed = getRolesForTableAction("user_profiles", "select");
    expect(allowed).toContain("owner");
    expect(allowed).toContain("manager");
    expect(allowed).not.toContain("tech");
  });

  it("all operational roles have labels", () => {
    for (const role of OPERATIONAL_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it("all actions have labels", () => {
    for (const label of Object.values(ACTION_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
