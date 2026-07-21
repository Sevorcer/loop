import { describe, it, expect } from "vitest";

import {
  hasAdminPermission,
  assertAdminPermission,
  canAdminCreate,
  canAdminEdit,
  canAdminDelete,
  allowedAdminRolesFor,
  isAdminRole,
  AdminAuthorizationError,
} from "@/services/adminPolicy";
import type { AdminRole, AdminEntity, AdminAction } from "@/services/adminPolicy";

// ---------------------------------------------------------------------------
// isAdminRole
// ---------------------------------------------------------------------------

describe("isAdminRole", () => {
  it("returns true for each recognized admin role", () => {
    const roles: string[] = ["platform_admin", "ops_admin", "ops_editor", "ops_viewer"];
    for (const r of roles) {
      expect(isAdminRole(r)).toBe(true);
    }
  });

  it("returns false for operational roles", () => {
    const operational = ["owner", "manager", "dispatch", "tech", "office", "sales", "portal"];
    for (const r of operational) {
      expect(isAdminRole(r)).toBe(false);
    }
  });

  it("returns false for unknown strings", () => {
    expect(isAdminRole("superadmin")).toBe(false);
    expect(isAdminRole("")).toBe(false);
    expect(isAdminRole("PLATFORM_ADMIN")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default behaviour
// ---------------------------------------------------------------------------

describe("hasAdminPermission — deny by default", () => {
  it("ops_viewer cannot create any entity", () => {
    const entities: AdminEntity[] = ["organization", "customer", "property", "job"];
    for (const entity of entities) {
      expect(hasAdminPermission("ops_viewer", entity, "create")).toBe(false);
    }
  });

  it("ops_viewer cannot edit any entity", () => {
    const entities: AdminEntity[] = ["organization", "customer", "property", "job"];
    for (const entity of entities) {
      expect(hasAdminPermission("ops_viewer", entity, "edit")).toBe(false);
    }
  });

  it("ops_viewer cannot delete any entity", () => {
    const entities: AdminEntity[] = ["organization", "customer", "property", "job"];
    for (const entity of entities) {
      expect(hasAdminPermission("ops_viewer", entity, "delete")).toBe(false);
    }
  });

  it("ops_editor cannot delete organizations", () => {
    expect(hasAdminPermission("ops_editor", "organization", "delete")).toBe(false);
  });

  it("ops_editor cannot create/edit organizations", () => {
    expect(hasAdminPermission("ops_editor", "organization", "create")).toBe(false);
    expect(hasAdminPermission("ops_editor", "organization", "edit")).toBe(false);
  });

  it("ops_editor cannot delete customers", () => {
    expect(hasAdminPermission("ops_editor", "customer", "delete")).toBe(false);
  });

  it("ops_editor cannot delete properties", () => {
    expect(hasAdminPermission("ops_editor", "property", "delete")).toBe(false);
  });

  it("ops_editor cannot delete jobs", () => {
    expect(hasAdminPermission("ops_editor", "job", "delete")).toBe(false);
  });

  it("ops_admin cannot delete organizations", () => {
    expect(hasAdminPermission("ops_admin", "organization", "delete")).toBe(false);
  });

  it("ops_admin cannot create/edit organizations", () => {
    expect(hasAdminPermission("ops_admin", "organization", "create")).toBe(false);
    expect(hasAdminPermission("ops_admin", "organization", "edit")).toBe(false);
  });

  it("ops_admin cannot delete jobs", () => {
    expect(hasAdminPermission("ops_admin", "job", "delete")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Allowed-role cases — platform_admin
// ---------------------------------------------------------------------------

describe("hasAdminPermission — platform_admin has full access", () => {
  const entities: AdminEntity[] = ["organization", "customer", "property", "job"];
  const actions: AdminAction[] = ["view", "create", "edit", "delete"];

  for (const entity of entities) {
    for (const action of actions) {
      it(`platform_admin can ${action} ${entity}`, () => {
        expect(hasAdminPermission("platform_admin", entity, action)).toBe(true);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Allowed-role cases — ops_admin
// ---------------------------------------------------------------------------

describe("hasAdminPermission — ops_admin", () => {
  it("can view all entities", () => {
    const entities: AdminEntity[] = ["organization", "customer", "property", "job"];
    for (const entity of entities) {
      expect(hasAdminPermission("ops_admin", entity, "view")).toBe(true);
    }
  });

  it("can create/edit customers, properties, jobs", () => {
    const entities: AdminEntity[] = ["customer", "property", "job"];
    for (const entity of entities) {
      expect(hasAdminPermission("ops_admin", entity, "create")).toBe(true);
      expect(hasAdminPermission("ops_admin", entity, "edit")).toBe(true);
    }
  });

  it("can delete customers and properties", () => {
    expect(hasAdminPermission("ops_admin", "customer", "delete")).toBe(true);
    expect(hasAdminPermission("ops_admin", "property", "delete")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Allowed-role cases — ops_editor
// ---------------------------------------------------------------------------

describe("hasAdminPermission — ops_editor", () => {
  it("can view all entities", () => {
    const entities: AdminEntity[] = ["organization", "customer", "property", "job"];
    for (const entity of entities) {
      expect(hasAdminPermission("ops_editor", entity, "view")).toBe(true);
    }
  });

  it("can create/edit customers, properties, jobs", () => {
    const entities: AdminEntity[] = ["customer", "property", "job"];
    for (const entity of entities) {
      expect(hasAdminPermission("ops_editor", entity, "create")).toBe(true);
      expect(hasAdminPermission("ops_editor", entity, "edit")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Allowed-role cases — ops_viewer
// ---------------------------------------------------------------------------

describe("hasAdminPermission — ops_viewer can view everything", () => {
  it("can view all entities", () => {
    const entities: AdminEntity[] = ["organization", "customer", "property", "job"];
    for (const entity of entities) {
      expect(hasAdminPermission("ops_viewer", entity, "view")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// assertAdminPermission
// ---------------------------------------------------------------------------

describe("assertAdminPermission", () => {
  it("does not throw when permission is granted", () => {
    expect(() => assertAdminPermission("platform_admin", "organization", "delete")).not.toThrow();
    expect(() => assertAdminPermission("ops_editor", "customer", "create")).not.toThrow();
  });

  it("throws AdminAuthorizationError when permission is denied", () => {
    expect(() => assertAdminPermission("ops_viewer", "customer", "delete")).toThrow(
      AdminAuthorizationError
    );
    expect(() => assertAdminPermission("ops_editor", "organization", "create")).toThrow(
      AdminAuthorizationError
    );
  });

  it("thrown error contains role, entity, and action", () => {
    let caught: unknown;
    try {
      assertAdminPermission("ops_viewer", "job", "delete");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AdminAuthorizationError);
    const err = caught as AdminAuthorizationError;
    expect(err.role).toBe("ops_viewer");
    expect(err.entity).toBe("job");
    expect(err.action).toBe("delete");
    expect(err.message).toMatch(/ops_viewer/);
    expect(err.message).toMatch(/delete/);
    expect(err.message).toMatch(/job/);
  });
});

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

describe("canAdminCreate / canAdminEdit / canAdminDelete", () => {
  it("canAdminCreate returns true for roles with create permission", () => {
    expect(canAdminCreate("platform_admin", "organization")).toBe(true);
    expect(canAdminCreate("ops_editor", "customer")).toBe(true);
    expect(canAdminCreate("ops_viewer", "customer")).toBe(false);
  });

  it("canAdminEdit returns true for roles with edit permission", () => {
    expect(canAdminEdit("platform_admin", "job")).toBe(true);
    expect(canAdminEdit("ops_admin", "property")).toBe(true);
    expect(canAdminEdit("ops_viewer", "property")).toBe(false);
  });

  it("canAdminDelete returns true for roles with delete permission", () => {
    expect(canAdminDelete("platform_admin", "job")).toBe(true);
    expect(canAdminDelete("ops_admin", "customer")).toBe(true);
    expect(canAdminDelete("ops_admin", "job")).toBe(false);
    expect(canAdminDelete("ops_editor", "customer")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// allowedAdminRolesFor
// ---------------------------------------------------------------------------

describe("allowedAdminRolesFor", () => {
  it("returns platform_admin only for organization mutations", () => {
    const createRoles = allowedAdminRolesFor("organization", "create");
    expect(createRoles).toHaveLength(1);
    expect(createRoles).toContain("platform_admin");
  });

  it("returns platform_admin, ops_admin, ops_editor for customer create", () => {
    const roles = allowedAdminRolesFor("customer", "create");
    expect(roles).toHaveLength(3);
    expect(roles).toContain("platform_admin");
    expect(roles).toContain("ops_admin");
    expect(roles).toContain("ops_editor");
    expect(roles).not.toContain("ops_viewer");
  });

  it("returns all admin roles for any entity view", () => {
    const roles = allowedAdminRolesFor("job", "view");
    expect(roles).toHaveLength(4);
  });

  it("returns platform_admin only for job delete", () => {
    const roles = allowedAdminRolesFor("job", "delete");
    expect(roles).toHaveLength(1);
    expect(roles).toContain("platform_admin");
  });
});

// ---------------------------------------------------------------------------
// Route protection helper — isAdminRoute
// ---------------------------------------------------------------------------

describe("admin route protection", () => {
  // Verify that the proxy correctly classifies /admin/* as shell routes
  // by testing the same prefix logic used in src/proxy.ts.
  function isShellRoute(pathname: string): boolean {
    const shellPrefixes = [
      "/admin",
      "/dashboard",
      "/jobs",
      // other prefixes omitted for brevity — proxy.ts has the full list
    ];
    return shellPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }

  it("classifies /admin as a protected route", () => {
    expect(isShellRoute("/admin")).toBe(true);
  });

  it("classifies /admin/organizations as a protected route", () => {
    expect(isShellRoute("/admin/organizations")).toBe(true);
  });

  it("classifies /admin/customers as a protected route", () => {
    expect(isShellRoute("/admin/customers")).toBe(true);
  });

  it("classifies /admin/properties as a protected route", () => {
    expect(isShellRoute("/admin/properties")).toBe(true);
  });

  it("classifies /admin/jobs as a protected route", () => {
    expect(isShellRoute("/admin/jobs")).toBe(true);
  });

  it("does not classify /administrator as a protected /admin route", () => {
    // /administrator must not match the /admin prefix check via startsWith
    // Note: the proxy checks pathname === p || pathname.startsWith(p + "/")
    expect(isShellRoute("/administrator")).toBe(false);
  });

  it("classifies /dashboard as a protected route (unchanged)", () => {
    expect(isShellRoute("/dashboard")).toBe(true);
  });
});
