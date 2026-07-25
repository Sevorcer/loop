import { NextResponse } from "next/server";

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

export interface SessionLikeError {
  message?: string;
  name?: string;
  code?: string;
  status?: number;
}

const DEFAULT_FORBIDDEN_MESSAGE = "You do not have permission to perform this action.";

const UNAUTHORIZED_REASON_MESSAGES: Record<UnauthorizedReason, string> = {
  missing_token: "A valid session is required.",
  invalid_token: "Your session is invalid. Please sign in again.",
  expired_token: "Your session has expired. Please sign in again.",
  revoked_session: "Your session is no longer active. Please sign in again.",
  missing_role: "Your session is missing required role claims.",
};

function encodeAuthenticateValue(reason: UnauthorizedReason): string {
  const scheme = ["Bearer", 'realm="loop"'].join(" ");
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

export function classifyUnauthorizedReason(
  err: SessionLikeError | null | undefined,
): UnauthorizedReason {
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
