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
  /** Section is gated to owner/manager. Items without this flag are open to every role. */
  ownerManagerOnly?: boolean;
}

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  {
    name: "Users",
    href: ROUTES.SETTINGS_USERS,
    description: "Manage team members and access",
    ownerManagerOnly: true,
  },
  {
    name: "Roles & Permissions",
    href: ROUTES.SETTINGS_ROLES,
    description: "View role permission mappings",
    ownerManagerOnly: true,
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
    ownerManagerOnly: true,
  },
] as const;

// ─── Role-aware helpers ───────────────────────────────────────────────────────

/**
 * Owner/manager (or an unresolved role, matching the section pages, whose
 * own gates are `appRole && appRole !== owner/manager`) can reach the
 * management sections. Every other role only gets the open sections.
 */
export function canAccessManagementSettings(appRole: string | null | undefined): boolean {
  return !appRole || appRole === "owner" || appRole === "manager";
}

/** Nav items visible to a role. Appearance is visible to everyone. */
export function getSettingsNavItems(appRole: string | null | undefined): readonly SettingsNavItem[] {
  if (canAccessManagementSettings(appRole)) return SETTINGS_NAV_ITEMS;
  return SETTINGS_NAV_ITEMS.filter((item) => !item.ownerManagerOnly);
}

/** Where `/settings` should land for a role. */
export function getSettingsLandingHref(appRole: string | null | undefined): string {
  return canAccessManagementSettings(appRole) ? ROUTES.SETTINGS_USERS : ROUTES.SETTINGS_APPEARANCE;
}
