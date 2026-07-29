import { DEFAULT_APPEARANCE, type AccentColor, type AppearancePreferences } from "../types";

export const APPEARANCE_STORAGE_KEY = "loop_appearance_prefs";
export const APPEARANCE_PREFERENCES_CHANGE_EVENT = "loop:appearance-preferences-change";

export const ACCENT_HEX: Record<AccentColor, string> = {
  blue: "#3b82f6",
  purple: "#a855f7",
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
  cyan: "#06b6d4",
};

const CSS_VAR_PRIMARY = "--primary" as const;
const COLOR_MODE_ATTRIBUTE = "data-color-mode" as const;
const SPACING_ATTRIBUTE = "data-spacing" as const;
const ACCENT_COLORS = Object.keys(ACCENT_HEX) as AccentColor[];
const COLOR_MODES = ["dark", "light"] as const;
const SPACING_MODES = ["comfortable", "compact"] as const;
const DASHBOARD_LAYOUTS = ["default", "condensed", "wide"] as const;
const COMMAND_CENTER_LAYOUTS = ["default", "focused"] as const;

type StorageReader = Pick<Storage, "getItem"> | null | undefined;
type StorageWriter = Pick<Storage, "setItem" | "removeItem"> | null | undefined;

export interface AppearanceRoot {
  style: {
    setProperty(name: string, value: string): void;
  };
  setAttribute(name: string, value: string): void;
}

function isStringOption<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function sanitizeAppearancePreferences(
  parsed: Partial<AppearancePreferences>
): AppearancePreferences {
  return {
    accentColor: isStringOption(parsed.accentColor, ACCENT_COLORS)
      ? parsed.accentColor
      : DEFAULT_APPEARANCE.accentColor,
    colorMode: isStringOption(parsed.colorMode, COLOR_MODES)
      ? parsed.colorMode
      : DEFAULT_APPEARANCE.colorMode,
    spacing: isStringOption(parsed.spacing, SPACING_MODES)
      ? parsed.spacing
      : DEFAULT_APPEARANCE.spacing,
    defaultLandingPage:
      typeof parsed.defaultLandingPage === "string" && parsed.defaultLandingPage.length > 0
        ? parsed.defaultLandingPage
        : DEFAULT_APPEARANCE.defaultLandingPage,
    sidebarPinnedDefault:
      typeof parsed.sidebarPinnedDefault === "boolean"
        ? parsed.sidebarPinnedDefault
        : DEFAULT_APPEARANCE.sidebarPinnedDefault,
    dashboardLayout: isStringOption(parsed.dashboardLayout, DASHBOARD_LAYOUTS)
      ? parsed.dashboardLayout
      : DEFAULT_APPEARANCE.dashboardLayout,
    commandCenterLayout: isStringOption(
      parsed.commandCenterLayout,
      COMMAND_CENTER_LAYOUTS
    )
      ? parsed.commandCenterLayout
      : DEFAULT_APPEARANCE.commandCenterLayout,
  };
}

export function loadAppearancePreferences(storage: StorageReader): AppearancePreferences {
  if (!storage) return DEFAULT_APPEARANCE;

  try {
    const raw = storage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;

    const parsed = JSON.parse(raw) as Partial<AppearancePreferences>;
    return sanitizeAppearancePreferences(parsed);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function persistAppearancePreferences(
  storage: StorageWriter,
  preferences: AppearancePreferences
): void {
  if (!storage) return;

  try {
    storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage errors (e.g. private browsing)
  }
}

export function clearAppearancePreferences(storage: StorageWriter): void {
  if (!storage) return;

  try {
    storage.removeItem(APPEARANCE_STORAGE_KEY);
  } catch {
    // Ignore storage errors (e.g. private browsing)
  }
}

export function applyAppearancePreferences(
  root: AppearanceRoot | null | undefined,
  preferences: AppearancePreferences
): void {
  if (!root) return;

  root.style.setProperty(CSS_VAR_PRIMARY, ACCENT_HEX[preferences.accentColor]);
  root.setAttribute(COLOR_MODE_ATTRIBUTE, preferences.colorMode);
  root.setAttribute(SPACING_ATTRIBUTE, preferences.spacing);
}

export function dispatchAppearancePreferencesChanged(
  eventTarget: Pick<Window, "dispatchEvent"> | null | undefined
): void {
  if (!eventTarget) return;

  eventTarget.dispatchEvent(new Event(APPEARANCE_PREFERENCES_CHANGE_EVENT));
}
