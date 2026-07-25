import { NextResponse } from "next/server";

import {
  classifyUnauthorizedRefreshReason,
  createForbiddenResponse,
  unauthorizedResponse,
  type ApiErrorBody,
  type UnauthorizedReason,
} from "@/lib/auth/errorContract";
import {
  applyTraceHeaders,
  getRequestTraceContext,
  incrementAuthMetric,
  logAuthorizationDecision,
  recordAuthDuration,
  startAuthTimer,
} from "@/lib/observability/auth";
import { resolveAuthRefresh } from "@/lib/auth/refreshResolver";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/services/authorization";
import type { AppRole, CoreTable, TableAction } from "@/services/authorization";

export {
  buildForbiddenErrorBody,
  buildUnauthorizedErrorBody,
  classifyUnauthorizedReason,
  classifyUnauthorizedRefreshReason,
  createForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/errorContract";
export type {
  ApiErrorBody,
  AuthErrorReason,
  ForbiddenReason,
  SessionLikeError,
  UnauthorizedReason,
} from "@/lib/auth/errorContract";

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

export interface AuthContext {
  role: AppRole;
  userId: string;
}

export type PermissionResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse<ApiErrorBody> };

type ResolvedAuth = { role: AppRole; userId: string };
type ResolvedAuthResult =
  | { ok: true; auth: ResolvedAuth }
  | { ok: false; reason: UnauthorizedReason };

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

async function resolveRequestAuth(request: Request): Promise<ResolvedAuthResult> {
  let failureReason: UnauthorizedReason = "missing_token";

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
        return { ok: true, auth: { role: extractedRole, userId: user.id ?? "" } };
      }

      if (process.env.NODE_ENV !== "production") {
        return { ok: true, auth: { role: "owner", userId: user.id ?? "" } };
      }

      return { ok: false, reason: "missing_role" };
    }

    failureReason = classifyUnauthorizedRefreshReason(resolved.resolution, resolved.error);
  } catch {
    // Session probe failed — fall through to header fallback (non-prod only).
    failureReason = "invalid_token";
  }

  if (process.env.NODE_ENV !== "production") {
    const headerRole = request.headers.get("x-loop-role");
    if (headerRole && isAppRole(headerRole)) {
      return { ok: true, auth: { role: headerRole, userId: "" } };
    }
  }

  return { ok: false, reason: failureReason };
}

export async function resolveRequestRole(request: Request): Promise<AppRole | null> {
  const auth = await resolveRequestAuth(request);
  return auth.ok ? auth.auth.role : null;
}

export async function requirePermission(
  request: Request,
  table: CoreTable,
  action: TableAction,
): Promise<PermissionResult> {
  const trace = getRequestTraceContext(request);
  const timerStart = startAuthTimer();
  const auth = await resolveRequestAuth(request);
  recordAuthDuration("permission_check", timerStart);

  if (!auth.ok) {
    logAuthorizationDecision({
      route: trace.route,
      method: request.method,
      actorRole: null,
      policy: table,
      action,
      decision: "deny",
      reasonCode: auth.reason.toUpperCase(),
    });
    incrementAuthMetric("auth_401_total", { route: trace.route, category: auth.reason });

    const response = unauthorizedResponse(undefined, auth.reason);
    return { ok: false, response: applyTraceHeaders(response, trace) };
  }

  const { role, userId } = auth.auth;

  if (!hasPermission(role, table, action)) {
    logAuthorizationDecision({
      route: trace.route,
      method: request.method,
      actorRole: role,
      policy: table,
      action,
      decision: "deny",
      reasonCode: "PERMISSION_DENIED",
    });
    incrementAuthMetric("auth_403_total", {
      route: trace.route,
      category: "insufficient_permission",
    });
    return {
      ok: false,
      response: applyTraceHeaders(forbiddenResponse(role, table, action), trace),
    };
  }

  logAuthorizationDecision({
    route: trace.route,
    method: request.method,
    actorRole: role,
    policy: table,
    action,
    decision: "allow",
    reasonCode: "PERMISSION_ALLOWED",
  });
  incrementAuthMetric("auth_authz_allow_total", { route: trace.route, category: role });

  return { ok: true, ctx: { role, userId } };
}

export function forbiddenResponse(
  role: AppRole,
  table: CoreTable,
  action: TableAction,
): NextResponse<ApiErrorBody> {
  return createForbiddenResponse(
    `Role '${role}' is not permitted to perform '${action}' on '${table}'.`,
  );
}
