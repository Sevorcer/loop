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

export function mapRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown server error.";
  const lowerMessage = message.toLowerCase();

  if (message === "SUPABASE_NOT_CONFIGURED") {
    return createApiErrorResponse(
      "SERVICE_UNAVAILABLE",
      "Supabase is not configured for this environment.",
      503,
    );
  }

  if (
    message === "SUPABASE_SESSION_REQUIRED" ||
    message === "USER_PROFILE_NOT_FOUND" ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("authentication")
  ) {
    return createApiErrorResponse("UNAUTHORIZED", "A valid session is required.", 401);
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
