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
  APPEARANCE_PREFERENCES_CHANGE_EVENT,
  applyAppearancePreferences,
  clearAppearancePreferences,
  dispatchAppearancePreferencesChanged,
  loadAppearancePreferences,
  persistAppearancePreferences,
} from "../lib/appearancePreferences";

export function useAppearancePreferences() {
  const [preferences, setPreferencesState] = useState<AppearancePreferences>(
    () =>
      typeof window === "undefined"
        ? DEFAULT_APPEARANCE
        : loadAppearancePreferences(window.localStorage)
  );

  useEffect(() => {
    const syncPreferences = () => {
      setPreferencesState(loadAppearancePreferences(window.localStorage));
    };

    window.addEventListener("storage", syncPreferences);
    window.addEventListener(APPEARANCE_PREFERENCES_CHANGE_EVENT, syncPreferences);

    return () => {
      window.removeEventListener("storage", syncPreferences);
      window.removeEventListener(
        APPEARANCE_PREFERENCES_CHANGE_EVENT,
        syncPreferences
      );
    };
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
