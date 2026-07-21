/**
 * Admin API error contract — Sprint 29.
 *
 * Provides a standard error shape for all Admin area API responses and a
 * helper that maps HTTP status codes to canonical error codes.
 *
 * Error shape:
 *   {
 *     code:        string                          — machine-readable error code
 *     message:     string                          — human-readable description
 *     fieldErrors?: Record<string, string[]>       — per-field validation errors
 *     requestId?:  string                          — trace ID for support
 *   }
 *
 * HTTP → code mapping:
 *   400 → "validation_failure"
 *   401 → "unauthenticated"
 *   403 → "forbidden"
 *   404 → "not_found"
 *   409 → "conflict"
 *   500 → "internal_error"
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All recognized admin API error codes. */
export type AdminErrorCode =
  | "validation_failure"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal_error";

/** Standard error body returned from all admin API routes. */
export interface AdminApiError {
  /** Machine-readable error code. */
  code: AdminErrorCode;
  /** Human-readable error description. */
  message: string;
  /**
   * Per-field validation errors. Present only on validation_failure responses.
   * Keys are field names; values are arrays of error messages for that field.
   */
  fieldErrors?: Record<string, string[]>;
  /** Trace/correlation ID for support and log correlation. Optional. */
  requestId?: string;
}

/** HTTP status codes recognized by the admin error mapper. */
export type AdminHttpStatus = 400 | 401 | 403 | 404 | 409 | 500;

// ---------------------------------------------------------------------------
// HTTP status → error code mapping
// ---------------------------------------------------------------------------

const STATUS_TO_CODE: Readonly<Record<AdminHttpStatus, AdminErrorCode>> = {
  400: "validation_failure",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  500: "internal_error",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Maps an HTTP status code to the canonical admin API error code.
 *
 * Returns `"internal_error"` for any unrecognized status code so callers
 * always receive a valid AdminErrorCode.
 */
export function mapHttpStatusToErrorCode(status: number): AdminErrorCode {
  if (status in STATUS_TO_CODE) {
    return STATUS_TO_CODE[status as AdminHttpStatus];
  }
  return "internal_error";
}

/**
 * Builds a standard AdminApiError object.
 *
 * @param status      — HTTP status code (determines the error code).
 * @param message     — Human-readable description for the error.
 * @param options     — Optional fieldErrors and requestId.
 */
export function buildAdminApiError(
  status: number,
  message: string,
  options?: { fieldErrors?: Record<string, string[]>; requestId?: string }
): AdminApiError {
  const error: AdminApiError = {
    code: mapHttpStatusToErrorCode(status),
    message,
  };
  if (options?.fieldErrors && Object.keys(options.fieldErrors).length > 0) {
    error.fieldErrors = options.fieldErrors;
  }
  if (options?.requestId) {
    error.requestId = options.requestId;
  }
  return error;
}

/**
 * Builds a 400 validation_failure error, typically from a Zod parse result.
 *
 * Accepts a `fieldErrors` map where keys are field paths and values are
 * arrays of error messages — matching Zod's `ZodError.flatten().fieldErrors`.
 *
 * @param fieldErrors — Per-field error messages.
 * @param requestId   — Optional trace ID.
 */
export function buildValidationError(
  fieldErrors: Record<string, string[]>,
  requestId?: string
): AdminApiError {
  return buildAdminApiError(
    400,
    "One or more fields failed validation.",
    { fieldErrors, requestId }
  );
}

/**
 * Builds a 403 forbidden error for RBAC denials.
 *
 * @param requestId — Optional trace ID.
 */
export function buildForbiddenError(requestId?: string): AdminApiError {
  return buildAdminApiError(403, "You do not have permission to perform this action.", {
    requestId,
  });
}

/**
 * Builds a 404 not_found error.
 *
 * @param resource  — Human-readable name of the missing resource (e.g. "Customer").
 * @param requestId — Optional trace ID.
 */
export function buildNotFoundError(resource: string, requestId?: string): AdminApiError {
  return buildAdminApiError(404, `${resource} not found.`, { requestId });
}

/**
 * Builds a 500 internal_error.
 *
 * @param requestId — Optional trace ID.
 */
export function buildInternalError(requestId?: string): AdminApiError {
  return buildAdminApiError(500, "An unexpected error occurred. Please try again.", {
    requestId,
  });
}
