import { createApiErrorResponse, invalidJsonResponse, mapRouteError } from "@/lib/api/routeErrors";

import { JobMaterialValidationError } from "./jobMaterials";

/** Parse a JSON object body; anything else (bad JSON, array, null) is a 400. */
export async function readMaterialBody(
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

export function materialErrorResponse(error: unknown) {
  if (error instanceof JobMaterialValidationError) {
    return createApiErrorResponse("VALIDATION_ERROR", error.message, 400);
  }
  return mapRouteError(error);
}

export function invalidIdResponse(label: string) {
  return createApiErrorResponse("VALIDATION_ERROR", `${label} must be a valid id.`, 400);
}

export function forbiddenResponse(message: string) {
  return createApiErrorResponse("FORBIDDEN", message, 403);
}
