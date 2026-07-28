import { describe, it, expect } from "vitest";

import { ROUTES } from "@/lib/routes";
import { SHELL_NAV_GROUPS } from "@/components/layout/sidebarNav";
import type { AppRole } from "@/services/authorization";
import { getNavItemsForRole, NAV_ROUTE_ROLES } from "../utils/navPermissions";
import type { NavGroup } from "../utils/navPermissions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allVisibleHrefs(role: AppRole | null): string[] {
  return getNavItemsForRole(role, SHELL_NAV_GROUPS)
    .flatMap((g) => g.items)
    .map((i) => i.href);
}

function canSee(role: AppRole | null, href: string): boolean {
  return allVisibleHrefs(role).includes(href);
}

function findGroup(role: AppRole | null, label: string): NavGroup | undefined {
  return getNavItemsForRole(role, SHELL_NAV_GROUPS).find((group) => group.label === label);
}

// ─── Null / unknown / portal ───────────────────────────────────────────────────

describe("null role (loading state)", () => {
  it("returns baseline nav instead of a blank sidebar", () => {
    expect(allVisibleHrefs(null)).toContain(ROUTES.DASHBOARD);
    expect(allVisibleHrefs(null)).toContain(ROUTES.JOBS);
  });
});

describe("unknown role", () => {
  it("returns baseline nav instead of an unusable empty result", () => {
    const hrefs = allVisibleHrefs("invalid-role" as AppRole);
    expect(hrefs).toContain(ROUTES.DASHBOARD);
    expect(hrefs).toContain(ROUTES.SETTINGS);
  });
});

describe("portal role — ops shell isolation", () => {
  it("returns empty nav — portal users must not see the operations shell", () => {
    expect(getNavItemsForRole("portal", SHELL_NAV_GROUPS)).toHaveLength(0);
  });
});

// Sprint 7 nav reorganization: Administration/Organizations and Project Portal
// were removed from SHELL_NAV_GROUPS. Routes and permissions remain unchanged;
// access is enforced at the route level, not the sidebar.
describe("Administration and Portal items removed from sidebar nav", () => {
  it("does not include an Administration group in the sidebar", () => {
    expect(findGroup("owner", "Administration")).toBeUndefined();
  });

  it("does not include an External group in the sidebar", () => {
    expect(findGroup("owner", "External")).toBeUndefined();
  });

  it("does not show Administration/Organizations href in sidebar nav", () => {
    const hrefs = allVisibleHrefs("owner");
    expect(hrefs.some((h) => h.startsWith("/admin"))).toBe(false);
  });

  it("does not show Project Portal href in sidebar nav", () => {
    const hrefs = allVisibleHrefs("owner");
    expect(hrefs.some((h) => h.startsWith("/portal"))).toBe(false);
  });
});

// ─── owner ────────────────────────────────────────────────────────────────────

describe("owner role", () => {
  it("can see all sidebar nav sections", () => {
    const hrefs = allVisibleHrefs("owner");
    expect(hrefs).toContain(ROUTES.DASHBOARD);
    expect(hrefs).toContain(ROUTES.COMMAND_CENTER);
    expect(hrefs).toContain(ROUTES.DISPATCH);
    expect(hrefs).toContain(ROUTES.JOBS);
    expect(hrefs).toContain(ROUTES.PROPERTIES);
    expect(hrefs).toContain(ROUTES.CUSTOMERS);
    expect(hrefs).toContain(ROUTES.INSTALLED_SYSTEMS);
    expect(hrefs).toContain(ROUTES.REPORTING);
    expect(hrefs).toContain(ROUTES.COMPANY_BRAIN);
    expect(hrefs).toContain(ROUTES.INVENTORY);
    expect(hrefs).toContain(ROUTES.SETTINGS);
  });
});

// ─── manager ─────────────────────────────────────────────────────────────────

describe("manager role", () => {
  it("can see all nav sections (same as owner for nav purposes)", () => {
    const hrefs = allVisibleHrefs("manager");
    expect(hrefs).toContain(ROUTES.REPORTING);
    expect(hrefs).toContain(ROUTES.COMPANY_BRAIN);
    expect(hrefs).toContain(ROUTES.SETTINGS);
  });
});

