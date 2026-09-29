const SENSITIVE_KEY_PATTERN =
  /(token|password|secret|authorization|cookie|session|email|phone|ssn|address)/i;

export type AuthRefreshOutcome =
  | "success"
  | "expired"
  | "revoked"
  | "replay_denied"
  | "concurrency_conflict"
  | "malformed"
  | "missing"
  | "unknown_failure";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type AuthLifecycleEvent =
  | "sign_in_success"
  | "sign_in_failure"
  | "sign_out"
  | "session_refresh_success"
  | "session_refresh_failure"
  | "authz_decision_allow"
  | "authz_decision_deny"
  | "unauthorized_access_attempt"
  | "password_update_success"
  | "password_update_failure"
  | "password_update_invalid_link";

export type AuthMetricName =
  // Authorization
  | "auth_401_total"
  | "auth_403_total"
  | "auth_authz_allow_total"
  // Login
  | "auth_login_success_total"
  | "auth_sign_in_failure_total"
  // Refresh — aggregate
  | "auth_session_refresh_failure_total"
  // Refresh — resolution breakdown
  | "auth_refresh_success_total"
  | "auth_refresh_expired_total"
  | "auth_refresh_revoked_total"
  | "auth_refresh_replay_denied_total"
  | "auth_refresh_concurrency_conflict_total"
  | "auth_refresh_malformed_total"
  // Session lifecycle
  | "auth_session_created_total"
  | "auth_session_refreshed_total"
  | "auth_session_rotated_total"
  | "auth_session_revoked_total"
  | "auth_session_expired_total"
  // Password update
  | "auth_password_update_success_total"
  | "auth_password_update_failure_total";

export interface AuthLogEvent {
  event: AuthLifecycleEvent;
  outcome: "success" | "failure" | "deny";
  route?: string;
  statusCode?: number;
  requestId?: string;
  correlationId?: string;
  userId?: string;
  role?: string;
  details?: Record<string, unknown>;
  errorCode?: string;
  refreshOutcome?: AuthRefreshOutcome;
  refreshAttempts?: number;
}

export interface RequestTraceContext {
  route: string;
  requestId: string;
  correlationId: string;
}

export interface AuthorizationDecisionLog {
  route: string;
  method?: string;
  org?: string | null;
  actorRole?: string | null;
  policy: string;
  action: string;
  decision: "allow" | "deny";
  reasonCode: string;
}

interface MetricSample {
  timestamp: number;
  count: number;
}

// Latency tracking — lightweight reservoir for p50/p95/p99 reporting.
// Samples are capped to a rolling window to bound memory usage.
const LATENCY_RESERVOIR_MAX = 1000;
const LATENCY_WINDOW_MS = 5 * 60 * 1000;

interface LatencySample {
  timestamp: number;
  durationMs: number;
}

export type AuthLatencyLabel = "session_refresh" | "api_guard" | "permission_check";

const latencySamples = new Map<AuthLatencyLabel, LatencySample[]>();

export interface AuthLatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

function normalizeMetricCategory(category?: string): string {
  if (!category) return "unspecified";
  return category.trim() || "unspecified";
}

interface AlertThreshold {
  metric: AuthMetricName;
  threshold: number;
  windowMs: number;
}

const metricSamples = new Map<string, MetricSample[]>();
const lastAlertTimestamps = new Map<string, number>();

const ALERT_THRESHOLDS: readonly AlertThreshold[] = [
  { metric: "auth_401_total", threshold: 25, windowMs: 5 * 60 * 1000 },
  { metric: "auth_403_total", threshold: 25, windowMs: 5 * 60 * 1000 },
  { metric: "auth_sign_in_failure_total", threshold: 10, windowMs: 10 * 60 * 1000 },
  { metric: "auth_session_refresh_failure_total", threshold: 10, windowMs: 10 * 60 * 1000 },
  // Refresh failure spike — any single refresh failure category
  { metric: "auth_refresh_expired_total", threshold: 20, windowMs: 5 * 60 * 1000 },
  { metric: "auth_refresh_revoked_total", threshold: 10, windowMs: 5 * 60 * 1000 },
  { metric: "auth_refresh_replay_denied_total", threshold: 5, windowMs: 5 * 60 * 1000 },
  { metric: "auth_refresh_concurrency_conflict_total", threshold: 15, windowMs: 5 * 60 * 1000 },
];

function normalizeRoute(rawRoute?: string): string {
  if (!rawRoute) return "unknown";
  return rawRoute.trim() || "unknown";
}

