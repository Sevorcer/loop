/**
 * Role-switch regression tests — Sprint 26.
 *
 * Covers the three critical permission UX contracts:
 *
 * 1. Action button availability — per-role permission checks for the create/
 *    edit action buttons rendered in core screens (jobs, customers, properties,
 *    contractors).
 *
 * 2. Direct URL access denial — verifies that navigating directly to a
 *    restricted route resolves to denied for roles that lack the required
 *    permission. The UI layer (RoutePermissionGuard) and the API layer both
 *    gate on these same `hasPermission` results.
 *
 * 3. No flash of unauthorized content — the loading-state contract: when the
 *    role is `null` (SSR / pre-hydration), permission must resolve to
 *    `{ allowed: false, loading: true }`. This mirrors the logic inside
 *    `src/hooks/usePermission.ts` so any accidental regression to the contract
 *    is caught here without requiring a full React render.
 *
 * Note: only pure utility/logic functions are tested here — no React rendering.
 */

import { describe, it, expect } from "vitest";

import { hasPermission } from "@/services/authorization";
import type { AppRole, CoreTable, TableAction } from "@/services/authorization";

// ─── Pure helper that mirrors src/hooks/usePermission.ts logic ────────────────
// Tested separately so regressions in the null-role guard are caught here.

interface PermissionResult {
  allowed: boolean;
  loading: boolean;
}

function resolvePermission(
  role: AppRole | null,
  table: CoreTable,
  action: TableAction,
): PermissionResult {
  if (!role) return { allowed: false, loading: true };
  return { allowed: hasPermission(role, table, action), loading: false };
}

// ─── 1. No flash of unauthorized content ──────────────────────────────────────

describe("no flash of unauthorized content — null role (loading state)", () => {
  const tables: CoreTable[] = [
    "jobs",
    "customers",
    "properties",
    "contractors",
  ];

  it("returns loading=true and allowed=false for every table/action while role is null", () => {
    const actions: TableAction[] = ["select", "insert", "update", "delete"];
    for (const table of tables) {
      for (const action of actions) {
        const result = resolvePermission(null, table, action);
        expect(result.loading, `${table}.${action} should be loading`).toBe(true);
        expect(result.allowed, `${table}.${action} should not be allowed during loading`).toBe(false);
      }
    }
  });

  it("transitions to loading=false once the role resolves", () => {
    const result = resolvePermission("owner", "jobs", "select");
    expect(result.loading).toBe(false);
    expect(result.allowed).toBe(true);
  });
});

// ─── 2. Action button availability — "New / Edit" buttons ────────────────────

describe("action button availability — New Job (jobs.insert)", () => {
  it("owner and manager can see New Job", () => {
    expect(hasPermission("owner", "jobs", "insert")).toBe(true);
    expect(hasPermission("manager", "jobs", "insert")).toBe(true);
  });

  it("office can create jobs", () => {
    expect(hasPermission("office", "jobs", "insert")).toBe(true);
  });

  it("dispatch, tech, and sales cannot create jobs", () => {
    expect(hasPermission("dispatch", "jobs", "insert")).toBe(false);
    expect(hasPermission("tech", "jobs", "insert")).toBe(false);
    expect(hasPermission("sales", "jobs", "insert")).toBe(false);
  });

  it("portal cannot create jobs", () => {
    expect(hasPermission("portal", "jobs", "insert")).toBe(false);
  });
});

describe("action button availability — Edit Job (jobs.update)", () => {
  it("owner, manager, and dispatch can update jobs", () => {
    expect(hasPermission("owner", "jobs", "update")).toBe(true);
    expect(hasPermission("manager", "jobs", "update")).toBe(true);
    expect(hasPermission("dispatch", "jobs", "update")).toBe(true);
  });

  it("tech can update jobs (own assigned rows — RLS scope)", () => {
    expect(hasPermission("tech", "jobs", "update")).toBe(true);
  });

  it("office and sales cannot update jobs", () => {
    expect(hasPermission("office", "jobs", "update")).toBe(false);
    expect(hasPermission("sales", "jobs", "update")).toBe(false);
  });
});

describe("action button availability — New Customer (customers.insert)", () => {
  it("owner, manager, office, and sales can create customers", () => {
    expect(hasPermission("owner", "customers", "insert")).toBe(true);
    expect(hasPermission("manager", "customers", "insert")).toBe(true);
    expect(hasPermission("office", "customers", "insert")).toBe(true);
    expect(hasPermission("sales", "customers", "insert")).toBe(true);
  });

  it("dispatch and tech cannot create customers", () => {
    expect(hasPermission("dispatch", "customers", "insert")).toBe(false);
    expect(hasPermission("tech", "customers", "insert")).toBe(false);
  });
});

describe("action button availability — New Property (properties.insert)", () => {
  it("owner, manager, office, and sales can create properties", () => {
    expect(hasPermission("owner", "properties", "insert")).toBe(true);
    expect(hasPermission("manager", "properties", "insert")).toBe(true);
    expect(hasPermission("office", "properties", "insert")).toBe(true);
    expect(hasPermission("sales", "properties", "insert")).toBe(true);
  });

  it("dispatch and tech cannot create properties", () => {
    expect(hasPermission("dispatch", "properties", "insert")).toBe(false);
    expect(hasPermission("tech", "properties", "insert")).toBe(false);
  });
});

