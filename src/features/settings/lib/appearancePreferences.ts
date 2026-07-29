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

type StorageReader = Pick<Storage, "getItem"> | null | undefined;
type StorageWriter = Pick<Storage, "setItem" | "removeItem"> | null | undefined;

export interface AppearanceRoot {
  style: {
    setProperty(name: string, value: string): void;
  };
  setAttribute(name: string, value: string): void;
}

export function loadAppearancePreferences(storage: StorageReader): AppearancePreferences {
  if (!storage) return DEFAULT_APPEARANCE;

  try {
    const raw = storage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;

    const parsed = JSON.parse(raw) as Partial<AppearancePreferences>;
    return { ...DEFAULT_APPEARANCE, ...parsed };
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