function createFallbackId(): string {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `req_${token}`;
  }

  // Last-resort deterministic fallback for runtimes without Web Crypto.
  return `req_${Date.now().toString(36)}_${performance.now().toString(36).replace(".", "")}`;
}

function normalizeMethod(method?: string): string {
  if (!method) return "UNKNOWN";
  const normalized = method.trim().toUpperCase();
  return normalized.length > 0 ? normalized : "UNKNOWN";
}

export function createCorrelationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return createFallbackId();
}

export function getRequestTraceContext(request: Request): RequestTraceContext {
  const requestId =
    request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id") ??
    createCorrelationId();
  const correlationId = request.headers.get("x-correlation-id") ?? requestId;

  let route = "unknown";
  try {
    route = normalizeRoute(new URL(request.url).pathname);
  } catch {
    route = normalizeRoute(request.url);
  }

  return {
    route,
    requestId,
    correlationId,
  };
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function redactSensitiveValue(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }
  if (typeof value === "object") {
    const redacted: Record<string, JsonValue> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        redacted[key] = "[REDACTED]";
      } else {
        redacted[key] = redactSensitiveValue(nestedValue);
      }
    }
    return redacted;
  }

  return String(value);
}

export function logAuthEvent(event: AuthLogEvent): void {
  const payload = {
    category: "auth_observability",
    schemaVersion: "1.0",
    timestamp: new Date().toISOString(),
    event: event.event,
    outcome: event.outcome,
    route: normalizeRoute(event.route),
    statusCode: event.statusCode ?? null,
    requestId: event.requestId ?? null,
    correlationId: event.correlationId ?? event.requestId ?? null,
    userId: event.userId ?? null,
    role: event.role ?? null,
    errorCode: event.errorCode ?? null,
    refreshOutcome: event.refreshOutcome ?? null,
    refreshAttempts: event.refreshAttempts ?? null,
    details: redactSensitiveValue(event.details ?? {}),
  };

  console.info("[AUTH_EVENT]", JSON.stringify(payload));
}

export function logAuthorizationDecision(event: AuthorizationDecisionLog): void {
  const payload = {
    category: "authz_decision",
    schema_version: "1.0",
    timestamp: new Date().toISOString(),
    route: normalizeRoute(event.route),
    method: normalizeMethod(event.method),
    org: event.org ?? null,
    actor_role: event.actorRole ?? null,
    policy: event.policy,
    action: event.action,
    decision: event.decision,
    reason_code: event.reasonCode,
  };

  console.info("[AUTHZ_DECISION]", JSON.stringify(payload));
}

function getMetricBucketKey(metric: AuthMetricName, route: string, category: string): string {
  return `${metric}::${route}::${category}`;
}

function getThreshold(metric: AuthMetricName): AlertThreshold | undefined {
  return ALERT_THRESHOLDS.find((threshold) => threshold.metric === metric);
}

function getWindowCount(samples: MetricSample[], windowStart: number): number {
  let count = 0;
  for (const sample of samples) {
    if (sample.timestamp >= windowStart) {
      count += sample.count;
    }
  }
  return count;
}

export function incrementAuthMetric(
  metric: AuthMetricName,
  options: { route?: string; category?: string; count?: number; now?: number } = {},
): void {
  const route = normalizeRoute(options.route);
  const category = normalizeMetricCategory(options.category);
  const count = options.count ?? 1;
  const now = options.now ?? Date.now();
  const key = getMetricBucketKey(metric, route, category);
  const samples = metricSamples.get(key) ?? [];
  samples.push({ timestamp: now, count });
  metricSamples.set(key, samples);

  const threshold = getThreshold(metric);
  if (!threshold) return;

  const windowStart = now - threshold.windowMs;
  const inWindow = samples.filter((sample) => sample.timestamp >= windowStart);
  metricSamples.set(key, inWindow);
  const windowCount = getWindowCount(inWindow, windowStart);

  if (windowCount < threshold.threshold) return;

  const lastAlertAt = lastAlertTimestamps.get(key) ?? 0;
  if (now - lastAlertAt < threshold.windowMs) return;

  lastAlertTimestamps.set(key, now);
  console.warn(
    "[AUTH_ALERT]",
    JSON.stringify({
      category: "auth_observability",
      schemaVersion: "1.0",
      timestamp: new Date(now).toISOString(),
      metric,
      route,
      authCategory: category,
      count: windowCount,
      threshold: threshold.threshold,
      windowMs: threshold.windowMs,
      severity: "warning",
    }),
  );
}

export function applyTraceHeaders<T extends Response>(
  response: T,
  trace: Pick<RequestTraceContext, "requestId" | "correlationId">,
): T {
  response.headers.set("x-request-id", trace.requestId);
  response.headers.set("x-correlation-id", trace.correlationId);
  return response;
}