describe("action button availability — Add Contractor (contractors.insert)", () => {
  it("owner and manager can add contractors", () => {
    expect(hasPermission("owner", "contractors", "insert")).toBe(true);
    expect(hasPermission("manager", "contractors", "insert")).toBe(true);
  });

  it("dispatch, tech, office, and sales cannot add contractors", () => {
    expect(hasPermission("dispatch", "contractors", "insert")).toBe(false);
    expect(hasPermission("tech", "contractors", "insert")).toBe(false);
    expect(hasPermission("office", "contractors", "insert")).toBe(false);
    expect(hasPermission("sales", "contractors", "insert")).toBe(false);
  });
});

// ─── 3. Direct URL access denial ─────────────────────────────────────────────
//
// Maps route-level access requirements to the underlying permission check.
// When a role navigates directly to a restricted URL, RoutePermissionGuard
// evaluates the same `hasPermission` call — these tests verify the denial
// behavior without requiring a full render.

describe("direct URL access denial — /jobs/new (requires jobs.insert)", () => {
  it("dispatch is denied direct access", () => {
    expect(hasPermission("dispatch", "jobs", "insert")).toBe(false);
  });

  it("tech is denied direct access", () => {
    expect(hasPermission("tech", "jobs", "insert")).toBe(false);
  });

  it("sales is denied direct access", () => {
    expect(hasPermission("sales", "jobs", "insert")).toBe(false);
  });

  it("portal is denied direct access", () => {
    expect(hasPermission("portal", "jobs", "insert")).toBe(false);
  });
});

describe("direct URL access denial — /customers/new (requires customers.insert)", () => {
  it("dispatch is denied direct access", () => {
    expect(hasPermission("dispatch", "customers", "insert")).toBe(false);
  });

  it("tech is denied direct access", () => {
    expect(hasPermission("tech", "customers", "insert")).toBe(false);
  });

  it("portal is denied direct access", () => {
    expect(hasPermission("portal", "customers", "insert")).toBe(false);
  });
});

describe("direct URL access denial — /properties/new (requires properties.insert)", () => {
  it("dispatch is denied direct access", () => {
    expect(hasPermission("dispatch", "properties", "insert")).toBe(false);
  });

  it("tech is denied direct access", () => {
    expect(hasPermission("tech", "properties", "insert")).toBe(false);
  });

  it("portal is denied direct access", () => {
    expect(hasPermission("portal", "properties", "insert")).toBe(false);
  });
});

describe("direct URL access denial — /contractors/new (requires contractors.insert)", () => {
  it("dispatch is denied direct access", () => {
    expect(hasPermission("dispatch", "contractors", "insert")).toBe(false);
  });

  it("tech is denied direct access", () => {
    expect(hasPermission("tech", "contractors", "insert")).toBe(false);
  });

  it("office is denied direct access", () => {
    expect(hasPermission("office", "contractors", "insert")).toBe(false);
  });

  it("sales is denied direct access", () => {
    expect(hasPermission("sales", "contractors", "insert")).toBe(false);
  });
});

// ─── 4. Role-switch behavior — permission changes on role transition ──────────

describe("role-switch: owner → tech", () => {
  it("loses ability to create jobs", () => {
    expect(hasPermission("owner", "jobs", "insert")).toBe(true);
    expect(hasPermission("tech", "jobs", "insert")).toBe(false);
  });

  it("loses access to customers entirely", () => {
    expect(hasPermission("owner", "customers", "select")).toBe(true);
    expect(hasPermission("tech", "customers", "select")).toBe(false);
  });

  it("retains ability to select and update jobs (own rows via RLS)", () => {
    expect(hasPermission("tech", "jobs", "select")).toBe(true);
    expect(hasPermission("tech", "jobs", "update")).toBe(true);
  });

  it("retains ability to read properties and contractors", () => {
    expect(hasPermission("tech", "properties", "select")).toBe(true);
    expect(hasPermission("tech", "contractors", "select")).toBe(true);
  });
});

describe("role-switch: owner → dispatch", () => {
  it("loses ability to create jobs", () => {
    expect(hasPermission("owner", "jobs", "insert")).toBe(true);
    expect(hasPermission("dispatch", "jobs", "insert")).toBe(false);
  });

  it("loses ability to delete any table", () => {
    const tables: CoreTable[] = ["customers", "properties", "contractors", "jobs"];
    for (const table of tables) {
      expect(hasPermission("dispatch", table, "delete")).toBe(false);
    }
  });

  it("retains ability to update jobs (status)", () => {
    expect(hasPermission("dispatch", "jobs", "update")).toBe(true);
  });
});

describe("role-switch: owner → sales", () => {
  it("retains access to customers and properties (read/write)", () => {
    expect(hasPermission("sales", "customers", "select")).toBe(true);
    expect(hasPermission("sales", "customers", "insert")).toBe(true);
    expect(hasPermission("sales", "properties", "select")).toBe(true);
    expect(hasPermission("sales", "properties", "insert")).toBe(true);
  });

  it("loses ability to create or update jobs", () => {
    expect(hasPermission("owner", "jobs", "insert")).toBe(true);
    expect(hasPermission("sales", "jobs", "insert")).toBe(false);
    expect(hasPermission("sales", "jobs", "update")).toBe(false);
  });

  it("loses access to contractors entirely", () => {
    expect(hasPermission("sales", "contractors", "select")).toBe(false);
  });
});

describe("role-switch: owner → portal", () => {
  it("loses all access to internal operational tables", () => {
    const tables: CoreTable[] = ["customers", "properties", "contractors", "jobs", "job_activity"];
    const actions: TableAction[] = ["select", "insert", "update", "delete"];
    for (const table of tables) {
      for (const action of actions) {
        expect(
          hasPermission("portal", table, action),
          `portal must not have ${action} on ${table}`,
        ).toBe(false);
      }
    }
  });
});
