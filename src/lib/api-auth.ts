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
import { rememberRequestAuth } from "@/lib/auth/requestAuth";
import {
  readTrustedAuthHeaders,
} from "@/lib/auth/trustedRequestAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAuthoritativeRole } from "@/features/auth/utils/appRole";
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
  /** Present when proxy already resolved org from user_profiles. */
  orgId?: string | null;
}

export type PermissionResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse<ApiErrorBody> };

type ResolvedAuth = { role: AppRole; userId: string; orgId?: string | null };
type ResolvedAuthResult =
  | { ok: true; auth: ResolvedAuth }
  | { ok: false; reason: UnauthorizedReason };

function lockedRoleFromAppMetadata(
  appMetadata: Record<string, unknown> | null | undefined,
): AppRole | null {
  const candidates: unknown[] = [appMetadata?.app_role, appMetadata?.role];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && isAppRole(candidate)) {
      return candidate;
    }
  }
  return null;
}

interface ProfileLookup {
  from(table: "user_profiles"): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{
          data: { app_role?: string | null; org_id?: string | null } | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
}

interface ProfileAuthFields {
  role: AppRole | null;
  orgId: string | null;
}

async function lookupProfileAuth(
  supabase: unknown,
  userId: string,
): Promise<ProfileAuthFields> {
  const lookup = supabase as ProfileLookup;
  if (typeof lookup?.from !== "function") return { role: null, orgId: null };
  try {
    const { data, error } = await lookup
      .from("user_profiles")
      .select("app_role,org_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) return { role: null, orgId: null };
    const role =
      typeof data?.app_role === "string" && isAppRole(data.app_role) ? data.app_role : null;
    const orgId = typeof data?.org_id === "string" && data.org_id ? data.org_id : null;
    return { role, orgId };
  } catch {
    return { role: null, orgId: null };
  }
}

type AuthUserShape = {
  id?: string;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * Prefer getClaims() (local JWT verify via JWKS when the project uses
 * asymmetric signing keys) over getUser() (always a network round trip to
 * Supabase Auth). Falls back to getUser when claims are unavailable.
 */
async function resolveIdentityUser(supabase: {
  auth: {
    getClaims?: () => PromiseLike<{
      data: { claims: { sub?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } } | null;
      error: { message?: string; name?: string; code?: string; status?: number } | null;
    }>;
    getUser: () => PromiseLike<{
      data: { user: AuthUserShape | null };
      error: { message?: string; name?: string; code?: string; status?: number } | null;
    }>;
  };
}): Promise<{
  data: { user: AuthUserShape | null };
  error: { message?: string; name?: string; code?: string; status?: number } | null;
}> {
  if (typeof supabase.auth.getClaims === "function") {
    try {
      const claimsResult = await supabase.auth.getClaims();
      const sub = claimsResult.data?.claims?.sub;
      if (sub) {
        return {
          data: {
            user: {
              id: sub,
              app_metadata: claimsResult.data?.claims?.app_metadata ?? {},
              user_metadata: claimsResult.data?.claims?.user_metadata ?? {},
            },
          },
          error: null,
        };
      }
      if (claimsResult.error) {
        // Fall through to getUser — symmetric keys / missing JWKS still work there.
      }
    } catch {
      // Fall through to getUser.
    }
  }
  return supabase.auth.getUser();
}

async function resolveRequestAuth(request: Request): Promise<ResolvedAuthResult> {
  let failureReason: UnauthorizedReason = "missing_token";

  try {
    const supabase = await createSupabaseServerClient();
    const resolved = await resolveAuthRefresh({
      getUser: async () => resolveIdentityUser(supabase),
      clearSession: async () => {
        await supabase.auth.signOut();
      },
    });

    const user = resolved.user;
    if (resolved.status === "authenticated" && user) {
      if (user.id) {
        // Trusted headers are only honored when they match the verified session
        // user. Spoofed x-loop-trusted-* values without a matching session are
        // ignored (proxy strips them; this is defense in depth for direct
        // handler calls in tests).
        const trusted = readTrustedAuthHeaders(request);
        if (trusted && trusted.userId === user.id && isAppRole(trusted.role)) {
          rememberRequestAuth({
            supabase,
            userId: user.id,
            orgId: trusted.orgId,
          });
          return {
            ok: true,
            auth: { role: trusted.role, userId: user.id, orgId: trusted.orgId },
          };
        }

        const profile = await lookupProfileAuth(supabase, user.id);
        const extractedRole = resolveAuthoritativeRole(
          profile.role,
          lockedRoleFromAppMetadata(user.app_metadata),
        );
        if (extractedRole) {
          rememberRequestAuth({
            supabase,
            userId: user.id,
            orgId: profile.orgId,
          });
          return {
            ok: true,
            auth: { role: extractedRole, userId: user.id, orgId: profile.orgId },
          };
        }

        if (process.env.NODE_ENV !== "production") {
          rememberRequestAuth({ supabase, userId: user.id, orgId: profile.orgId });
          return { ok: true, auth: { role: "owner", userId: user.id, orgId: profile.orgId } };
        }

        return { ok: false, reason: "missing_role" };
      }

      // Session user without an id (rare / test harness): locked metadata only.
      const metadataRole = resolveAuthoritativeRole(
        null,
        lockedRoleFromAppMetadata(user.app_metadata),
      );
      if (metadataRole) {
        return { ok: true, auth: { role: metadataRole, userId: "" } };
      }
      if (process.env.NODE_ENV !== "production") {
        return { ok: true, auth: { role: "owner", userId: "" } };
      }
      return { ok: false, reason: "missing_role" };
    }

    failureReason = classifyUnauthorizedRefreshReason(resolved.resolution, resolved.error);
  } catch {
    // Session probe failed — fall through to header fallback (non-prod only).
    failureReason = "invalid_token";
  }

  // Dev-only role header for Vitest / local harness. Never honored in
  // production. Spoofed x-loop-trusted-* headers are NOT accepted here —
  // they require a matching verified session above.
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

  const { role, userId, orgId } = auth.auth;

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

  return { ok: true, ctx: { role, userId, orgId } };
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
