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

// ---------- TEMP DIAGNOSTICS ----------
let authDiagSeq = 0;
function nextAuthDiagId() {
  authDiagSeq += 1;
  return `authdiag-${Date.now()}-${authDiagSeq}`;
}

function getRequestIdFromHeaders(request: Request): string | null {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id") ??
    request.headers.get("x-vercel-id") ??
    null
  );
}

function logAuthDiag(event: string, payload: Record<string, unknown>) {
  console.log("[AUTH_DIAG]", JSON.stringify({ event, ...payload }));
}

function captureStack(): string {
  return new Error("AUTH_DIAG_STACK").stack ?? "no-stack";
}

function getCookieDiagnostics(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return {
    hasCookieHeader: cookie.length > 0,
    hasSbAccessCookie:
      cookie.includes("sb-access-token") ||
      cookie.includes("sb:token") ||
      cookie.includes("sb-"),
    hasSbRefreshCookie:
      cookie.includes("sb-refresh-token") ||
      cookie.includes("refresh_token") ||
      cookie.includes("sb-"),
    xVercelId: request.headers.get("x-vercel-id"),
    userAgent: request.headers.get("user-agent"),
  };
}
// ---------- /TEMP DIAGNOSTICS ----------

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

function isMissingSessionError(err: SessionProbeResult["error"]) {
  const token = `${err?.name ?? ""}|${err?.code ?? ""}|${err?.message ?? ""}`.toLowerCase();
  return token.includes("authsessionmissingerror") || token.includes("session missing");
}

export async function resolveRequestRole(request: Request): Promise<AppRole | null> {
  const diagId = nextAuthDiagId();
  const reqId = getRequestIdFromHeaders(request);
  const url = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return request.url;
    }
  })();

  const cookieDiag = getCookieDiagnostics(request);

  logAuthDiag("resolveRequestRole.enter", {
    diagId,
    reqId,
    method: request.method,
    url,
    ...cookieDiag,
    stack: captureStack(),
  });

  try {
    let session = await probeSession();
    let retried = false;

    if (!session.user && isMissingSessionError(session.error)) {
      retried = true;
      logAuthDiag("resolveRequestRole.retry.missing_session", {
        diagId,
        reqId,
        errorMessage: session.error?.message ?? null,
        errorName: session.error?.name ?? null,
        errorCode: session.error?.code ?? null,
      });
      session = await probeSession();
    }

    const user = session.user;
    const error = session.error;
    const extractedRole = user ? extractRoleFromUser(user) : null;

    logAuthDiag("resolveRequestRole.getUser.result", {
      diagId,
      reqId,
      retried,
      userId: user?.id ?? null,
      extractedRole,
      errorMessage: error?.message ?? null,
      errorName: error?.name ?? null,
      errorCode: error?.code ?? null,
      errorStatus: error?.status ?? null,
      appMeta: user?.app_metadata ?? null,
      userMeta: user?.user_metadata ?? null,
    });

    if (!error && user) {
      if (extractedRole) {
        logAuthDiag("resolveRequestRole.return.role", {
          diagId,
          reqId,
          userId: user.id,
          role: extractedRole,
          reason: "metadata",
        });
        return extractedRole;
      }

      if (process.env.NODE_ENV !== "production") {
        logAuthDiag("resolveRequestRole.return.role", {
          diagId,
          reqId,
          userId: user.id,
          role: "owner",
          reason: "non-prod-fallback",
        });
        return "owner";
      }

      logAuthDiag("resolveRequestRole.return.null", {
        diagId,
        reqId,
        userId: user.id,
        reason: "user-without-valid-role",
      });
      return null;
    }
  } catch (err) {
    logAuthDiag("resolveRequestRole.exception", {
      diagId,
      reqId,
      errorMessage: err instanceof Error ? err.message : "unknown",
      stack: captureStack(),
    });
  }

  if (process.env.NODE_ENV !== "production") {
    const headerRole = request.headers.get("x-loop-role");
    if (headerRole && isAppRole(headerRole)) {
      logAuthDiag("resolveRequestRole.return.role", {
        diagId,
        reqId,
        userId: null,
        role: headerRole,
        reason: "x-loop-role-fallback",
      });
      return headerRole;
    }
  }

  logAuthDiag("resolveRequestRole.return.null", {
    diagId,
    reqId,
    userId: null,
    reason: "no-user-no-fallback",
  });

  return null;
}

export async function requirePermission(
  request: Request,
  table: CoreTable,
  action: TableAction,
): Promise<PermissionResult> {
  const diagId = nextAuthDiagId();
  const reqId = getRequestIdFromHeaders(request);
  const url = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return request.url;
    }
  })();

  logAuthDiag("requirePermission.enter", {
    diagId,
    reqId,
    method: request.method,
    url,
    table,
    action,
    stack: captureStack(),
  });

  const trace = getRequestTraceContext(request);
  const role = await resolveRequestRole(request);

  logAuthDiag("requirePermission.after.resolveRole", {
    diagId,
    reqId,
    resolvedRole: role,
    route: trace.route,
  });

  if (role === null) {
    const cookieDiag = getCookieDiagnostics(request);

    logAuthDiag("requirePermission.unauthorizedResponse", {
      diagId,
      reqId,
      route: trace.route,
      table,
      action,
      ...cookieDiag,
      result: "UNAUTHORIZED",
      stack: captureStack(),
    });

    logAuthEvent({
      event: "unauthorized_access_attempt",
      outcome: "deny",
      route: trace.route,
      statusCode: 401,
      requestId: trace.requestId,
      correlationId: trace.correlationId,
      errorCode: "MISSING_ROLE",
      details: { table, action, ...cookieDiag },
    });
    incrementAuthMetric("auth_401_total", { route: trace.route });

    const response = unauthorizedResponse("A valid session is required.");
    if (process.env.NODE_ENV !== "production") {
      response.headers.set("x-auth-debug-has-cookie", String(cookieDiag.hasCookieHeader));
      response.headers.set("x-auth-debug-node-env", process.env.NODE_ENV ?? "unknown");
    }

    return { ok: false, response: applyTraceHeaders(response, trace) };
  }

  if (!hasPermission(role, table, action)) {
    logAuthDiag("requirePermission.forbidden", {
      diagId,
      reqId,
      route: trace.route,
      table,
      action,
      role,
      result: "FORBIDDEN",
    });

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

  logAuthDiag("requirePermission.allow", {
    diagId,
    reqId,
    route: trace.route,
    table,
    action,
    role,
    result: "ALLOW",
  });

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