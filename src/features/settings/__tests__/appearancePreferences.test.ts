import { describe, it, expect } from "vitest";
import { DEFAULT_APPEARANCE } from "../types";
import type { AppearancePreferences } from "../types";
import {
  ACCENT_HEX,
  applyAppearancePreferences,
  hasSidebarNavOverride,
  loadAppearancePreferences,
  resetSidebarNavOverride,
} from "../lib/appearancePreferences";

describe("AppearancePreferences defaults", () => {
  it("has all required keys", () => {
    const keys: (keyof AppearancePreferences)[] = [
      "accentColor",
      "colorMode",
      "spacing",
      "defaultLandingPage",
      "sidebarPinnedDefault",
      "sidebarNavOverride",
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

  it("defaults sidebar pinned to false", () => {
    expect(DEFAULT_APPEARANCE.sidebarPinnedDefault).toBe(false);
  });

  it("defaults sidebar nav overrides to empty", () => {
    expect(DEFAULT_APPEARANCE.sidebarNavOverride).toEqual([]);
  });
});

describe("appearance preference application", () => {
  it("merges stored preferences with defaults", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          accentColor: "purple",
          spacing: "compact",
        }),
    };

    expect(loadAppearancePreferences(storage)).toEqual({
      ...DEFAULT_APPEARANCE,
      accentColor: "purple",
      spacing: "compact",
    });
  });

  it("falls back to defaults for invalid stored values", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          accentColor: "pink",
          colorMode: "sepia",
          spacing: 123,
          sidebarPinnedDefault: "yes",
          sidebarNavOverride: ["/jobs", 123, "", "/jobs"],
        }),
    };

    expect(loadAppearancePreferences(storage)).toEqual({
      ...DEFAULT_APPEARANCE,
      sidebarNavOverride: ["/jobs"],
    });
  });

  it("keeps valid sidebar nav overrides and removes duplicates", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          sidebarNavOverride: ["/jobs", "/reporting", "/jobs"],
        }),
    };

    expect(loadAppearancePreferences(storage)).toEqual({
      ...DEFAULT_APPEARANCE,
      sidebarNavOverride: ["/jobs", "/reporting"],
    });
  });

  it("applies accent and appearance attributes to the html root", () => {
    const appliedStyles = new Map<string, string>();
    const appliedAttributes = new Map<string, string>();

    applyAppearancePreferences(
      {
        style: {
          setProperty: (name, value) => {
            appliedStyles.set(name, value);
          },
        },
        setAttribute: (name, value) => {
          appliedAttributes.set(name, value);
        },
      },
      {
        ...DEFAULT_APPEARANCE,
        accentColor: "green",
        colorMode: "light",
        spacing: "compact",
      }
    );

    expect(appliedStyles.get("--primary")).toBe(ACCENT_HEX.green);
    expect(appliedAttributes.get("data-color-mode")).toBe("light");
    expect(appliedAttributes.get("data-spacing")).toBe("compact");
  });

  it("reapplies updated accent values immediately without a reload", () => {
    const appliedStyles = new Map<string, string>();
    const appliedAttributes = new Map<string, string>();
    const root = {
      style: {
        setProperty: (name: string, value: string) => {
          appliedStyles.set(name, value);
        },
      },
      setAttribute: (name: string, value: string) => {
        appliedAttributes.set(name, value);
      },
    };

    applyAppearancePreferences(root, DEFAULT_APPEARANCE);
    applyAppearancePreferences(root, {
      ...DEFAULT_APPEARANCE,
      accentColor: "orange",
      colorMode: "light",
      spacing: "compact",
    });

    expect(appliedStyles.get("--primary")).toBe(ACCENT_HEX.orange);
    expect(appliedAttributes.get("data-color-mode")).toBe("light");
    expect(appliedAttributes.get("data-spacing")).toBe("compact");
  });
});

describe("sidebar nav reset helpers", () => {
  it("detects when a custom sidebar nav override exists", () => {
    expect(hasSidebarNavOverride(DEFAULT_APPEARANCE)).toBe(false);
    expect(
      hasSidebarNavOverride({
        ...DEFAULT_APPEARANCE,
        sidebarNavOverride: ["/reporting"],
      })
    ).toBe(true);
  });

  it("clears only sidebar nav overrides when resetting to role default", () => {
    const customized = {
      ...DEFAULT_APPEARANCE,
      accentColor: "green" as const,
      sidebarPinnedDefault: true,
      sidebarNavOverride: ["/reporting", "/settings"],
    };

    expect(resetSidebarNavOverride(customized)).toEqual({
      ...customized,
      sidebarNavOverride: [],
    });
  });
});
