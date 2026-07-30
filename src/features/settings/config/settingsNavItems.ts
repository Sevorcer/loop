/**
 * Settings area navigation configuration — Sprint 7 Settings Enhancements.
 *
 * Separates nav data from the React component so that tests can assert
 * on the item list without rendering components.
 */

import { ROUTES } from "@/lib/routes";

// ─── Label ────────────────────────────────────────────────────────────────────

export const SETTINGS_AREA_LABEL = "Settings" as const;

// ─── Nav items ────────────────────────────────────────────────────────────────

export interface SettingsNavItem {
  name: string;
  href: string;
  description: string;
}

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    name: "Users",
    href: ROUTES.SETTINGS_USERS,
    description: "Manage team members and access",
  },
  {
    name: "Roles & Permissions",
    href: ROUTES.SETTINGS_ROLES,
    description: "View role permission mappings",
  },
  {
    name: "Appearance",
    href: ROUTES.SETTINGS_APPEARANCE,
    description: "Customize your workspace look and feel",
  },
  {
    name: "Feedback",
    href: ROUTES.SETTINGS_FEEDBACK,
    description: "Review and triage field feedback",
  },
] as const;
