/**
 * Central nav configuration — single source of truth.
 *
 * All sidebar and settings navigation is defined here (or re-exported from
 * the feature-level config files listed below). When adding, removing, or
 * restructuring nav items always update the appropriate source file:
 *
 *   Primary sidebar  →  src/components/layout/sidebarNav.ts
 *   Settings sidebar →  src/features/settings/config/settingsNavItems.ts
 *   Route constants  →  src/lib/routes.ts
 *
 * This module provides a single import point for consumers that need to
 * reference both nav layers (e.g. integration tests, admin tooling).
 */

export {
  SHELL_NAV_GROUPS,
  composeSidebarNav,
} from "@/components/layout/sidebarNav";
export type { ComposeSidebarNavOptions } from "@/components/layout/sidebarNav";

export {
  SETTINGS_NAV_ITEMS,
  SETTINGS_AREA_LABEL,
} from "@/features/settings/config/settingsNavItems";
export type { SettingsNavItem } from "@/features/settings/config/settingsNavItems";
