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
  | "unauthorized_access_attempt";

export type AuthMetricName =
  | "auth_401_total"
  | "auth_403_total"
  | "auth_sign_in_failure_total"
  | "auth_session_refresh_failure_total";

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

interface MetricSample {
  timestamp: number;
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

export function resetAuthObservabilityStateForTests(): void {
  metricSamples.clear();
  lastAlertTimestamps.clear();
}
