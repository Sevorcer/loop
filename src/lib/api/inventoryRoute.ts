import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";

/**
 * Route error mapper for the inventory APIs. `mapRouteError` only turns a
 * message into a 400 when it happens to contain "required"/"invalid"; inventory
 * services throw explicit `status: 400` validation errors, so honour that here
 * and defer everything else to the shared mapper.
 */
export function mapInventoryError(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 400) {
    const message = error instanceof Error && error.message ? error.message : "Invalid request.";
    return createApiErrorResponse("VALIDATION_ERROR", message, 400);
  }
  return mapRouteError(error);
}

export function validationError(message: string) {
  return createApiErrorResponse("VALIDATION_ERROR", message, 400);
}

/** Reads a positive integer query param, or undefined when absent/invalid. */
export function queryInt(url: URL, key: string): number | undefined {
  const raw = url.searchParams.get(key);
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function queryFlag(url: URL, key: string): boolean {
  const raw = url.searchParams.get(key);
  return raw === "1" || raw === "true";
}
