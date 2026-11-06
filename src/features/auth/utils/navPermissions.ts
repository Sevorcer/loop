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

import { ADMIN_ROUTES, ROUTES } from "@/lib/routes";
import type { AppRole } from "@/services/authorization";
import { isAppRole } from "./appRole";

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

  // My Jobs — every internal role (the page only lists the viewer's own jobs)
  [ROUTES.MY_JOBS]: ["owner", "manager", "dispatch", "tech", "office", "sales"],

  // Operations
  [ROUTES.DAILY_PLANS]: ["owner", "manager", "dispatch", "office"],
  // Operations = the former Command Center (renamed 2026-11-05).
  [ROUTES.OPERATIONS]: ["owner", "manager", "dispatch", "office", "sales"],
  // Live tab inside Operations — office included, sales not (Collin, 2026-11-05).
  [ROUTES.OPERATIONS_LIVE]: ["owner", "manager", "dispatch", "office"],
  [ROUTES.DISPATCH]: ["owner", "manager", "dispatch"],

  // Field
  [ROUTES.JOBS]: ["owner", "manager", "dispatch", "tech", "office", "sales"],
  [ROUTES.PROPERTIES]: ["owner", "manager", "dispatch", "tech", "office", "sales"],
  [ROUTES.CONTRACTORS]: ["owner", "manager", "dispatch"],
  [ROUTES.CUSTOMERS]: ["owner", "manager", "dispatch", "office", "sales"],
  [ROUTES.INSTALLED_SYSTEMS]: ["owner", "manager", "dispatch", "tech", "office", "sales"],
  // Vehicle Alerts — every internal role (Collin, 2026-11-06: techs get full access).
  [ROUTES.VEHICLE_ALERTS]: ["owner", "manager", "dispatch", "tech", "office", "sales"],

  // Resources. My van is the technician phone screen. Office inventory stays closed to techs.
  [ROUTES.INVENTORY]: ["owner", "manager", "dispatch", "office"],
  [ROUTES.INVENTORY_MY_VAN]: ["tech"],
  // Company Brain — viewable by every internal role (Collin, 2026-11-06);
  // editing stays owner/manager via the knowledge_items matrix.
  [ROUTES.COMPANY_BRAIN]: ["owner", "manager", "dispatch", "tech", "office", "sales"],

  // Insights
  [ROUTES.BILLING]: ["owner", "manager", "office"],
  [ROUTES.REPORTING]: ["owner", "manager", "dispatch", "office", "sales"],

  // GC Overview — same visibility as the ledger: owner, manager, dispatch, office, sales
  [ROUTES.GC_OVERVIEW]: ["owner", "manager", "dispatch", "office", "sales"],

  // Phase 3 — Permits & Inspections office views
  [ROUTES.PERMITS_BOARD]: ["owner", "manager", "office"],
  [ROUTES.INSPECTIONS_WEEK]: ["owner", "manager", "office"],

  // Feedback Inbox — manager/owner triage
  [ROUTES.OPS_FEEDBACK]: ["owner", "manager"],

  // Administration
  [ADMIN_ROUTES.ORGANIZATIONS]: ["owner", "manager"],

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
// null/unknown role: fails closed to tech-level nav (most restricted internal role).
// ---------------------------------------------------------------------------

export function getNavItemsForRole(
  role: AppRole | string | null | undefined,
  groups: NavGroup[]
): NavGroup[] {


  if (role === "portal") {
    return [];
  }

  if (!isAppRole(role)) {
    // Fail closed: unrecognized or null roles see tech-level nav (most restricted).
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const allowed = NAV_ROUTE_ROLES[item.href];
          if (!allowed) return INTERNAL_ROLES.includes("tech");
          return allowed.includes("tech");
        }),
      }))
      .filter((group) => group.items.length > 0);
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