// ---------------------------------------------------------------------------
// Latency tracking
// ---------------------------------------------------------------------------

/**
 * Returns the current high-resolution timestamp in milliseconds.
 * Used as the start of an auth operation timer.
 */
export function startAuthTimer(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Records the duration of an auth operation for latency percentile tracking.
 * Samples are kept in a rolling window (LATENCY_WINDOW_MS) capped at
 * LATENCY_RESERVOIR_MAX entries to bound memory usage.
 *
 * Both `startedAt` and the end measurement use the same clock source
 * (`performance.now` when available, `Date.now` otherwise) to ensure
 * duration calculations are consistent.
 */
export function recordAuthDuration(label: AuthLatencyLabel, startedAt: number, now?: number): void {
  // Use the same clock source that startAuthTimer() used so that
  // (endedAt - startedAt) produces a valid elapsed duration.
  const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const durationMs = Math.max(0, endedAt - startedAt);
  const wallTime = now ?? Date.now();

  const existing = latencySamples.get(label) ?? [];
  const cutoff = wallTime - LATENCY_WINDOW_MS;
  const trimmed = existing.filter((s) => s.timestamp >= cutoff);
  trimmed.push({ timestamp: wallTime, durationMs });

  if (trimmed.length > LATENCY_RESERVOIR_MAX) {
    trimmed.splice(0, trimmed.length - LATENCY_RESERVOIR_MAX);
  }

  latencySamples.set(label, trimmed);

  // Emit a latency alert when p99 exceeds 2 seconds (regression threshold).
  if (trimmed.length >= 20) {
    const sorted = trimmed.map((s) => s.durationMs).sort((a, b) => a - b);
    const p99Index = Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1);
    const p99 = sorted[p99Index] ?? 0;
    if (p99 > 2000) {
      console.warn(
        "[AUTH_ALERT]",
        JSON.stringify({
          category: "auth_observability",
          schemaVersion: "1.0",
          timestamp: new Date(wallTime).toISOString(),
          metric: "auth_latency_ms",
          label,
          p99,
          sampleCount: trimmed.length,
          threshold: 2000,
          severity: "warning",
        }),
      );
    }
  }
}

/**
 * Returns p50/p95/p99 latency percentiles from the rolling sample window.
 * Returns zeros when fewer than 2 samples are available.
 *
 * Uses a nearest-rank percentile method: p = sorted[floor(n * q)].
 * The index is clamped to [0, n-1] to prevent out-of-bounds access —
 * this is an intentional design choice so that extreme quantiles (e.g. q=0.99
 * with a small sample) always return the closest available value rather than
 * undefined.
 */
export function getAuthLatencyPercentiles(label: AuthLatencyLabel): AuthLatencyPercentiles {
  const samples = latencySamples.get(label) ?? [];
  if (samples.length < 2) {
    return { p50: 0, p95: 0, p99: 0, count: samples.length };
  }
  const sorted = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  const n = sorted.length;
  const percentile = (q: number) => sorted[Math.min(Math.floor(n * q), n - 1)] ?? 0;
  return {
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    count: n,
  };
}

export function resetAuthObservabilityStateForTests(): void {
  metricSamples.clear();
  lastAlertTimestamps.clear();
  latencySamples.clear();
}

// ---------------------------------------------------------------------------
// Shared refresh resolution → metric mapping
// ---------------------------------------------------------------------------

import type { RefreshResolution } from "@/lib/auth/refreshResolver";

/**
 * Maps a `RefreshResolution` to its canonical resolution-specific metric name.
 *
 * Exported here so both `session.ts` and `apiGuard.ts` use the same
 * single-source mapping without duplication.
 */
export function refreshResolutionToMetric(
  resolution: RefreshResolution,
): "auth_refresh_success_total"
  | "auth_refresh_expired_total"
  | "auth_refresh_revoked_total"
  | "auth_refresh_replay_denied_total"
  | "auth_refresh_concurrency_conflict_total"
  | "auth_refresh_malformed_total"
  | "auth_session_refresh_failure_total" {
  switch (resolution) {
    case "success": return "auth_refresh_success_total";
    case "expired": return "auth_refresh_expired_total";
    case "revoked": return "auth_refresh_revoked_total";
    case "replay_denied": return "auth_refresh_replay_denied_total";
    case "concurrency_conflict": return "auth_refresh_concurrency_conflict_total";
    case "malformed": return "auth_refresh_malformed_total";
    default: return "auth_session_refresh_failure_total";
  }
}
