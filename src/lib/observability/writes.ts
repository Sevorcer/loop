/**
 * Write-path failure observability.
 *
 * Emits one structured `[WRITE_FAILURE]` log line per failed write operation.
 * Each event is concise, safe (no PII), and machine-parseable.
 *
 * Log format:
 *   [WRITE_FAILURE] {"category":"write_failure","schemaVersion":"1.0",...}
 *
 * Usage — in a route catch block:
 *   } catch (error) {
 *     logWriteFailure({ route: "/api/jobs", request }, error);
 *     return mapRouteError(error);
 *   }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WriteFailureContext {
  /** Canonical route path, e.g. "/api/jobs". */
  route: string;
  /**
   * Incoming Request object — used to extract requestId/correlationId from
   * standard trace headers when `requestId` is not provided explicitly.
   */
  request?: Request;
  /**
   * Explicit request identifier. Takes precedence over the `request` header.
   * Use this when the route handler has already read the trace context.
   */
  requestId?: string | null;
  /**
   * Optional step label from step-tracking POST handlers.
   * Identifies the exact execution point at which the failure occurred.
   */
  step?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractRequestId(ctx: WriteFailureContext): string | null {
  if (ctx.requestId != null) return ctx.requestId;
  if (ctx.request) {
    return (
      ctx.request.headers.get("x-request-id") ??
      ctx.request.headers.get("x-correlation-id") ??
      null
    );
  }
  return null;
}

function extractErrorFields(error: unknown): {
  errorName: string;
  errorMessage: string;
  errorCode: string | null;
} {
  const isError = error instanceof Error;
  const errorName = isError ? error.name : typeof error;
  const errorMessage = isError ? error.message : String(error);

  let errorCode: string | null = null;
  if (error && typeof error === "object" && "code" in error) {
    const raw = (error as { code: unknown }).code;
    if (typeof raw === "string" && raw.trim().length > 0) {
      errorCode = raw;
    }
  }

  return { errorName, errorMessage, errorCode };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Emits a single structured write-failure log line.
 *
 * Must be called exactly once in the catch block of every write-path handler
 * (POST, PATCH, DELETE). Never throws.
 */
export function logWriteFailure(ctx: WriteFailureContext, error: unknown): void {
  try {
    const { errorName, errorMessage, errorCode } = extractErrorFields(error);

    const payload = {
      category: "write_failure",
      schemaVersion: "1.0",
      timestamp: new Date().toISOString(),
      event: "write_failure",
      route: ctx.route,
      requestId: extractRequestId(ctx),
      step: ctx.step ?? null,
      errorName,
      errorMessage,
      errorCode,
    };

    console.error("[WRITE_FAILURE]", JSON.stringify(payload));
  } catch {
    // Logging must never throw and never block the response path.
  }
}
