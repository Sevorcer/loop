import { describe, expect, it } from "vitest";

import type { AppRole } from "@/services/authorization";
import { ROUTES } from "@/lib/routes";
import { getNavItemsForRole } from "@/features/auth";

import { composeSidebarNav, SHELL_NAV_GROUPS } from "../sidebarNav";

function getVisibleHrefsForRole(role: AppRole | null) {
  return getNavItemsForRole(role, SHELL_NAV_GROUPS)
    .flatMap((group) => group.items)
    .map((item) => item.href);
}

function getComposedHrefsForRole(role: AppRole | null, navOverride?: readonly string[]) {
  return composeSidebarNav({
    role,
    navOverride,
  })
    .flatMap((group) => group.items)
    .map((item) => item.href);
}

describe("composeSidebarNav", () => {
  it("keeps the visible href set unchanged for owner", () => {
    const baseline = getVisibleHrefsForRole("owner");

    expect(getComposedHrefsForRole("owner")).toEqual(expect.arrayContaining(baseline));
    expect(getComposedHrefsForRole("owner")).toHaveLength(baseline.length);
  });

  it("keeps the visible href set unchanged for dispatch", () => {
    const baseline = getVisibleHrefsForRole("dispatch");

    expect(getComposedHrefsForRole("dispatch")).toEqual(expect.arrayContaining(baseline));
    expect(getComposedHrefsForRole("dispatch")).toHaveLength(baseline.length);
  });

  it("keeps the visible href set unchanged for tech", () => {
    const baseline = getVisibleHrefsForRole("tech");

    expect(getComposedHrefsForRole("tech")).toEqual(expect.arrayContaining(baseline));
    expect(getComposedHrefsForRole("tech")).toHaveLength(baseline.length);
  });

  it("prioritizes owner links toward dashboard, command center, reporting, and settings", () => {
    const groups = composeSidebarNav({ role: "owner" });

    expect(groups.map((group) => group.label).slice(0, 3)).toEqual([
      "TODAY",
      "INSIGHTS",
      "SETTINGS",
    ]);
    expect(groups[0]?.items.map((item) => item.href).slice(0, 2)).toEqual([
      ROUTES.DASHBOARD,
      ROUTES.COMMAND_CENTER,
    ]);
  });

  it("prioritizes dispatch links toward dispatch, command center, and jobs", () => {
    const groups = composeSidebarNav({ role: "dispatch" });

    expect(groups.map((group) => group.label).slice(0, 2)).toEqual([
      "TODAY",
      "OPERATIONS",
    ]);
    expect(groups[0]?.items.map((item) => item.href).slice(0, 2)).toEqual([
      ROUTES.DISPATCH,
      ROUTES.COMMAND_CENTER,
    ]);
    expect(groups[1]?.items[0]?.href).toBe(ROUTES.JOBS);
  });

  it("prioritizes tech links toward dashboard, jobs, properties, and installed systems", () => {
    const groups = composeSidebarNav({ role: "tech" });

    expect(groups.map((group) => group.label).slice(0, 2)).toEqual([
      "TODAY",
      "OPERATIONS",
    ]);
    expect(groups[0]?.items[0]?.href).toBe(ROUTES.DASHBOARD);
    expect(groups[1]?.items.map((item) => item.href)).toEqual([
      ROUTES.JOBS,
      ROUTES.PROPERTIES,
      ROUTES.INSTALLED_SYSTEMS,
    ]);
  });

  it("lets a user nav override take precedence over the role preset", () => {
    const groups = composeSidebarNav({
      role: "owner",
      navOverride: [ROUTES.SETTINGS, ROUTES.REPORTING],
    });

    expect(groups.map((group) => group.label).slice(0, 2)).toEqual([
      "SETTINGS",
      "INSIGHTS",
    ]);
    expect(groups[0]?.items[0]?.href).toBe(ROUTES.SETTINGS);
  });

  it("falls back to baseline ordering when the role has no preset", () => {
    expect(getComposedHrefsForRole("office")).toEqual(getVisibleHrefsForRole("office"));
  });
});
