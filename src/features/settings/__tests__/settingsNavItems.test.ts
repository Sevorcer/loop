import { describe, it, expect } from "vitest";
import { SETTINGS_NAV_ITEMS, SETTINGS_AREA_LABEL } from "../config/settingsNavItems";

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
