import { describe, it, expect } from "vitest";

import { ROUTES, PORTAL_ROUTES } from "@/lib/routes";
import type { AppRole } from "@/services/authorization";
import { getNavItemsForRole, NAV_ROUTE_ROLES } from "../utils/navPermissions";
import type { NavGroup } from "../utils/navPermissions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal stand-in for an icon component — only the href matters for tests. */
const FakeIcon = {} as React.ComponentType<{ size?: number }>;

const ALL_NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ name: "Dashboard", href: ROUTES.DASHBOARD, icon: FakeIcon }],
  },
  {
    label: "Operations",
    items: [
      { name: "Daily Plans", href: ROUTES.DAILY_PLANS, icon: FakeIcon },
      { name: "Live Operations", href: ROUTES.LIVE_OPERATIONS, icon: FakeIcon },
      { name: "Dispatch", href: ROUTES.DISPATCH, icon: FakeIcon },
    ],
  },
  {
    label: "Field",
    items: [
      { name: "Jobs", href: ROUTES.JOBS, icon: FakeIcon },
      { name: "Properties", href: ROUTES.PROPERTIES, icon: FakeIcon },
      { name: "Contractors", href: ROUTES.CONTRACTORS, icon: FakeIcon },
      { name: "Customers", href: ROUTES.CUSTOMERS, icon: FakeIcon },
      { name: "Installed Systems", href: ROUTES.INSTALLED_SYSTEMS, icon: FakeIcon },
      { name: "Vehicle Alerts", href: ROUTES.VEHICLE_ALERTS, icon: FakeIcon },
    ],
  },
  {
    label: "Resources",
    items: [
      { name: "Inventory", href: ROUTES.INVENTORY, icon: FakeIcon },
      { name: "Company Brain", href: ROUTES.COMPANY_BRAIN, icon: FakeIcon },
    ],
  },
  {
    label: "Insights",
    items: [{ name: "Reporting", href: ROUTES.REPORTING, icon: FakeIcon }],
  },
  {
    label: "External",
    items: [{ name: "Project Portal", href: PORTAL_ROUTES.ROOT, icon: FakeIcon }],
  },
  {
    label: "Workspace",
    items: [{ name: "Settings", href: ROUTES.SETTINGS, icon: FakeIcon }],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allVisibleHrefs(role: AppRole | null): string[] {
  return getNavItemsForRole(role, ALL_NAV_GROUPS)
    .flatMap((g) => g.items)
    .map((i) => i.href);
}

function canSee(role: AppRole | null, href: string): boolean {
  return allVisibleHrefs(role).includes(href);
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
    expect(getNavItemsForRole("portal", ALL_NAV_GROUPS)).toHaveLength(0);
  });
});

// ─── owner ────────────────────────────────────────────────────────────────────

describe("owner role", () => {
  it("can see all nav sections", () => {
    const hrefs = allVisibleHrefs("owner");
    expect(hrefs).toContain(ROUTES.DASHBOARD);
    expect(hrefs).toContain(ROUTES.JOBS);
    expect(hrefs).toContain(ROUTES.PROPERTIES);
    expect(hrefs).toContain(ROUTES.CONTRACTORS);
    expect(hrefs).toContain(ROUTES.CUSTOMERS);
    expect(hrefs).toContain(ROUTES.REPORTING);
    expect(hrefs).toContain(ROUTES.COMPANY_BRAIN);
    expect(hrefs).toContain(ROUTES.SETTINGS);
    expect(hrefs).toContain(PORTAL_ROUTES.ROOT);
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
  it("can see operational and field sections", () => {
    expect(canSee("dispatch", ROUTES.JOBS)).toBe(true);
    expect(canSee("dispatch", ROUTES.PROPERTIES)).toBe(true);
    expect(canSee("dispatch", ROUTES.CONTRACTORS)).toBe(true);
    expect(canSee("dispatch", ROUTES.CUSTOMERS)).toBe(true);
    expect(canSee("dispatch", ROUTES.DAILY_PLANS)).toBe(true);
    expect(canSee("dispatch", ROUTES.LIVE_OPERATIONS)).toBe(true);
    expect(canSee("dispatch", ROUTES.DISPATCH)).toBe(true);
  });

  it("cannot see restricted management sections", () => {
    expect(canSee("dispatch", ROUTES.REPORTING)).toBe(false);
    expect(canSee("dispatch", ROUTES.COMPANY_BRAIN)).toBe(false);
    expect(canSee("dispatch", ROUTES.SETTINGS)).toBe(false);
    expect(canSee("dispatch", PORTAL_ROUTES.ROOT)).toBe(false);
  });
});

// ─── tech ─────────────────────────────────────────────────────────────────────

describe("tech role", () => {
  it("can see jobs, properties, contractors, installed systems", () => {
    expect(canSee("tech", ROUTES.JOBS)).toBe(true);
    expect(canSee("tech", ROUTES.PROPERTIES)).toBe(true);
    expect(canSee("tech", ROUTES.CONTRACTORS)).toBe(true);
    expect(canSee("tech", ROUTES.INSTALLED_SYSTEMS)).toBe(true);
  });

  it("cannot see customers", () => {
    expect(canSee("tech", ROUTES.CUSTOMERS)).toBe(false);
  });

  it("cannot see management sections", () => {
    expect(canSee("tech", ROUTES.REPORTING)).toBe(false);
    expect(canSee("tech", ROUTES.COMPANY_BRAIN)).toBe(false);
    expect(canSee("tech", ROUTES.SETTINGS)).toBe(false);
    expect(canSee("tech", ROUTES.DAILY_PLANS)).toBe(false);
    expect(canSee("tech", ROUTES.LIVE_OPERATIONS)).toBe(false);
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
    expect(canSee("office", ROUTES.DAILY_PLANS)).toBe(true);
  });

  it("cannot see contractors", () => {
    expect(canSee("office", ROUTES.CONTRACTORS)).toBe(false);
  });

  it("cannot see management sections", () => {
    expect(canSee("office", ROUTES.REPORTING)).toBe(false);
    expect(canSee("office", ROUTES.COMPANY_BRAIN)).toBe(false);
    expect(canSee("office", ROUTES.SETTINGS)).toBe(false);
    expect(canSee("office", PORTAL_ROUTES.ROOT)).toBe(false);
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

  it("cannot see contractors", () => {
    expect(canSee("sales", ROUTES.CONTRACTORS)).toBe(false);
  });

  it("cannot see management or operations sections", () => {
    expect(canSee("sales", ROUTES.REPORTING)).toBe(false);
    expect(canSee("sales", ROUTES.COMPANY_BRAIN)).toBe(false);
    expect(canSee("sales", ROUTES.SETTINGS)).toBe(false);
    expect(canSee("sales", ROUTES.DAILY_PLANS)).toBe(false);
    expect(canSee("sales", ROUTES.LIVE_OPERATIONS)).toBe(false);
    expect(canSee("sales", ROUTES.DISPATCH)).toBe(false);
    expect(canSee("sales", PORTAL_ROUTES.ROOT)).toBe(false);
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
    const groups = getNavItemsForRole("owner", ALL_NAV_GROUPS);
    for (const group of groups) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });
});
