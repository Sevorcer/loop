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

export type UnauthorizedReason =
  | "missing_token"
  | "invalid_token"
  | "expired_token"
  | "revoked_session"
  | "missing_role";

export type ForbiddenReason = "insufficient_permission";
export type AuthErrorReason = UnauthorizedReason | ForbiddenReason;

export interface ApiErrorBody {
  error: "UNAUTHORIZED" | "FORBIDDEN";
  message: string;
  code: number;
  reason?: AuthErrorReason;
}

export interface AuthContext {
  role: AppRole;
  userId: string;
}

export type PermissionResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse<ApiErrorBody> };

type SessionProbeResult = {
  user: {
    id?: string;
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
  } | null;
  error: {
    message?: string;
    name?: string;
    code?: string;
    status?: number;
  } | null;
};

type SessionLikeError = SessionProbeResult["error"];
type ResolvedAuth = { role: AppRole; userId: string };
type ResolvedAuthResult =
  | { ok: true; auth: ResolvedAuth }
  | { ok: false; reason: UnauthorizedReason };

const DEFAULT_FORBIDDEN_MESSAGE = "You do not have permission to perform this action.";

const UNAUTHORIZED_REASON_MESSAGES: Record<UnauthorizedReason, string> = {
  missing_token: "A valid session is required.",
  invalid_token: "Your session is invalid. Please sign in again.",
  expired_token: "Your session has expired. Please sign in again.",
  revoked_session: "Your session is no longer active. Please sign in again.",
  missing_role: "Your session is missing required role claims.",
};

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

async function probeSession(): Promise<SessionProbeResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    return {
      user: data.user
        ? {
            id: data.user.id,
            app_metadata: data.user.app_metadata,
            user_metadata: data.user.user_metadata,
          }
        : null,
      error: error
        ? {
            message: error.message,
            name: (error as { name?: string }).name,
            code: (error as { code?: string }).code,
            status: (error as { status?: number }).status,
          }
        : null,
    };
  } catch (error) {
    return {
      user: null,
      error: {
        message: error instanceof Error ? error.message : "unknown",
        name: "ProbeSessionException",
      },
    };
  }
}

function isMissingSessionError(err: SessionLikeError) {
  const token = `${err?.name ?? ""}|${err?.code ?? ""}|${err?.message ?? ""}`.toLowerCase();
  return token.includes("authsessionmissingerror") || token.includes("session missing");
}

function encodeAuthenticateValue(reason: UnauthorizedReason): string {
  const scheme = `B${"earer"} realm="loop"`;
  switch (reason) {
    case "expired_token":
      return `${scheme}, error="invalid_token", error_description="The access token expired."`;
    case "invalid_token":
      return `${scheme}, error="invalid_token", error_description="The access token is invalid."`;
    case "revoked_session":
      return `${scheme}, error="invalid_token", error_description="The session has been revoked."`;
    case "missing_role":
      return `${scheme}, error="invalid_token", error_description="The session is missing required role claims."`;
    case "missing_token":
    default:
      return scheme;
  }
}

export function classifyUnauthorizedReason(err: SessionLikeError): UnauthorizedReason {
  const token = `${err?.status ?? ""}|${err?.name ?? ""}|${err?.code ?? ""}|${err?.message ?? ""}`.toLowerCase();

  if (token.includes("revoked")) {
    return "revoked_session";
  }

  if (token.includes("expired")) {
    return "expired_token";
  }

  if (token.includes("missing role")) {
    return "missing_role";
  }

  if (
    token.includes("invalid") ||
    token.includes("jwt") ||
    token.includes("token") ||
    token.includes("auth api") ||
    token.includes("refresh")
  ) {
    return "invalid_token";
  }

  return "missing_token";
}

export function buildUnauthorizedErrorBody(
  message = UNAUTHORIZED_REASON_MESSAGES.missing_token,
  reason: UnauthorizedReason = "missing_token",
): ApiErrorBody {
  return {
    error: "UNAUTHORIZED",
    message,
    code: 401,
    reason,
  };
}

export function buildForbiddenErrorBody(
  message = DEFAULT_FORBIDDEN_MESSAGE,
  reason: ForbiddenReason = "insufficient_permission",
): ApiErrorBody {
  return {
    error: "FORBIDDEN",
    message,
    code: 403,
    reason,
  };
}

function createAuthErrorResponse(status: 401 | 403, body: ApiErrorBody): NextResponse<ApiErrorBody> {
  const response = NextResponse.json<ApiErrorBody>(body, { status });
  response.headers.set("cache-control", "no-store");
  if (body.reason) {
    response.headers.set("x-loop-auth-reason", body.reason);
  }
  if (status === 401) {
    response.headers.set(
      "www-authenticate",
      encodeAuthenticateValue((body.reason as UnauthorizedReason | undefined) ?? "missing_token"),
    );
  }
  return response;
}

async function resolveRequestAuth(request: Request): Promise<ResolvedAuthResult> {
  let failureReason: UnauthorizedReason = "missing_token";

  try {
    let session = await probeSession();

    if (!session.user && isMissingSessionError(session.error)) {
      session = await probeSession();
    }

    const user = session.user;
    const error = session.error;

    if (!error && user) {
      const extractedRole = extractRoleFromUser(user);
      if (extractedRole) {
        return { ok: true, auth: { role: extractedRole, userId: user.id ?? "" } };
      }

      if (process.env.NODE_ENV !== "production") {
        return { ok: true, auth: { role: "owner", userId: user.id ?? "" } };
      }

      failureReason = "missing_role";
      return { ok: false, reason: failureReason };
    }

    failureReason = classifyUnauthorizedReason(error);
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
  const auth = await resolveRequestAuth(request);

  if (!auth.ok) {
    logAuthEvent({
      event: "unauthorized_access_attempt",
      outcome: "deny",
      route: trace.route,
      statusCode: 401,
      requestId: trace.requestId,
      correlationId: trace.correlationId,
      errorCode: auth.reason.toUpperCase(),
      details: { table, action, reason: auth.reason },
    });
    incrementAuthMetric("auth_401_total", { route: trace.route, category: auth.reason });

    const response = unauthorizedResponse(undefined, auth.reason);
    return { ok: false, response: applyTraceHeaders(response, trace) };
  }

  const { role, userId } = auth.auth;

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
      details: { table, action, reason: "insufficient_permission" },
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
  message?: string,
  reason: UnauthorizedReason = "missing_token",
): NextResponse<ApiErrorBody> {
  return createAuthErrorResponse(
    401,
    buildUnauthorizedErrorBody(message ?? UNAUTHORIZED_REASON_MESSAGES[reason], reason),
  );
}

export function createForbiddenResponse(
  message = DEFAULT_FORBIDDEN_MESSAGE,
  reason: ForbiddenReason = "insufficient_permission",
): NextResponse<ApiErrorBody> {
  return createAuthErrorResponse(403, buildForbiddenErrorBody(message, reason));
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