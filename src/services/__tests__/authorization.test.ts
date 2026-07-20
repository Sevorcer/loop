import { describe, it, expect } from "vitest";
import {
  hasPermission,
  assertPermission,
  allowedRolesFor,
  AuthorizationError,
} from "../authorization";
import type { AppRole, CoreTable, TableAction } from "../authorization";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Assert that a role is ALLOWED for all listed operations. */
function expectAllowed(
  role: AppRole,
  table: CoreTable,
  actions: TableAction[]
) {
  for (const action of actions) {
    expect(
      hasPermission(role, table, action),
      `${role} should be ALLOWED to ${action} on ${table}`
    ).toBe(true);
  }
}

/** Assert that a role is DENIED for all listed operations. */
function expectDenied(
  role: AppRole,
  table: CoreTable,
  actions: TableAction[]
) {
  for (const action of actions) {
    expect(
      hasPermission(role, table, action),
      `${role} should be DENIED to ${action} on ${table}`
    ).toBe(false);
  }
}

// ─── owner ────────────────────────────────────────────────────────────────────

describe("owner role", () => {
  it("has full read/write/delete on all core tables", () => {
    const tables: CoreTable[] = [
      "customers",
      "properties",
      "contractors",
      "jobs",
      "portal_users",
      "portal_memberships",
    ];
    for (const table of tables) {
      expectAllowed("owner", table, ["select", "insert", "update", "delete"]);
    }
  });

  it("cannot update or delete job_activity (append-only log)", () => {
    expectAllowed("owner", "job_activity", ["select", "insert"]);
    expectDenied("owner", "job_activity", ["update", "delete"]);
  });
});

// ─── manager ─────────────────────────────────────────────────────────────────

describe("manager role", () => {
  it("can read/write customers, properties, contractors, jobs", () => {
    const tables: CoreTable[] = ["customers", "properties", "contractors", "jobs"];
    for (const table of tables) {
      expectAllowed("manager", table, ["select", "insert", "update"]);
    }
  });

  it("cannot delete customers, properties, contractors, or jobs", () => {
    const tables: CoreTable[] = ["customers", "properties", "contractors", "jobs"];
    for (const table of tables) {
      expectDenied("manager", table, ["delete"]);
    }
  });

  it("can read/write portal_users and portal_memberships", () => {
    expectAllowed("manager", "portal_users", ["select", "insert", "update"]);
    expectAllowed("manager", "portal_memberships", ["select", "insert", "update"]);
  });

  it("cannot delete portal_users or portal_memberships", () => {
    expectDenied("manager", "portal_users", ["delete"]);
    expectDenied("manager", "portal_memberships", ["delete"]);
  });

  it("cannot update or delete job_activity", () => {
    expectDenied("manager", "job_activity", ["update", "delete"]);
  });
});

// ─── dispatch ─────────────────────────────────────────────────────────────────

describe("dispatch role", () => {
  it("can read customers, properties, contractors, jobs, job_activity", () => {
    expectAllowed("dispatch", "customers", ["select"]);
    expectAllowed("dispatch", "properties", ["select"]);
    expectAllowed("dispatch", "contractors", ["select"]);
    expectAllowed("dispatch", "jobs", ["select"]);
    expectAllowed("dispatch", "job_activity", ["select"]);
  });

  it("can update jobs (status) and insert job_activity", () => {
    expectAllowed("dispatch", "jobs", ["update"]);
    expectAllowed("dispatch", "job_activity", ["insert"]);
  });

  it("cannot insert or delete jobs", () => {
    expectDenied("dispatch", "jobs", ["insert", "delete"]);
  });

  it("cannot mutate customers or properties", () => {
    expectDenied("dispatch", "customers", ["insert", "update", "delete"]);
    expectDenied("dispatch", "properties", ["insert", "update", "delete"]);
  });

  it("cannot mutate contractors", () => {
    expectDenied("dispatch", "contractors", ["insert", "update", "delete"]);
  });

  it("has no access to portal_users or portal_memberships", () => {
    expectDenied("dispatch", "portal_users", ["select", "insert", "update", "delete"]);
    expectDenied("dispatch", "portal_memberships", ["select", "insert", "update", "delete"]);
  });
});

// ─── tech ─────────────────────────────────────────────────────────────────────

