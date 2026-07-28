import { describe, it, expect } from "vitest";
import { SETTINGS_NAV_ITEMS, SETTINGS_AREA_LABEL } from "../config/settingsNavItems";

describe("settingsNavItems", () => {
  it("exports the correct area label", () => {
    expect(SETTINGS_AREA_LABEL).toBe("Settings");
  });

  it("exports three nav items", () => {
    expect(SETTINGS_NAV_ITEMS).toHaveLength(3);
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

  it("includes Users, Roles, and Appearance items", () => {
    const names = SETTINGS_NAV_ITEMS.map((i) => i.name);
    expect(names).toContain("Users");
    expect(names).toContain("Roles & Permissions");
    expect(names).toContain("Appearance");
  });
});
