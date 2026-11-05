import { createApiErrorResponse, invalidJsonResponse, mapRouteError } from "@/lib/api/routeErrors";
import {
  DriveNotConfiguredError,
  DriveSyncError,
  ManualValidationError,
} from "@/features/manuals/utils/manualErrors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Parse a JSON object body; anything else (bad JSON, array, null) is a 400. */
export async function readManualBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return { ok: false, response: invalidJsonResponse() };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      response: createApiErrorResponse("INVALID_PAYLOAD", "Request body must be a JSON object.", 400),
    };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

export function manualErrorResponse(error: unknown) {
  if (error instanceof ManualValidationError) {
    return createApiErrorResponse("VALIDATION_ERROR", error.message, 400);
  }
  if (error instanceof DriveNotConfiguredError) {
    return createApiErrorResponse("DRIVE_NOT_CONFIGURED", error.message, 503);
  }
  if (error instanceof DriveSyncError) {
    // A Google-side 403/404 is a setup problem, not the caller's permission.
    return createApiErrorResponse("DRIVE_SYNC_FAILED", error.message, 502);
  }
  return mapRouteError(error);
}

export function forbiddenResponse(message: string) {
  return createApiErrorResponse("FORBIDDEN", message, 403);
}

export function invalidIdResponse(label: string) {
  return createApiErrorResponse("VALIDATION_ERROR", `${label} must be a valid id.`, 400);
}
