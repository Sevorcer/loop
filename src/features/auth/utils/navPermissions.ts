/**
 * Navigation permission utilities for Sprint 25.
 *
 * Maps each shell route to the set of roles that should see it in the sidebar,
 * derived from the permission matrix in docs/architecture/security/rls-role-matrix.md.
 *
 * Routes that are accessible to all internal roles (e.g. Dashboard) have no
 * entry — the absence of a key means "show to all non-portal roles".
 *
 * `portal` role users are never shown internal shell navigation.
 */

import { ROUTES, PORTAL_ROUTES } from "@/lib/routes";
import type { AppRole } from "@/services/authorization";

// ---------------------------------------------------------------------------
// Internal roles — the roles that may access the operations shell at all.
// Portal users are explicitly excluded.
// ---------------------------------------------------------------------------
const INTERNAL_ROLES: ReadonlyArray<AppRole> = [
  "owner",
  "manager",
  "dispatch",
  "tech",
  "office",
  "sales",
];

// ---------------------------------------------------------------------------
// NAV_ROUTE_ROLES
//
// Structure: route path → allowed AppRole[]
//
// When a route is absent from this map it is visible to all INTERNAL_ROLES.
// ---------------------------------------------------------------------------
export const NAV_ROUTE_ROLES: Readonly<Record<string, ReadonlyArray<AppRole>>> = {
  // Dashboard — all internal roles
  // (absent from map → visible to all)

  // Operations
  [ROUTES.DAILY_PLANS]: ["owner", "manager", "dispatch", "office"],
  [ROUTES.LIVE_OPERATIONS]: ["owner", "manager", "dispatch"],
  [ROUTES.DISPATCH]: ["owner", "manager", "dispatch"],

  // Field
  [ROUTES.JOBS]: ["owner", "manager", "dispatch", "tech", "office", "sales"],
  [ROUTES.PROPERTIES]: ["owner", "manager", "dispatch", "tech", "office", "sales"],
  [ROUTES.CONTRACTORS]: ["owner", "manager", "dispatch", "tech"],
  [ROUTES.CUSTOMERS]: ["owner", "manager", "dispatch", "office", "sales"],
  [ROUTES.INSTALLED_SYSTEMS]: ["owner", "manager", "dispatch", "tech", "office", "sales"],
  [ROUTES.VEHICLE_ALERTS]: ["owner", "manager", "dispatch"],

  // Resources
  [ROUTES.INVENTORY]: ["owner", "manager", "dispatch", "office"],
  [ROUTES.COMPANY_BRAIN]: ["owner", "manager"],

  // Insights
  [ROUTES.REPORTING]: ["owner", "manager"],

  // External — Project Portal link is shown to owner/manager only from ops shell
  [PORTAL_ROUTES.ROOT]: ["owner", "manager"],

  // Workspace
  [ROUTES.SETTINGS]: ["owner", "manager"],
};

// ---------------------------------------------------------------------------
// NavItem / NavGroup types (mirror Sidebar's local types to keep this pure)
// ---------------------------------------------------------------------------

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// getNavItemsForRole
//
// Pure function — filters nav groups/items to those allowed for the given role.
// Groups that end up with zero visible items are omitted entirely.
//
// portal role: returns empty array — portal users see nothing in the ops shell.
// null role (loading): returns empty array — nothing shown before role resolves.
// ---------------------------------------------------------------------------

export function getNavItemsForRole(
  role: AppRole | null,
  groups: NavGroup[]
): NavGroup[] {
  // Portal users and unauthenticated states see nothing in the ops shell.
  if (!role || role === "portal") {
    return [];
  }

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const allowed = NAV_ROUTE_ROLES[item.href];
        // If the route has no explicit restriction, show to all internal roles.
        if (!allowed) return INTERNAL_ROLES.includes(role);
        return allowed.includes(role);
      }),
    }))
    .filter((group) => group.items.length > 0);
}
