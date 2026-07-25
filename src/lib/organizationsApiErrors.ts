import { buildAdminApiError, buildValidationError } from "@/lib/adminApiError";
import type { AdminApiError, AdminHttpStatus } from "@/lib/adminApiError";
import {
  buildForbiddenErrorBody,
  buildUnauthorizedErrorBody,
  classifyUnauthorizedReason,
  type ApiErrorBody,
} from "@/lib/auth/errorContract";

interface AdminErrorResponse {
  status: AdminHttpStatus;
  error: AdminApiError | ApiErrorBody;
}

export function normalizeFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
): Record<string, string[]> {
  return Object.entries(fieldErrors).reduce<Record<string, string[]>>(
    (acc, [field, errors]) => {
      const messages = (errors ?? []).filter(Boolean);
      if (messages.length > 0) {
        acc[field] = messages;
      }
      return acc;
    },
    {},
  );
}

export function organizationPermissionDenied(status: number): AdminErrorResponse {
  if (status === 401) {
    return {
      status: 401,
      error: buildUnauthorizedErrorBody("Authentication required."),
    };
  }

  return {
    status: 403,
    error: buildForbiddenErrorBody(),
  };
}

export function organizationValidationFailed(
  fieldErrors: Record<string, string[] | undefined>,
): AdminErrorResponse {
  return {
    status: 400,
    error: buildValidationError(normalizeFieldErrors(fieldErrors)),
  };
}

export function organizationNotFound(id: string): AdminErrorResponse {
  return {
    status: 404,
    error: buildAdminApiError(404, `Organization '${id}' not found.`),
  };
}

export function mapOrganizationRouteError(error: unknown): AdminErrorResponse {
  const message = error instanceof Error ? error.message : "Unknown server error.";
  const errorObject = error && typeof error === "object" ? (error as { code?: unknown; details?: unknown }) : null;
  const code =
    errorObject && typeof errorObject.code === "string" ? errorObject.code : null;

  if (message === "SUPABASE_NOT_CONFIGURED") {
    return {
      status: 500,
      error: buildAdminApiError(500, "Supabase is not configured for this environment."),
    };
  }

  if (
    message === "SUPABASE_SESSION_REQUIRED" ||
    message === "USER_PROFILE_NOT_FOUND" ||
    code === "USER_PROFILE_NOT_FOUND" ||
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("authentication")
  ) {
    return {
      status: 401,
      error: buildUnauthorizedErrorBody(
        undefined,
        classifyUnauthorizedReason({ message, code: code ?? undefined, status: 401 }),
      ),
    };
  }

  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("denied")
  ) {
    return {
      status: 403,
      error: buildForbiddenErrorBody(),
    };
  }

  if (
    lowerMessage.includes("duplicate") ||
    lowerMessage.includes("already exists") ||
    lowerMessage.includes("conflict")
  ) {
    return {
      status: 409,
      error: buildAdminApiError(409, "Organization conflict detected."),
    };
  }

  if (lowerMessage.includes("not found")) {
    return {
      status: 404,
      error: buildAdminApiError(404, message),
    };
  }

  if (lowerMessage.includes("required") || lowerMessage.includes("invalid")) {
    return {
      status: 400,
      error: buildAdminApiError(400, message),
    };
  }

  return {
    status: 500,
    error: buildAdminApiError(500, "An unexpected error occurred. Please try again."),
  };
}
