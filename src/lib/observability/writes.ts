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
 *     logWriteFailure({ route: "/api/jobs", request, operation: "create_job" }, error);
 *     return mapRouteError(error);
 *   }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WriteFailureContext {
  /** Canonical route path, e.g. "/api/jobs". */
  route: string;
  /** Stable operation name, e.g. "create_job". Falls back to a route+method label. */
  operation?: string;
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

function extractOperation(ctx: WriteFailureContext): string {
  if (ctx.operation && ctx.operation.trim().length > 0) {
    return ctx.operation;
  }

  const method = ctx.request?.method?.trim().toLowerCase() ?? "write";
  const segments = ctx.route.split("/").filter(Boolean);
  const resource =
    segments[0] === "api" && segments[1]
      ? segments[1]
      : segments.find((segment) => !segment.startsWith("["));
  const normalizedResource = resource?.replace(/[^a-z0-9]+/gi, "_").toLowerCase();

  return normalizedResource ? `${method}_${normalizedResource}` : method;
}

function extractErrorFields(error: unknown): {
  sanitizedMessage: string;
  errorCode: string | null;
  stack: string | null;
} {
  const isError = error instanceof Error;
  const errorMessage = isError ? error.message : String(error);

  let errorCode: string | null = null;
  if (error && typeof error === "object" && "code" in error) {
    const raw = (error as { code: unknown }).code;
    if (typeof raw === "string" && raw.trim().length > 0) {
      errorCode = raw;
    }
  }

  return {
    sanitizedMessage: sanitizeLogText(errorMessage),
    errorCode,
    stack:
      process.env.NODE_ENV === "production" || !isError || typeof error.stack !== "string"
        ? null
        : sanitizeLogText(error.stack),
  };
}

const SECRET_KEY_PATTERN =
  /\b(authorization|cookie|set-cookie|token|secret|api[_ -]?key|password)\b\s*([:=])\s*/gi;

function findSecretValueEnd(text: string, startIndex: number): number {
  const quote = text[startIndex];

  if (quote === '"' || quote === "'") {
    let index = startIndex + 1;
    while (index < text.length) {
      if (text[index] === quote && text[index - 1] !== "\\") {
        return index + 1;
      }
      index += 1;
    }
    return text.length;
  }

  let index = startIndex;
  while (index < text.length && !/[,\s;]/.test(text[index])) {
    index += 1;
  }
  return index;
}

function redactKeyValueSecrets(value: string): string {
  let sanitized = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  SECRET_KEY_PATTERN.lastIndex = 0;

  while ((match = SECRET_KEY_PATTERN.exec(value)) !== null) {
    const [fullMatch, key, separator] = match;
    const valueStart = match.index + fullMatch.length;
    const valueEnd = findSecretValueEnd(value, valueStart);

    sanitized += value.slice(cursor, match.index);
    sanitized += `${key}${separator}[REDACTED]`;

    cursor = valueEnd;
    SECRET_KEY_PATTERN.lastIndex = valueEnd;
  }

  return sanitized + value.slice(cursor);
}

function sanitizeLogText(value: string): string {
  return redactKeyValueSecrets(
    value
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, "[REDACTED_BEARER_TOKEN]")
    .replace(/\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_JWT]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]"),
  );
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
    const { sanitizedMessage, errorCode, stack } = extractErrorFields(error);

    const payload = {
      category: "write_failure",
      schema_version: "1.0",
      timestamp: new Date().toISOString(),
      request_id: extractRequestId(ctx),
      route: ctx.route,
      operation: extractOperation(ctx),
      error_code: errorCode,
      sanitized_message: sanitizedMessage,
      ...(stack ? { stack } : {}),
    };

    console.error("[WRITE_FAILURE]", JSON.stringify(payload));
  } catch {
    // Logging must never throw and never block the response path.
  }
}
