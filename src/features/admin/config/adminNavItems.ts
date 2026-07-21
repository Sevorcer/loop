/**
 * Administration nav configuration — Sprint 30 IA refactor.
 *
 * Separates nav data from the React component so that tests can assert
 * on the item list without rendering components. Import this in
 * AdminSidebar to build the nav links.
 */

import { ADMIN_ROUTES, ROUTES } from "@/lib/routes";

// ─── Label ────────────────────────────────────────────────────────────────────

export const ADMIN_AREA_LABEL = "Administration" as const;

// ─── Active governance nav items ─────────────────────────────────────────────

export interface AdminNavItem {
  name: string;
  href: string;
}

/**
 * Currently available governance modules shown in the Administration sidebar.
 * Operational entities (Jobs, Customers, Properties) are NOT included here —
 * they live in the Operations shell at their own routes.
 */
export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { name: "Organizations", href: ADMIN_ROUTES.ORGANIZATIONS },
] as const;

// ─── Planned governance modules (displayed as placeholders on the landing) ───

export interface AdminModulePlaceholder {
  name: string;
  description: string;
  comingSoon: true;
}

export const ADMIN_MODULE_PLACEHOLDERS: readonly AdminModulePlaceholder[] = [
  {
    name: "User Management",
    description: "Invite, suspend, and manage platform users.",
    comingSoon: true,
  },
  {
    name: "Roles & Permissions",
    description: "Define role matrices and capability grants.",
    comingSoon: true,
  },
  {
    name: "Teams & Crews",
    description: "Organize staff into operational teams and field crews.",
    comingSoon: true,
  },
  {
    name: "Global Settings",
    description: "Platform-wide defaults, branding, and locale configuration.",
    comingSoon: true,
  },
  {
    name: "Integrations",
    description: "Connect third-party services and manage API credentials.",
    comingSoon: true,
  },
  {
    name: "Audit Log",
    description: "Immutable record of all administrative actions.",
    comingSoon: true,
  },
  {
    name: "System Health",
    description: "Service status, error rates, and infrastructure metrics.",
    comingSoon: true,
  },
  {
    name: "Storage",
    description: "Manage file quotas, retention policies, and media assets.",
    comingSoon: true,
  },
] as const;

// ─── Legacy redirect map ──────────────────────────────────────────────────────

/**
 * Maps deprecated /admin/* paths to their operational destinations.
 * These routes still exist as redirect pages for backward compatibility.
 */
export const ADMIN_LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
  [ADMIN_ROUTES.JOBS]: ROUTES.JOBS,
  [ADMIN_ROUTES.CUSTOMERS]: ROUTES.CUSTOMERS,
  [ADMIN_ROUTES.PROPERTIES]: ROUTES.PROPERTIES,
} as const;
