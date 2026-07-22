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

export interface ApiErrorBody {
  error: string;
  message: string;
  code: number;
}

export interface AuthContext {
  role: AppRole;
}

export type PermissionResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse<ApiErrorBody> };

function extractRoleFromUser(user: {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}): AppRole | null {
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

  return null;
}

export async function resolveRequestRole(request: Request): Promise<AppRole | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      const role = extractRoleFromUser(user);
      if (role) return role;

      if (process.env.NODE_ENV !== "production") {
        return "owner";
      }

      return null;
    }
  } catch {
    // continue to non-prod fallback
  }

  if (process.env.NODE_ENV !== "production") {
    const headerRole = request.headers.get("x-loop-role");
    if (headerRole && isAppRole(headerRole)) return headerRole;
  }

  return null;
}

export async function requirePermission(
  request: Request,
  table: CoreTable,
  action: TableAction,
): Promise<PermissionResult> {
  const trace = getRequestTraceContext(request);
  const role = await resolveRequestRole(request);

  if (role === null) {
    const hasCookieHeader = Boolean(request.headers.get("cookie"));

    logAuthEvent({
      event: "unauthorized_access_attempt",
      outcome: "deny",
      route: trace.route,
      statusCode: 401,
      requestId: trace.requestId,
      correlationId: trace.correlationId,
      errorCode: "MISSING_ROLE",
      details: { table, action, hasCookieHeader },
    });
    incrementAuthMetric("auth_401_total", { route: trace.route });

    const response = unauthorizedResponse("A valid session is required.");
    if (process.env.NODE_ENV !== "production") {
      response.headers.set("x-auth-debug-has-cookie", String(hasCookieHeader));
      response.headers.set("x-auth-debug-node-env", process.env.NODE_ENV ?? "unknown");
    }

    return { ok: false, response: applyTraceHeaders(response, trace) };
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

export function unauthorizedResponse(
  message = "A valid session is required.",
): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    { error: "UNAUTHORIZED", message, code: 401 },
    { status: 401 },
  );
}

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