// ─── dispatch ─────────────────────────────────────────────────────────────────

describe("dispatch role", () => {
  it("can see operational sections", () => {
    expect(canSee("dispatch", ROUTES.DISPATCH)).toBe(true);
    expect(canSee("dispatch", ROUTES.JOBS)).toBe(true);
    expect(canSee("dispatch", ROUTES.PROPERTIES)).toBe(true);
    expect(canSee("dispatch", ROUTES.CUSTOMERS)).toBe(true);
  });

  it("cannot see restricted management sections", () => {
    expect(canSee("dispatch", ROUTES.REPORTING)).toBe(false);
    expect(canSee("dispatch", ROUTES.COMPANY_BRAIN)).toBe(false);
    expect(canSee("dispatch", ROUTES.SETTINGS)).toBe(false);
  });
});

// ─── tech ─────────────────────────────────────────────────────────────────────

describe("tech role", () => {
  it("can see jobs, properties, installed systems", () => {
    expect(canSee("tech", ROUTES.JOBS)).toBe(true);
    expect(canSee("tech", ROUTES.PROPERTIES)).toBe(true);
    expect(canSee("tech", ROUTES.INSTALLED_SYSTEMS)).toBe(true);
  });

  it("cannot see customers", () => {
    expect(canSee("tech", ROUTES.CUSTOMERS)).toBe(false);
  });

  it("cannot see management sections", () => {
    expect(canSee("tech", ROUTES.REPORTING)).toBe(false);
    expect(canSee("tech", ROUTES.COMPANY_BRAIN)).toBe(false);
    expect(canSee("tech", ROUTES.SETTINGS)).toBe(false);
    expect(canSee("tech", ROUTES.DISPATCH)).toBe(false);
  });
});

// ─── office ──────────────────────────────────────────────────────────────────

describe("office role", () => {
  it("can see jobs, properties, customers, installed systems", () => {
    expect(canSee("office", ROUTES.JOBS)).toBe(true);
    expect(canSee("office", ROUTES.PROPERTIES)).toBe(true);
    expect(canSee("office", ROUTES.CUSTOMERS)).toBe(true);
    expect(canSee("office", ROUTES.INSTALLED_SYSTEMS)).toBe(true);
  });

  it("cannot see management sections", () => {
    expect(canSee("office", ROUTES.REPORTING)).toBe(false);
    expect(canSee("office", ROUTES.COMPANY_BRAIN)).toBe(false);
    expect(canSee("office", ROUTES.SETTINGS)).toBe(false);
  });
});

// ─── sales ───────────────────────────────────────────────────────────────────

describe("sales role", () => {
  it("can see jobs, properties, customers, installed systems", () => {
    expect(canSee("sales", ROUTES.JOBS)).toBe(true);
    expect(canSee("sales", ROUTES.PROPERTIES)).toBe(true);
    expect(canSee("sales", ROUTES.CUSTOMERS)).toBe(true);
    expect(canSee("sales", ROUTES.INSTALLED_SYSTEMS)).toBe(true);
  });

  it("cannot see management or operations sections", () => {
    expect(canSee("sales", ROUTES.REPORTING)).toBe(false);
    expect(canSee("sales", ROUTES.COMPANY_BRAIN)).toBe(false);
    expect(canSee("sales", ROUTES.SETTINGS)).toBe(false);
    expect(canSee("sales", ROUTES.DISPATCH)).toBe(false);
  });
});

// ─── NAV_ROUTE_ROLES structural checks ────────────────────────────────────────

describe("NAV_ROUTE_ROLES map", () => {
  it("contains no portal role entries (portal is always blocked at function level)", () => {
    for (const roles of Object.values(NAV_ROUTE_ROLES)) {
      expect(roles).not.toContain("portal");
    }
  });

  it("groups are always non-empty after filtering for owner", () => {
    const groups = getNavItemsForRole("owner", SHELL_NAV_GROUPS);
    for (const group of groups) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });
});
