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
  // Operations (ex-Command Center) and its Live view. /command-center and
  // /live-operations stay listed so the legacy redirects never leak to techs.
  ROUTES.OPERATIONS,
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
  // Sales may open the Operations overview but not its Live tab (2026-11-05).
  ROUTES.OPERATIONS_LIVE,
  ADMIN_BASE,
];

/**
 * Portal (builder) users have no business in the internal Operations area.
 * Collin's ruling (2026-11-05): techs and portal users get no access to
 * /operations at all, including the legacy addresses that redirect there.
 */
const PORTAL_DENIED_PREFIXES: readonly string[] = [
  ROUTES.OPERATIONS,
  ROUTES.COMMAND_CENTER,
  ROUTES.LIVE_OPERATIONS,
];

/**
 * Map of roles to their denied path prefixes. Roles not listed here
 * (owner, manager, dispatch, office) have unrestricted shell access.
 * Office is unrestricted by Collin's ruling (2026-11-04): the office
 * staff keep access to every shell area, including dispatch, feedback,
 * contractors, vehicle alerts, company brain, settings, and live ops.
 */
const ROLE_DENIED_PREFIXES: Partial<Record<AppRole, readonly string[]>> = {
  tech: TECH_DENIED_PREFIXES,
  sales: SALES_DENIED_PREFIXES,
  portal: PORTAL_DENIED_PREFIXES,
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

  // My van is the one inventory path a technician may open. The /inventory
  // prefix stays denied, which would otherwise swallow /inventory/my-van.
  if (role === "tech" && isTechMyVanPath(path)) return false;

  return deniedPrefixes.some((prefix) => matchesPrefix(path, prefix));
}

/** Exact /inventory/my-van, not a sibling such as /inventory/my-van-other. */
function isTechMyVanPath(pathname: string): boolean {
  return pathname === ROUTES.INVENTORY_MY_VAN || pathname.startsWith(`${ROUTES.INVENTORY_MY_VAN}/`);
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
