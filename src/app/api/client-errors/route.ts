/**
 * DIAGNOSTIC — Client-error sink.
 *
 * POST /api/client-errors
 *
 * Receives best-effort client-side error reports from `ClientErrorReporter`
 * (and from route-level error boundaries) and emits ONE structured
 * `[CLIENT_ERROR]` log line per report. This makes otherwise-invisible
 * client-side failures (e.g. the New Job navigation bug on mobile) visible in
 * Vercel runtime logs.
 *
 * Shape is modelled on `logWriteFailure` in `src/lib/observability/writes.ts`:
 *   [CLIENT_ERROR] {"category":"client_error","schema_version":"1.0",...}
 *
 * Contract:
 *   - Requires a valid session (same guard as other protected routes).
 *     `/api/*` is already session-protected by middleware; we re-check here.
 *   - Log-only: NEVER writes to any table.
 *   - Caps body size and truncates fields to avoid log floods / abuse.
 *   - Always returns 204 (even on malformed input) so the client reporter
 *     never retries or surfaces an error of its own.
 */

import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/apiGuard";

// Reject bodies larger than this (defensive — reports are tiny).
const MAX_BODY_BYTES = 16_384;
// Truncate individual string fields before logging.
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_STACK_LENGTH = 4_000;
const MAX_GENERIC_LENGTH = 512;

const NO_CONTENT = new NextResponse(null, { status: 204 });

function truncate(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractRequestId(request: Request): string | null {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id") ??
    null
  );
}

export async function POST(request: Request) {
  // Guard: must be an authenticated session. Fail closed.
  const sessionResult = await requireApiSession(request);
  if (sessionResult.error) return sessionResult.error;

  // Read and size-cap the raw body. Any failure degrades to a silent 204 so
  // the client reporter can never get stuck retrying.
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return NO_CONTENT;
  }

  if (raw.length > MAX_BODY_BYTES) {
    // Oversized — record that fact, but do not log the payload.
    try {
      console.error(
        "[CLIENT_ERROR]",
        JSON.stringify({
          category: "client_error",
          schema_version: "1.0",
          timestamp: new Date().toISOString(),
          request_id: extractRequestId(request),
          dropped: "oversized_body",
          body_bytes: raw.length,
        }),
      );
    } catch {
      // Logging must never throw.
    }
    return NO_CONTENT;
  }

  let parsed: Record<string, unknown> = {};
  try {
    const json = JSON.parse(raw) as unknown;
    if (json && typeof json === "object") {
      parsed = json as Record<string, unknown>;
    }
  } catch {
    // Malformed JSON — still emit a minimal line so the signal is not lost.
  }

  try {
    const payload = {
      category: "client_error",
      schema_version: "1.0",
      timestamp: new Date().toISOString(),
      request_id: extractRequestId(request),
      message: truncate(parsed.message, MAX_MESSAGE_LENGTH) ?? "Unknown client error",
      stack: truncate(parsed.stack, MAX_STACK_LENGTH),
      source: truncate(parsed.source, MAX_GENERIC_LENGTH),
      line: toFiniteNumber(parsed.line),
      col: toFiniteNumber(parsed.col),
      url: truncate(parsed.url, MAX_GENERIC_LENGTH),
      user_agent: truncate(parsed.userAgent, MAX_GENERIC_LENGTH),
      client_ts: truncate(parsed.ts, MAX_GENERIC_LENGTH),
    };

    console.error("[CLIENT_ERROR]", JSON.stringify(payload));
  } catch {
    // Logging must never throw and never block the response path.
  }

  return NO_CONTENT;
}
