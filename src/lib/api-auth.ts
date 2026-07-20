/**
 * API authorization middleware for LOOP Next.js route handlers.
 *
 * Provides a consistent authorization boundary at every API endpoint.
 * All responses from these helpers use a standard error envelope so
 * 401/403 are uniform across the entire API surface.
 *
 * Role resolution order:
 *   1. `X-Loop-Role` request header (development / automated tests only)
 *   2. TODO: Supabase JWT ****** `app_role` claim (production)
 *
 * When Supabase auth is wired, replace the header extraction in
 * `resolveRequestRole` with real JWT verification. Everything else
 * (requirePermission, error helpers) remains unchanged.
 */

import { NextResponse } from "next/server";

import { hasPermission } from "@/services/authorization";
import type { AppRole, CoreTable, TableAction } from "@/services/authorization";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const VALID_ROLES: ReadonlySet<string> = new Set<AppRole>([
  "owner",
  "manager",
  "dispatch",
  "tech",
  "office",
  "sales",
  "portal",
]);

function isAppRole(value: string): value is AppRole {
  return VALID_ROLES.has(value);
}

// ---------------------------------------------------------------------------
// Error envelope type
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: string;
  message: string;
  code: number;
}

// ---------------------------------------------------------------------------
// Role resolution
// ---------------------------------------------------------------------------

/**
 * Extracts the caller's AppRole from the incoming request.
 *
 * Returns `null` when no valid identity can be resolved (unauthenticated).
 *
 * **Development / test:** reads the `X-Loop-Role` request header.
 * **Production (stub):** extend this function to verify the Supabase JWT
 * and return the `app_role` claim from the token.
 */
export function resolveRequestRole(request: Request): AppRole | null {
  const headerRole = request.headers.get("x-loop-role");
  if (headerRole !== null && isAppRole(headerRole)) {
    return headerRole;
  }

  // TODO (production): extract role from Supabase JWT
  // const authHeader = request.headers.get("authorization");
  // if (authHeader?.startsWith("Bearer ")) {
  //   const role = verifyAndExtractRole(authHeader.slice(7));
  //   if (role !== null) return role;
  // }

  return null;
}

// ---------------------------------------------------------------------------
// Authorization guard
// ---------------------------------------------------------------------------

export interface AuthContext {
  role: AppRole;
}

export type PermissionResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse<ApiErrorBody> };

/**
 * Resolves the caller's role and checks whether it is allowed to perform
 * `action` on `table`. Returns a discriminated union:
 *
 *   `{ ok: true,  ctx: { role } }` — authorized; continue handling the request
 *   `{ ok: false, response }`      — denied; return `response` immediately
 *
 * Usage:
 * ```ts
 * export async function POST(request: Request) {
 *   const guard = requirePermission(request, "customers", "insert");
 *   if (!guard.ok) return guard.response;
 *   // guard.ctx.role is available here
 * }
 * ```
 */
export function requirePermission(
  request: Request,
  table: CoreTable,
  action: TableAction,
): PermissionResult {
  const role = resolveRequestRole(request);

  if (role === null) {
    return { ok: false, response: unauthorizedResponse() };
  }

  if (!hasPermission(role, table, action)) {
    return { ok: false, response: forbiddenResponse(role, table, action) };
  }

  return { ok: true, ctx: { role } };
}

// ---------------------------------------------------------------------------
// Standard error responses
// ---------------------------------------------------------------------------

/**
 * Returns a 401 JSON response. Use when no authenticated identity is present.
 */
export function unauthorizedResponse(
  message = "Authentication required. Provide a valid identity to access this resource.",
): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    { error: "UNAUTHORIZED", message, code: 401 },
    { status: 401 },
  );
}

/**
 * Returns a 403 JSON response. Use when the caller is authenticated but
 * lacks permission for the requested operation.
 */
export function forbiddenResponse(
  role: AppRole,
  table: CoreTable,
  action: TableAction,
): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    {
      error: "FORBIDDEN",
      message: `Role '${role}' is not permitted to perform '${action}' on '${table}'.`,
      code: 403,
    },
    { status: 403 },
  );
}