describe("tech role", () => {
  it("can read properties and contractors", () => {
    expectAllowed("tech", "properties", ["select"]);
    expectAllowed("tech", "contractors", ["select"]);
  });

  it("can read and update jobs (own assigned rows — RLS scope enforced at DB)", () => {
    expectAllowed("tech", "jobs", ["select", "update"]);
  });

  it("can read and insert job_activity (own job rows — RLS scope enforced at DB)", () => {
    expectAllowed("tech", "job_activity", ["select", "insert"]);
  });

  it("cannot insert or delete jobs", () => {
    expectDenied("tech", "jobs", ["insert", "delete"]);
  });

  it("cannot access customers", () => {
    expectDenied("tech", "customers", ["select", "insert", "update", "delete"]);
  });

  it("cannot mutate properties or contractors", () => {
    expectDenied("tech", "properties", ["insert", "update", "delete"]);
    expectDenied("tech", "contractors", ["insert", "update", "delete"]);
  });

  it("cannot update or delete job_activity", () => {
    expectDenied("tech", "job_activity", ["update", "delete"]);
  });

  it("has no access to portal tables", () => {
    expectDenied("tech", "portal_users", ["select", "insert", "update", "delete"]);
    expectDenied("tech", "portal_memberships", ["select", "insert", "update", "delete"]);
  });
});

// ─── office ──────────────────────────────────────────────────────────────────

describe("office role", () => {
  it("can read/write customers and properties", () => {
    expectAllowed("office", "customers", ["select", "insert", "update"]);
    expectAllowed("office", "properties", ["select", "insert", "update"]);
  });

  it("can create and read jobs", () => {
    expectAllowed("office", "jobs", ["select", "insert"]);
  });

  it("can read job_activity", () => {
    expectAllowed("office", "job_activity", ["select"]);
  });

  it("cannot update or delete jobs", () => {
    expectDenied("office", "jobs", ["update", "delete"]);
  });

  it("cannot delete customers or properties", () => {
    expectDenied("office", "customers", ["delete"]);
    expectDenied("office", "properties", ["delete"]);
  });

  it("has no access to contractors", () => {
    expectDenied("office", "contractors", ["select", "insert", "update", "delete"]);
  });

  it("has no access to portal tables", () => {
    expectDenied("office", "portal_users", ["select", "insert", "update", "delete"]);
    expectDenied("office", "portal_memberships", ["select", "insert", "update", "delete"]);
  });
});

// ─── sales ───────────────────────────────────────────────────────────────────

describe("sales role", () => {
  it("can read/write customers and properties", () => {
    expectAllowed("sales", "customers", ["select", "insert", "update"]);
    expectAllowed("sales", "properties", ["select", "insert", "update"]);
  });

  it("can read jobs", () => {
    expectAllowed("sales", "jobs", ["select"]);
  });

  it("cannot create, update, or delete jobs", () => {
    expectDenied("sales", "jobs", ["insert", "update", "delete"]);
  });

  it("cannot delete customers or properties", () => {
    expectDenied("sales", "customers", ["delete"]);
    expectDenied("sales", "properties", ["delete"]);
  });

  it("has no access to contractors", () => {
    expectDenied("sales", "contractors", ["select", "insert", "update", "delete"]);
  });

  it("has no access to job_activity", () => {
    expectDenied("sales", "job_activity", ["select", "insert", "update", "delete"]);
  });

  it("has no access to portal tables", () => {
    expectDenied("sales", "portal_users", ["select", "insert", "update", "delete"]);
    expectDenied("sales", "portal_memberships", ["select", "insert", "update", "delete"]);
  });
});

// ─── portal — isolation ───────────────────────────────────────────────────────

describe("portal role — isolation from internal tables", () => {
  const internalTables: CoreTable[] = [
    "customers",
    "properties",
    "contractors",
    "jobs",
    "job_activity",
  ];
  const allActions: TableAction[] = ["select", "insert", "update", "delete"];

  it("cannot access any internal operational table (all actions denied)", () => {
    for (const table of internalTables) {
      expectDenied("portal", table, allActions);
    }
  });

  it("can read own portal_users row", () => {
    expect(hasPermission("portal", "portal_users", "select")).toBe(true);
  });

  it("can update own portal_users row", () => {
    expect(hasPermission("portal", "portal_users", "update")).toBe(true);
  });

  it("cannot insert or delete portal_users", () => {
    expectDenied("portal", "portal_users", ["insert", "delete"]);
  });

  it("can read own portal_memberships row", () => {
    expect(hasPermission("portal", "portal_memberships", "select")).toBe(true);
  });

  it("cannot insert, update, or delete portal_memberships", () => {
    expectDenied("portal", "portal_memberships", ["insert", "update", "delete"]);
  });
});

// ─── Privilege escalation scenarios ──────────────────────────────────────────

