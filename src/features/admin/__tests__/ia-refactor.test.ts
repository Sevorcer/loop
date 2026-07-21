import { describe, it, expect } from "vitest";

import {
  ADMIN_AREA_LABEL,
  ADMIN_NAV_ITEMS,
  ADMIN_LEGACY_REDIRECTS,
} from "../config/adminNavItems";
import { ADMIN_ROUTES, ROUTES } from "@/lib/routes";

/**
 * Sprint 30 IA refactor — Administration navigation and redirect regression tests.
 *
 * Verifies:
 *  1. Nav label is "Administration" (not "Admin")
 *  2. Nav items exclude operational entities (Jobs, Customers, Properties)
 *  3. Organizations remains in nav
 *  4. Legacy /admin/* routes redirect to operational destinations
 */

// ─── Nav label ────────────────────────────────────────────────────────────────

describe("Administration area label", () => {
  it('area label is "Administration"', () => {
    expect(ADMIN_AREA_LABEL).toBe("Administration");
  });

  it('area label is not the old label "Admin"', () => {
    expect(ADMIN_AREA_LABEL).not.toBe("Admin");
  });
});

// ─── Nav items ────────────────────────────────────────────────────────────────

describe("Administration nav items — operational entities excluded", () => {
  it("does not include Jobs", () => {
    const names = ADMIN_NAV_ITEMS.map((i) => i.name);
    expect(names).not.toContain("Jobs");
  });

  it("does not include Customers", () => {
    const names = ADMIN_NAV_ITEMS.map((i) => i.name);
    expect(names).not.toContain("Customers");
  });

  it("does not include Properties", () => {
    const names = ADMIN_NAV_ITEMS.map((i) => i.name);
    expect(names).not.toContain("Properties");
  });

  it("includes Organizations", () => {
    const names = ADMIN_NAV_ITEMS.map((i) => i.name);
    expect(names).toContain("Organizations");
  });

  it("Organizations href points to /admin/organizations", () => {
    const org = ADMIN_NAV_ITEMS.find((i) => i.name === "Organizations");
    expect(org?.href).toBe(ADMIN_ROUTES.ORGANIZATIONS);
  });
});

// ─── Legacy redirects ─────────────────────────────────────────────────────────

describe("Legacy /admin/* redirect map", () => {
  it("/admin/jobs redirects to the operational /jobs route", () => {
    expect(ADMIN_LEGACY_REDIRECTS[ADMIN_ROUTES.JOBS]).toBe(ROUTES.JOBS);
  });

  it("/admin/customers redirects to the operational /customers route", () => {
    expect(ADMIN_LEGACY_REDIRECTS[ADMIN_ROUTES.CUSTOMERS]).toBe(ROUTES.CUSTOMERS);
  });

  it("/admin/properties redirects to the operational /properties route", () => {
    expect(ADMIN_LEGACY_REDIRECTS[ADMIN_ROUTES.PROPERTIES]).toBe(ROUTES.PROPERTIES);
  });

  it("redirect targets are operational routes (not admin routes)", () => {
    for (const dest of Object.values(ADMIN_LEGACY_REDIRECTS)) {
      expect(dest.startsWith("/admin")).toBe(false);
    }
  });

  it("redirect sources are admin routes", () => {
    for (const src of Object.keys(ADMIN_LEGACY_REDIRECTS)) {
      expect(src.startsWith("/admin")).toBe(true);
    }
  });
});

// ─── Route constants — no regression ─────────────────────────────────────────

describe("ADMIN_ROUTES — no regression", () => {
  it("ADMIN_ROUTES.ORGANIZATIONS is /admin/organizations", () => {
    expect(ADMIN_ROUTES.ORGANIZATIONS).toBe("/admin/organizations");
  });

  it("ADMIN_ROUTES.JOBS is /admin/jobs (legacy, kept for redirect)", () => {
    expect(ADMIN_ROUTES.JOBS).toBe("/admin/jobs");
  });

  it("ADMIN_ROUTES.CUSTOMERS is /admin/customers (legacy, kept for redirect)", () => {
    expect(ADMIN_ROUTES.CUSTOMERS).toBe("/admin/customers");
  });

  it("ADMIN_ROUTES.PROPERTIES is /admin/properties (legacy, kept for redirect)", () => {
    expect(ADMIN_ROUTES.PROPERTIES).toBe("/admin/properties");
  });
});
