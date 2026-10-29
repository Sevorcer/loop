import { ADMIN_BASE, ROUTES } from "@/lib/routes";

/**
 * App routes that require a signed-in user. Checked as an exact path or as a
 * path prefix followed by "/", so "/ops" does not also match "/operations".
 *
 * Shell pages missing from this list render the internal navigation before
 * the client can redirect an anonymous visitor.
 */
export const SHELL_ROUTE_PREFIXES = [
  ADMIN_BASE,
  ROUTES.DASHBOARD,
  ROUTES.COMMAND_CENTER,
  ROUTES.DISPATCH,
  ROUTES.DAILY_PLANS,
  ROUTES.CALENDAR,
  ROUTES.LIVE_OPERATIONS,
  ROUTES.OPERATIONS,
  "/ops",
  ROUTES.JOBS,
  ROUTES.PROPERTIES,
  ROUTES.CUSTOMERS,
  ROUTES.CONTRACTORS,
  ROUTES.INSTALLED_SYSTEMS,
  ROUTES.VEHICLE_ALERTS,
  ROUTES.COMPANY_BRAIN,
  ROUTES.INVENTORY,
  ROUTES.REPORTING,
  ROUTES.SETTINGS,
] as const;

/**
 * API routes authenticated by the LOOP_HEALTH_CHECK_TOKEN bearer token inside
 * the route handler. The session guard must not answer these first: CI sends
 * no session cookie, and a middleware 401 would hide the token check.
 *
 * Exact match only. Sibling routes such as /api/admin/db-health/runs stay on
 * the session guard.
 */
export const TOKEN_AUTHENTICATED_API_ROUTES = [
  "/api/admin/db-health/check",
  "/api/admin/smoke-test",
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function withoutTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isShellRoute(pathname: string): boolean {
  return SHELL_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isTokenAuthenticatedApiRoute(pathname: string): boolean {
  const normalized = withoutTrailingSlash(pathname);
  return TOKEN_AUTHENTICATED_API_ROUTES.some((route) => route === normalized);
}

/** Internal API routes that must reject unauthenticated requests. */
export function isProtectedApiRoute(pathname: string): boolean {
  if (withoutTrailingSlash(pathname) === "/api/auth/sign-out") return false;
  if (isTokenAuthenticatedApiRoute(pathname)) return false;
  return pathname.startsWith("/api/");
}

/** Routes that are always public (no session required). */
export function isPublicRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/update-password") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  );
}
