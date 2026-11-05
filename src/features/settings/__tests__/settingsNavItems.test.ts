import { describe, it, expect } from "vitest";
import {
  SETTINGS_NAV_ITEMS,
  SETTINGS_AREA_LABEL,
  canAccessManagementSettings,
  getSettingsNavItems,
  getSettingsLandingHref,
} from "../config/settingsNavItems";

describe("settingsNavItems", () => {
  it("exports the correct area label", () => {
    expect(SETTINGS_AREA_LABEL).toBe("Settings");
  });

  it("exports four nav items", () => {
    expect(SETTINGS_NAV_ITEMS).toHaveLength(4);
  });

  it("nav items have required fields", () => {
    for (const item of SETTINGS_NAV_ITEMS) {
      expect(typeof item.name).toBe("string");
      expect(item.name.length).toBeGreaterThan(0);
      expect(typeof item.href).toBe("string");
      expect(item.href.startsWith("/settings")).toBe(true);
      expect(typeof item.description).toBe("string");
    }
  });

  it("includes Users, Roles, Appearance, and Feedback items", () => {
    const names = SETTINGS_NAV_ITEMS.map((i) => i.name);
    expect(names).toContain("Users");
    expect(names).toContain("Roles & Permissions");
    expect(names).toContain("Appearance");
    expect(names).toContain("Feedback");
  });

  it("Feedback item points to /settings/feedback", () => {
    const feedback = SETTINGS_NAV_ITEMS.find((i) => i.name === "Feedback");
    expect(feedback).toBeDefined();
    expect(feedback?.href).toBe("/settings/feedback");
  });
});

describe("role-aware settings navigation", () => {
  const MANAGEMENT = ["Users", "Roles & Permissions", "Feedback"];

  it.each(["owner", "manager"])("%s sees every section", (role) => {
    expect(getSettingsNavItems(role).map((i) => i.name)).toEqual(
      SETTINGS_NAV_ITEMS.map((i) => i.name),
    );
  });

  it.each(["office", "dispatch", "tech", "sales"])(
    "%s sees only Appearance",
    (role) => {
      const names = getSettingsNavItems(role).map((i) => i.name);
      expect(names).toEqual(["Appearance"]);
      for (const hidden of MANAGEMENT) expect(names).not.toContain(hidden);
    },
  );

  it("Appearance is never flagged owner/manager-only", () => {
    const appearance = SETTINGS_NAV_ITEMS.find((i) => i.name === "Appearance");
    expect(appearance?.ownerManagerOnly).toBeFalsy();
  });

  it("every management section is flagged owner/manager-only", () => {
    for (const name of MANAGEMENT) {
      expect(SETTINGS_NAV_ITEMS.find((i) => i.name === name)?.ownerManagerOnly).toBe(true);
    }
  });

  it("owner and manager land on Users; every other role lands on Appearance", () => {
    expect(getSettingsLandingHref("owner")).toBe("/settings/users");
    expect(getSettingsLandingHref("manager")).toBe("/settings/users");
    for (const role of ["office", "dispatch", "tech", "sales"]) {
      expect(getSettingsLandingHref(role)).toBe("/settings/appearance");
    }
  });

  it("an unresolved role keeps the legacy owner/manager behavior (section pages gate on a resolved role)", () => {
    expect(canAccessManagementSettings(null)).toBe(true);
    expect(getSettingsLandingHref(null)).toBe("/settings/users");
  });
});
