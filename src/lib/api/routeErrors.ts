import { NextResponse } from "next/server";

import { getRepositoryErrorStatus } from "@/lib/repositories/http";
import type { RepositoryError } from "@/lib/repositories/contracts";

function canonicalErrorCode(status: number, fallback: string): string {
  switch (status) {
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 500:
      return "INTERNAL_SERVER_ERROR";
    default:
      return fallback;
  }
}

export function createApiErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: canonicalErrorCode(status, error),
      message,
      code: status,
    },
    { status },
  );
}

export function invalidJsonResponse() {
  return createApiErrorResponse("INVALID_PAYLOAD", "Request body must be valid JSON.", 400);
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  return (await request.json()) as Record<string, unknown>;
}

function extractErrorInfo(error: unknown): {
  message: string;
  code: string | null;
  status: number | null;
  details: unknown;
} {
  if (error && typeof error === "object") {
    const e = error as { message?: unknown; code?: unknown; status?: unknown; details?: unknown };
    return {
      message:
        typeof e.message === "string" && e.message.trim().length > 0
          ? e.message
          : "Unknown server error.",
      code: typeof e.code === "string" ? e.code : null,
      status: typeof e.status === "number" ? e.status : null,
      details: e.details ?? null,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unknown server error.",
    code: null,
    status: null,
    details: null,
  };
}

export function mapRouteError(error: unknown) {
  const { message, code, status, details } = extractErrorInfo(error);
  const lowerMessage = message.toLowerCase();

  if (message === "SUPABASE_NOT_CONFIGURED") {
    return createApiErrorResponse(
      "SERVICE_UNAVAILABLE",
      "Supabase is not configured for this environment.",
      503,
    );
  }

  // Only explicit auth/session sentinel failures should become 401.
  if (
    message === "SUPABASE_SESSION_REQUIRED" ||
    message === "USER_PROFILE_NOT_FOUND" ||
    code === "USER_PROFILE_NOT_FOUND"
  ) {
    console.error(
      "[AUTH_FLOW]",
      JSON.stringify({
        event: "mapRouteError.emit401",
        reason: code ?? message,
        statusCode: 401,
        details,
        stack: new Error("AUTH_FLOW_STACK").stack,
      }),
    );
    return createApiErrorResponse("UNAUTHORIZED", "A valid session is required.", 401);
  }

  // Honor explicit upstream status/code when present.
  if (status === 401 || code === "UNAUTHORIZED") {
    console.error(
      "[AUTH_FLOW]",
      JSON.stringify({
        event: "mapRouteError.emit401",
        reason: `upstream_status=${status ?? "none"} code=${code ?? "none"}`,
        statusCode: 401,
        stack: new Error("AUTH_FLOW_STACK").stack,
      }),
    );
    return createApiErrorResponse("UNAUTHORIZED", "A valid session is required.", 401);
  }

  if (status === 403 || code === "FORBIDDEN") {
    return createApiErrorResponse("FORBIDDEN", message, 403);
  }

  if (status === 404 || code === "NOT_FOUND") {
    return createApiErrorResponse("NOT_FOUND", message, 404);
  }

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("denied")
  ) {
    return createApiErrorResponse("FORBIDDEN", message, 403);
  }

  if (lowerMessage.includes("not found")) {
    return createApiErrorResponse("NOT_FOUND", message, 404);
  }

  if (lowerMessage.includes("required") || lowerMessage.includes("invalid")) {
    return createApiErrorResponse("VALIDATION_ERROR", message, 400);
  }

  return createApiErrorResponse("INTERNAL_SERVER_ERROR", message, 500);
}

export function mapRepositoryError(error: RepositoryError<string>) {
  const status = getRepositoryErrorStatus(error.code);
  return createApiErrorResponse(error.code, error.message, status);
}