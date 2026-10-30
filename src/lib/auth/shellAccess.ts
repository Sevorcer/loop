import { ADMIN_BASE, ROUTES } from "@/lib/routes";

/**
 * Paths a technician must not open. Sidebar hiding is not enough — these
 * prefixes are enforced in middleware and in the page layouts.
 *
 * Owner, manager, and dispatcher are not filtered here. Only the tech role
 * is redirected.
 */
const TECH_DENIED_PREFIXES = [
  ROUTES.DISPATCH,
  ROUTES.DAILY_PLANS,
  ROUTES.CUSTOMERS,
  ROUTES.COMMAND_CENTER,
  ROUTES.LIVE_OPERATIONS,
  ROUTES.CONTRACTORS,
  ROUTES.VEHICLE_ALERTS,
  ROUTES.INVENTORY,
  ROUTES.COMPANY_BRAIN,
  ROUTES.REPORTING,
  ROUTES.SETTINGS,
  ROUTES.OPS_FEEDBACK,
  ADMIN_BASE,
] as const;

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

export function isTechDeniedPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (isTechJobEditorPath(path)) return true;
  return TECH_DENIED_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}

/**
 * API prefixes that back office-only screens. Technicians keep /api/jobs for
 * notes, photos, checklists, and status changes on their assigned work.
 */
const TECH_DENIED_API_PREFIXES = [
  "/api/dispatch",
  "/api/dispatch-plans",
  "/api/daily-plans",
  "/api/customers",
  "/api/schedule-blocks",
  "/api/crews",
] as const;

export function isTechDeniedApiPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return TECH_DENIED_API_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}
