import { describe, it, expect } from "vitest";

import { ROUTES } from "@/lib/routes";
import { SHELL_NAV_GROUPS } from "../sidebarNav";

// ─── Navigation group structure ───────────────────────────────────────────────
// Validates that SHELL_NAV_GROUPS matches the Sprint 7 navigation-ux-goals spec
// exactly: 5 groups with the correct labels, items, and ordering.

describe("SHELL_NAV_GROUPS structure", () => {
  it("has exactly 5 groups", () => {
    expect(SHELL_NAV_GROUPS).toHaveLength(5);
  });

  it("group labels match spec in order", () => {
    expect(SHELL_NAV_GROUPS.map((g) => g.label)).toEqual([
      "TODAY",
      "OPERATIONS",
      "KNOWLEDGE",
      "INSIGHTS",
      "SETTINGS",
    ]);
  });

  it("every group has at least one item", () => {
    for (const group of SHELL_NAV_GROUPS) {
      expect(group.items.length, `group "${group.label}" must be non-empty`).toBeGreaterThan(0);
    }
  });
});

// ─── TODAY group ──────────────────────────────────────────────────────────────

describe("TODAY group", () => {
  const group = SHELL_NAV_GROUPS.find((g) => g.label === "TODAY")!;

  it("exists", () => {
    expect(group).toBeDefined();
  });

  it("contains Dashboard, Command Center, Dispatch in that order", () => {
    expect(group.items.map((i) => i.href)).toEqual([
      ROUTES.DASHBOARD,
      ROUTES.COMMAND_CENTER,
      ROUTES.DISPATCH,
    ]);
  });

  it("item names match spec", () => {
    expect(group.items.map((i) => i.name)).toEqual([
      "Dashboard",
      "Command Center",
      "Dispatch",
    ]);
  });
});

// ─── OPERATIONS group ─────────────────────────────────────────────────────────

describe("OPERATIONS group", () => {
  const group = SHELL_NAV_GROUPS.find((g) => g.label === "OPERATIONS")!;

  it("exists", () => {
    expect(group).toBeDefined();
  });

  it("contains Jobs, Customers, Properties, Installed Systems in that order", () => {
    expect(group.items.map((i) => i.href)).toEqual([
      ROUTES.JOBS,
      ROUTES.CUSTOMERS,
      ROUTES.PROPERTIES,
      ROUTES.INSTALLED_SYSTEMS,
    ]);
  });

  it("item names match spec", () => {
    expect(group.items.map((i) => i.name)).toEqual([
      "Jobs",
      "Customers",
      "Properties",
      "Installed Systems",
    ]);
  });
});

// ─── KNOWLEDGE group ──────────────────────────────────────────────────────────

describe("KNOWLEDGE group", () => {
  const group = SHELL_NAV_GROUPS.find((g) => g.label === "KNOWLEDGE")!;

  it("exists", () => {
    expect(group).toBeDefined();
  });

  it("contains Company Brain, Inventory in that order", () => {
    expect(group.items.map((i) => i.href)).toEqual([
      ROUTES.COMPANY_BRAIN,
      ROUTES.INVENTORY,
    ]);
  });
});

// ─── INSIGHTS group ───────────────────────────────────────────────────────────

describe("INSIGHTS group", () => {
  const group = SHELL_NAV_GROUPS.find((g) => g.label === "INSIGHTS")!;

  it("exists", () => {
    expect(group).toBeDefined();
  });

  it("contains Reporting", () => {
    expect(group.items.map((i) => i.href)).toEqual([ROUTES.REPORTING]);
  });
});

// ─── SETTINGS group ───────────────────────────────────────────────────────────

describe("SETTINGS group", () => {
  const group = SHELL_NAV_GROUPS.find((g) => g.label === "SETTINGS")!;

  it("exists", () => {
    expect(group).toBeDefined();
  });

  it("contains Settings", () => {
    expect(group.items.map((i) => i.href)).toEqual([ROUTES.SETTINGS]);
  });
});

// ─── No broken routes ─────────────────────────────────────────────────────────

describe("No broken links / route regressions", () => {
  const allRouteValues = Object.values(ROUTES) as string[];

  it("every nav item href is a known ROUTES entry", () => {
    for (const group of SHELL_NAV_GROUPS) {
      for (const item of group.items) {
        expect(
          allRouteValues,
          `"${item.name}" href "${item.href}" is not a known ROUTES value`
        ).toContain(item.href);
      }
    }
  });

  it("every nav item has a non-empty name and an icon", () => {
    for (const group of SHELL_NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.name.length, `item href "${item.href}" must have a name`).toBeGreaterThan(0);
        expect(item.icon, `item "${item.name}" must have an icon`).toBeDefined();
      }
    }
  });

  it("no duplicate hrefs across all nav groups", () => {
    const hrefs = SHELL_NAV_GROUPS.flatMap((g) => g.items).map((i) => i.href);
    const unique = new Set(hrefs);
    expect(hrefs.length).toBe(unique.size);
  });
});
