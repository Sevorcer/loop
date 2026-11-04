import type { AppRole } from "@/services/authorization";
import { ADMIN_BASE, ROUTES } from "@/lib/routes";

// ---------------------------------------------------------------------------
// Role-based denied path prefixes
//
// Derived from NAV_ROUTE_ROLES in src/features/auth/utils/navPermissions.ts.
// Sidebar hiding alone is not enough — these prefixes are enforced in
// middleware (proxy.ts) and in page layouts. Routes absent from a role's
// denied list are accessible to that role.
//
// Owner, manager, and dispatcher have no denied prefixes (full access).
// ---------------------------------------------------------------------------

const TECH_DENIED_PREFIXES: readonly string[] = [
  ROUTES.BILLING,
  ROUTES.GC_OVERVIEW,
  ROUTES.COMMAND_CENTER,
  ROUTES.DAILY_PLANS,
  ROUTES.DISPATCH,
  ROUTES.CONTRACTORS,
  ROUTES.VEHICLE_ALERTS,
  ROUTES.COMPANY_BRAIN,
  ROUTES.SETTINGS,
  ROUTES.OPS_FEEDBACK,
  ROUTES.INVENTORY,
  ROUTES.LIVE_OPERATIONS,
  ROUTES.CUSTOMERS,
  ROUTES.REPORTING,
  ADMIN_BASE,
];

const SALES_DENIED_PREFIXES: readonly string[] = [
  ROUTES.BILLING,
  ROUTES.DISPATCH,
  ROUTES.DAILY_PLANS,
  ROUTES.CONTRACTORS,
  ROUTES.VEHICLE_ALERTS,
  ROUTES.COMPANY_BRAIN,
  ROUTES.SETTINGS,
  ROUTES.OPS_FEEDBACK,
  ROUTES.INVENTORY,
  ROUTES.LIVE_OPERATIONS,
  ADMIN_BASE,
];

const OFFICE_DENIED_PREFIXES: readonly string[] = [
  ROUTES.DISPATCH,
  ROUTES.CONTRACTORS,
  ROUTES.VEHICLE_ALERTS,
  ROUTES.COMPANY_BRAIN,
  ROUTES.SETTINGS,
  ROUTES.OPS_FEEDBACK,
  ROUTES.LIVE_OPERATIONS,
  ADMIN_BASE,
];

/**
 * Map of roles to their denied path prefixes. Roles not listed here
 * (owner, manager, dispatch) have unrestricted shell access.
 */
const ROLE_DENIED_PREFIXES: Partial<Record<AppRole, readonly string[]>> = {
  tech: TECH_DENIED_PREFIXES,
  sales: SALES_DENIED_PREFIXES,
  office: OFFICE_DENIED_PREFIXES,
};

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Job create/edit screens are office controls. Field work stays on the job page. */
export function isTechJobEditorPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === `${ROUTES.JOBS}/new` || /^\/jobs\/[^/]+\/edit$/.test(path);
}

/**
 * Check whether a given role is denied access to a path.
 * Returns true when the role must not open the path.
 */
export function isRoleDeniedPath(role: string | null | undefined, pathname: string): boolean {
  if (!role) return false;

  const deniedPrefixes = ROLE_DENIED_PREFIXES[role as AppRole];
  if (!deniedPrefixes) return false;

  const path = normalizePath(pathname);

  // Tech role has additional job editor restrictions
  if (role === "tech" && isTechJobEditorPath(path)) return true;

  return deniedPrefixes.some((prefix) => matchesPrefix(path, prefix));
}

/**
 * @deprecated Use `isRoleDeniedPath(role, pathname)` instead.
 * Kept for backward compatibility — checks tech role only.
 */
export function isTechDeniedPath(pathname: string): boolean {
  return isRoleDeniedPath("tech", pathname);
}

/**
 * API prefixes that back office-only screens. Technicians keep /api/jobs for
 * notes, photos, checklists, and status changes on their assigned work.
 */
const TECH_DENIED_API_PREFIXES = [
  "/api/dispatch-plans",
  "/api/daily-plans",
  "/api/customers",
  "/api/schedule-blocks",
  "/api/crews",
  "/api/reports",
] as const;

export function isTechDeniedApiPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return TECH_DENIED_API_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}
