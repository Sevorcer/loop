import { buildAdminApiError, buildValidationError } from "@/lib/adminApiError";
import type { AdminApiError, AdminHttpStatus } from "@/lib/adminApiError";

interface AdminErrorResponse {
  status: AdminHttpStatus;
  error: AdminApiError;
}

const SUPPORTED_STATUSES: readonly AdminHttpStatus[] = [400, 401, 403, 404, 409, 500];

function normalizeStatus(status: number): AdminHttpStatus {
  if (SUPPORTED_STATUSES.includes(status as AdminHttpStatus)) {
    return status as AdminHttpStatus;
  }
  return 500;
}

function normalizeFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
): Record<string, string[]> {
  const normalized = Object.entries(fieldErrors).reduce<Record<string, string[]>>(
    (acc, [field, errors]) => {
      if (!errors || errors.length === 0) {
        return acc;
      }

      const messages = errors.filter((message) => Boolean(message));
      if (messages.length > 0) {
        acc[field] = messages;
      }
      return acc;
    },
    {},
  );

  return normalized;
}

export function organizationPermissionDenied(status: number): AdminErrorResponse {
  const normalizedStatus = normalizeStatus(status);

  if (normalizedStatus === 401) {
    return {
      status: 401,
      error: buildAdminApiError(401, "Authentication required."),
    };
  }

  return {
    status: 403,
    error: buildAdminApiError(403, "You do not have permission to perform this action."),
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
  const lowerMessage = message.toLowerCase();

  if (message === "SUPABASE_NOT_CONFIGURED") {
    return {
      status: 500,
      error: buildAdminApiError(500, "Supabase is not configured for this environment."),
    };
  }

  if (
    message === "SUPABASE_SESSION_REQUIRED" ||
    message === "USER_PROFILE_NOT_FOUND" ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("authentication")
  ) {
    return {
      status: 401,
      error: buildAdminApiError(401, "A valid session is required."),
    };
  }

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("denied")
  ) {
    return {
      status: 403,
      error: buildAdminApiError(403, "You do not have permission to perform this action."),
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
