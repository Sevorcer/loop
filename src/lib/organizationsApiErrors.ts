import { buildAdminApiError, buildValidationError } from "@/lib/adminApiError";
import type { AdminApiError, AdminHttpStatus } from "@/lib/adminApiError";

interface AdminErrorResponse {
  status: AdminHttpStatus;
  error: AdminApiError;
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
    console.error(
      "[AUTH_FLOW]",
      JSON.stringify({
        event: "organizationPermissionDenied.emit401",
        reason: "authentication_required",
        statusCode: 401,
        stack: new Error("AUTH_FLOW_STACK").stack,
      }),
    );
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

  if (message === "SUPABASE_NOT_CONFIGURED") {
    return {
      status: 500,
      error: buildAdminApiError(500, "Supabase is not configured for this environment."),
    };
  }

  if (
    message === "SUPABASE_SESSION_REQUIRED" ||
    message === "USER_PROFILE_NOT_FOUND" ||
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("authentication")
  ) {
    console.error(
      "[AUTH_FLOW]",
      JSON.stringify({
        event: "mapOrganizationRouteError.emit401",
        reason: message,
        statusCode: 401,
        stack: new Error("AUTH_FLOW_STACK").stack,
      }),
    );
    return {
      status: 401,
      error: buildAdminApiError(401, "A valid session is required."),
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
