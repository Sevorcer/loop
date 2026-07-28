"use client";

/**
 * useAppearancePreferences — per-user appearance preferences backed by localStorage.
 *
 * Reads and writes appearance settings without any server round-trips.
 * Preferences are scoped to the browser (per device/user), which is
 * appropriate for UI-only preferences like color mode and spacing.
 */

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_APPEARANCE,
  type AppearancePreferences,
  type AccentColor,
} from "../types";

const STORAGE_KEY = "loop_appearance_prefs";

// Accent color hex values for CSS variable injection
const ACCENT_HEX: Record<AccentColor, string> = {
  blue: "#3b82f6",
  purple: "#a855f7",
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
  cyan: "#06b6d4",
};

const CSS_VAR_PRIMARY = "--primary" as const;

function loadPreferences(): AppearancePreferences {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<AppearancePreferences>;
    return { ...DEFAULT_APPEARANCE, ...parsed };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function applyPreferences(prefs: AppearancePreferences) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Accent color
  root.style.setProperty(CSS_VAR_PRIMARY, ACCENT_HEX[prefs.accentColor]);

  // Color mode
  root.setAttribute("data-color-mode", prefs.colorMode);

  // Spacing density
  root.setAttribute("data-spacing", prefs.spacing);
}

export function useAppearancePreferences() {
  const [preferences, setPreferencesState] = useState<AppearancePreferences>(
    DEFAULT_APPEARANCE
  );

  // Hydrate from localStorage on mount
  useEffect(() => {
    const loaded = loadPreferences();
    setPreferencesState(loaded);
    applyPreferences(loaded);
  }, []);

  const updatePreferences = useCallback(
    (partial: Partial<AppearancePreferences>) => {
      setPreferencesState((current) => {
        const next = { ...current, ...partial };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors (e.g. private browsing)
        }
        applyPreferences(next);
        return next;
      });
    },
    []
  );

  const resetPreferences = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setPreferencesState(DEFAULT_APPEARANCE);
    applyPreferences(DEFAULT_APPEARANCE);
  }, []);

  return { preferences, updatePreferences, resetPreferences };
}
