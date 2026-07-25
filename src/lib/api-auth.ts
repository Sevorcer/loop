import { NextResponse } from "next/server";

import {
  applyTraceHeaders,
  getRequestTraceContext,
  incrementAuthMetric,
  logAuthEvent,
} from "@/lib/observability/auth";
import { resolveAuthRefresh } from "@/lib/auth/refreshResolver";
import { unauthorizedResponse as buildUnauthorizedResponse } from "@/lib/auth/unauthorized";
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
  userId: string;
}

export type PermissionResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse<ApiErrorBody> };

function extractRoleFromUser(user: {
  id?: string;
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

type ResolvedAuth = { role: AppRole; userId: string };

async function resolveRequestAuth(request: Request): Promise<ResolvedAuth | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const resolved = await resolveAuthRefresh({
      getUser: async () => {
        const { data, error } = await supabase.auth.getUser();
        return {
          data: {
            user: data.user
              ? {
                  id: data.user.id,
                  app_metadata: data.user.app_metadata,
                  user_metadata: data.user.user_metadata,
                }
              : null,
          },
          error: error
            ? {
                message: error.message,
                name: (error as { name?: string }).name,
                code: (error as { code?: string }).code,
                status: (error as { status?: number }).status,
              }
            : null,
        };
      },
      clearSession: async () => {
        await supabase.auth.signOut();
      },
    });

    const user = resolved.user;
    if (resolved.status === "authenticated" && user) {
      const extractedRole = extractRoleFromUser(user);
      if (extractedRole) {
        return { role: extractedRole, userId: user.id ?? "" };
      }

      if (process.env.NODE_ENV !== "production") {
        return { role: "owner", userId: user.id ?? "" };
      }

      return null;
    }
  } catch {
    // Session probe failed — fall through to header fallback (non-prod only).
  }

  if (process.env.NODE_ENV !== "production") {
    const headerRole = request.headers.get("x-loop-role");
    if (headerRole && isAppRole(headerRole)) {
      return { role: headerRole, userId: "" };
    }
  }

  return null;
}

export async function resolveRequestRole(request: Request): Promise<AppRole | null> {
  const auth = await resolveRequestAuth(request);
  return auth ? auth.role : null;
}

export async function requirePermission(
  request: Request,
  table: CoreTable,
  action: TableAction,
): Promise<PermissionResult> {
  const trace = getRequestTraceContext(request);
  const auth = await resolveRequestAuth(request);

  if (auth === null) {
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

    const response = unauthorizedResponse("A valid session is required.");
    return { ok: false, response: applyTraceHeaders(response, trace) };
  }

  const { role, userId } = auth;

  if (!hasPermission(role, table, action)) {
    logAuthEvent({
      event: "authz_decision_deny",
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

  return { ok: true, ctx: { role, userId } };
}

export function unauthorizedResponse(
  message = "A valid session is required.",
): NextResponse<ApiErrorBody> {
  return buildUnauthorizedResponse(message) as NextResponse<ApiErrorBody>;
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