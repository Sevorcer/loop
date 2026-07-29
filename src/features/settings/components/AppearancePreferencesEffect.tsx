"use client";

import { useEffect } from "react";

import {
  APPEARANCE_PREFERENCES_CHANGE_EVENT,
  applyAppearancePreferences,
  loadAppearancePreferences,
} from "../lib/appearancePreferences";

export function AppearancePreferencesEffect() {
  useEffect(() => {
    const syncAppearancePreferences = () => {
      applyAppearancePreferences(
        document.documentElement,
        loadAppearancePreferences(window.localStorage)
      );
    };

    syncAppearancePreferences();
    window.addEventListener("storage", syncAppearancePreferences);
    window.addEventListener(
      APPEARANCE_PREFERENCES_CHANGE_EVENT,
      syncAppearancePreferences
    );

    return () => {
      window.removeEventListener("storage", syncAppearancePreferences);
      window.removeEventListener(
        APPEARANCE_PREFERENCES_CHANGE_EVENT,
        syncAppearancePreferences
      );
    };
  }, []);

  return null;
}
