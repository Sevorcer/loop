import { describe, it, expect } from "vitest";
import { DEFAULT_APPEARANCE } from "../types";
import type { AppearancePreferences } from "../types";

describe("AppearancePreferences defaults", () => {
  it("has all required keys", () => {
    const keys: (keyof AppearancePreferences)[] = [
      "accentColor",
      "colorMode",
      "spacing",
      "defaultLandingPage",
      "sidebarPinnedDefault",
      "dashboardLayout",
      "commandCenterLayout",
    ];
    for (const key of keys) {
      expect(DEFAULT_APPEARANCE).toHaveProperty(key);
    }
  });

  it("defaults to dark mode", () => {
    expect(DEFAULT_APPEARANCE.colorMode).toBe("dark");
  });

  it("defaults to blue accent", () => {
    expect(DEFAULT_APPEARANCE.accentColor).toBe("blue");
  });

  it("defaults to comfortable spacing", () => {
    expect(DEFAULT_APPEARANCE.spacing).toBe("comfortable");
  });

  it("defaults to dashboard landing page", () => {
    expect(DEFAULT_APPEARANCE.defaultLandingPage).toBe("/dashboard");
  });

  it("defaults sidebar pinned to true", () => {
    expect(DEFAULT_APPEARANCE.sidebarPinnedDefault).toBe(true);
  });
});
