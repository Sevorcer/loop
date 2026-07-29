"use client";

/**
 * useAppearancePreferences — per-user appearance preferences backed by localStorage.
 *
 * Reads and writes appearance settings without any server round-trips.
 * Preferences are scoped to the browser (per device/user), which is
 * appropriate for UI-only preferences like color mode and spacing.
 */

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_APPEARANCE, type AppearancePreferences } from "../types";
import {
  applyAppearancePreferences,
  clearAppearancePreferences,
  dispatchAppearancePreferencesChanged,
  loadAppearancePreferences,
  persistAppearancePreferences,
} from "../lib/appearancePreferences";

export function useAppearancePreferences() {
  const [preferences, setPreferencesState] = useState<AppearancePreferences>(
    DEFAULT_APPEARANCE
  );

  // Hydrate from localStorage on mount
  useEffect(() => {
    const loaded = loadAppearancePreferences(window.localStorage);
    setPreferencesState(loaded);
    applyAppearancePreferences(document.documentElement, loaded);
  }, []);

  const updatePreferences = useCallback(
    (partial: Partial<AppearancePreferences>) => {
      setPreferencesState((current) => {
        const next = { ...current, ...partial };
        persistAppearancePreferences(window.localStorage, next);
        applyAppearancePreferences(document.documentElement, next);
        dispatchAppearancePreferencesChanged(window);
        return next;
      });
    },
    []
  );

  const resetPreferences = useCallback(() => {
    clearAppearancePreferences(window.localStorage);
    setPreferencesState(DEFAULT_APPEARANCE);
    applyAppearancePreferences(document.documentElement, DEFAULT_APPEARANCE);
    dispatchAppearancePreferencesChanged(window);
  }, []);

  return { preferences, updatePreferences, resetPreferences };
}
