/**
 * API authorization middleware for LOOP Next.js route handlers.
 *
 * Provides a consistent authorization boundary at every API endpoint.
 * All responses from these helpers use a standard error envelope so
 * 401/403 are uniform across the entire API surface.
 *
 * Role resolution order:
 *   1. Supabase server session — role resolved from user metadata fields:
 *        a. user.app_metadata.app_role
 *        b. user.user_metadata.app_role
 *        c. user.app_metadata.role
 *        d. user.user_metadata.role
 *   2. `X-Loop-Role` request header (non-production / automated tests only)
 */

import { NextResponse } from "next/server";

import {
  applyTraceHeaders,
  getRequestTraceContext,
  incrementAuthMetric,
  logAuthEvent,
} from "@/lib/observability/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
 * Resolution order:
 *   1. Supabase server session — reads user metadata role fields.
 *   2. `X-Loop-Role` header — allowed only in non-production environments.
 */
export async function resolveRequestRole(request: Request): Promise<AppRole | null> {
  // --- 1. Supabase server session ---
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const candidates: unknown[] = [
        user.app_metadata?.app_role,
        user.user_metadata?.app_role,
        user.app_metadata?.role,
        user.user_metadata?.role,
      ];

      for (const candidate of candidates) {
        if (typeof candidate === "string" && isAppRole(candidate)) {
          return candidate;
        }
      }
    }
  } catch {
    // Supabase may not be configured in test environments; fall through.
  }

  // --- 2. x-loop-role header (non-production only) ---
  if (process.env.NODE_ENV !== "production") {
    const headerRole = request.headers.get("x-loop-role");
    if (headerRole !== null && isAppRole(headerRole)) {
      return headerRole;
    }
  }

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
 *   const guard = await requirePermission(request, "customers", "insert");
 *   if (!guard.ok) return guard.response;
 *   // guard.ctx.role is available here
 * }
 * ```
 */
export async function requirePermission(
  request: Request,
  table: CoreTable,
  action: TableAction,
): Promise<PermissionResult> {
  const trace = getRequestTraceContext(request);
  const role = await resolveRequestRole(request);

  if (role === null) {
    logAuthEvent({
      event: "unauthorized_access_attempt",
      outcome: "deny",
      route: trace.route,
      statusCode: 401,
      requestId: trace.requestId,
      correlationId: trace.correlationId,
      errorCode: "MISSING_ROLE",
      details: { table, action },
    });
    incrementAuthMetric("auth_401_total", { route: trace.route });
    return { ok: false, response: applyTraceHeaders(unauthorizedResponse(), trace) };
  }

  if (!hasPermission(role, table, action)) {
    logAuthEvent({
      event: "unauthorized_access_attempt",
      outcome: "deny",
      route: trace.route,
      statusCode: 403,
      requestId: trace.requestId,
      correlationId: trace.correlationId,
      role,
      errorCode: "PERMISSION_DENIED",
      details: { table, action },
    });
    incrementAuthMetric("auth_403_total", { route: trace.route });
    return {
      ok: false,
      response: applyTraceHeaders(forbiddenResponse(role, table, action), trace),
    };
  }

  logAuthEvent({
    event: "authz_decision_allow",
    outcome: "success",
    route: trace.route,
    statusCode: 200,
    requestId: trace.requestId,
    correlationId: trace.correlationId,
    role,
    details: { table, action },
  });

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