describe("privilege escalation — denied paths", () => {
  it("dispatch cannot delete any core table", () => {
    const tables: CoreTable[] = ["customers", "properties", "contractors", "jobs", "job_activity"];
    for (const table of tables) {
      expect(
        hasPermission("dispatch", table, "delete"),
        `dispatch must not be able to delete ${table}`
      ).toBe(false);
    }
  });

  it("tech cannot delete any table", () => {
    const tables: CoreTable[] = [
      "customers", "properties", "contractors", "jobs",
      "job_activity", "portal_users", "portal_memberships",
    ];
    for (const table of tables) {
      expect(
        hasPermission("tech", table, "delete"),
        `tech must not be able to delete ${table}`
      ).toBe(false);
    }
  });

  it("office cannot delete any table", () => {
    const tables: CoreTable[] = [
      "customers", "properties", "contractors", "jobs",
      "job_activity", "portal_users", "portal_memberships",
    ];
    for (const table of tables) {
      expect(
        hasPermission("office", table, "delete"),
        `office must not be able to delete ${table}`
      ).toBe(false);
    }
  });

  it("sales cannot delete any table", () => {
    const tables: CoreTable[] = [
      "customers", "properties", "contractors", "jobs",
      "job_activity", "portal_users", "portal_memberships",
    ];
    for (const table of tables) {
      expect(
        hasPermission("sales", table, "delete"),
        `sales must not be able to delete ${table}`
      ).toBe(false);
    }
  });

  it("portal cannot delete any table", () => {
    const tables: CoreTable[] = [
      "customers", "properties", "contractors", "jobs",
      "job_activity", "portal_users", "portal_memberships",
    ];
    for (const table of tables) {
      expect(
        hasPermission("portal", table, "delete"),
        `portal must not be able to delete ${table}`
      ).toBe(false);
    }
  });

  it("no role can update job_activity", () => {
    const roles: AppRole[] = ["owner", "manager", "dispatch", "tech", "office", "sales", "portal"];
    for (const role of roles) {
      expect(
        hasPermission(role, "job_activity", "update"),
        `${role} must not be able to update job_activity`
      ).toBe(false);
    }
  });

  it("no role can delete job_activity", () => {
    const roles: AppRole[] = ["owner", "manager", "dispatch", "tech", "office", "sales", "portal"];
    for (const role of roles) {
      expect(
        hasPermission(role, "job_activity", "delete"),
        `${role} must not be able to delete job_activity`
      ).toBe(false);
    }
  });

  it("portal cannot access internal tables even if stacked with other role logic", () => {
    // This test verifies the portal isolation rule is structurally enforced in
    // the permission matrix and is not bypassable by combining role checks.
    expect(hasPermission("portal", "jobs", "select")).toBe(false);
    expect(hasPermission("portal", "customers", "select")).toBe(false);
    expect(hasPermission("portal", "job_activity", "insert")).toBe(false);
  });

  it("sales cannot access contractors (no ops permission)", () => {
    expectDenied("sales", "contractors", ["select", "insert", "update", "delete"]);
  });

  it("office cannot access contractors", () => {
    expectDenied("office", "contractors", ["select", "insert", "update", "delete"]);
  });
});

// ─── assertPermission ─────────────────────────────────────────────────────────

describe("assertPermission", () => {
  it("does not throw for an allowed operation", () => {
    expect(() => assertPermission("owner", "jobs", "delete")).not.toThrow();
    expect(() => assertPermission("manager", "customers", "insert")).not.toThrow();
    expect(() => assertPermission("dispatch", "jobs", "update")).not.toThrow();
  });

  it("throws AuthorizationError for a denied operation", () => {
    expect(() => assertPermission("portal", "jobs", "select")).toThrow(AuthorizationError);
    expect(() => assertPermission("dispatch", "jobs", "insert")).toThrow(AuthorizationError);
    expect(() => assertPermission("tech", "customers", "select")).toThrow(AuthorizationError);
  });

  it("AuthorizationError carries role, table, and action metadata", () => {
    try {
      assertPermission("portal", "customers", "delete");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthorizationError);
      const authErr = err as AuthorizationError;
      expect(authErr.role).toBe("portal");
      expect(authErr.table).toBe("customers");
      expect(authErr.action).toBe("delete");
      expect(authErr.message).toContain("portal");
      expect(authErr.message).toContain("customers");
      expect(authErr.message).toContain("delete");
    }
  });
});

// ─── allowedRolesFor ──────────────────────────────────────────────────────────

describe("allowedRolesFor", () => {
  it("returns only owner for delete on jobs", () => {
    const roles = allowedRolesFor("jobs", "delete");
    expect(roles).toHaveLength(1);
    expect(roles).toContain("owner");
  });

  it("returns no roles for update on job_activity", () => {
    expect(allowedRolesFor("job_activity", "update")).toHaveLength(0);
  });

  it("returns no roles for delete on job_activity", () => {
    expect(allowedRolesFor("job_activity", "delete")).toHaveLength(0);
  });

  it("returns correct roles for jobs SELECT", () => {
    const roles = allowedRolesFor("jobs", "select");
    expect(roles).toContain("owner");
    expect(roles).toContain("manager");
    expect(roles).toContain("dispatch");
    expect(roles).toContain("tech");
    expect(roles).toContain("office");
    expect(roles).toContain("sales");
    expect(roles).not.toContain("portal");
  });
});
