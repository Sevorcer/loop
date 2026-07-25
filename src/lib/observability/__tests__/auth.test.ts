import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTraceHeaders,
  getRequestTraceContext,
  incrementAuthMetric,
  logAuthorizationDecision,
  logAuthEvent,
  redactSensitiveValue,
  resetAuthObservabilityStateForTests,
} from "@/lib/observability/auth";

describe("auth observability", () => {
  beforeEach(() => {
    resetAuthObservabilityStateForTests();
    vi.restoreAllMocks();
  });

  it("extracts request and correlation IDs from incoming request headers", () => {
    const request = new Request("http://localhost/api/jobs", {
      headers: {
        "x-request-id": "req-123",
        "x-correlation-id": "corr-456",
      },
    });

    const trace = getRequestTraceContext(request);
    expect(trace.route).toBe("/api/jobs");
    expect(trace.requestId).toBe("req-123");
    expect(trace.correlationId).toBe("corr-456");
  });

  it("applies trace headers to responses", () => {
    const response = applyTraceHeaders(new Response(null, { status: 200 }), {
      requestId: "req-abc",
      correlationId: "corr-def",
    });

    expect(response.headers.get("x-request-id")).toBe("req-abc");
    expect(response.headers.get("x-correlation-id")).toBe("corr-def");
  });

  it("redacts sensitive keys recursively", () => {
    const input = {
      access_token: "token-value",
      nested: {
        password: "pw",
        profile: {
          email: "ops@loop.com",
          safe: "ok",
        },
      },
    };

    expect(redactSensitiveValue(input)).toEqual({
      access_token: "[REDACTED]",
      nested: {
        password: "[REDACTED]",
        profile: {
          email: "[REDACTED]",
          safe: "ok",
        },
      },
    });
  });

  it("logs redacted auth events", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logAuthEvent({
      event: "sign_in_failure",
      outcome: "failure",
      route: "/sign-in",
      requestId: "req-log",
      correlationId: "corr-log",
      refreshOutcome: "replay_denied",
      refreshAttempts: 2,
      details: {
        refresh_token: "sensitive",
        message: "Invalid login credentials",
      },
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [, payload] = infoSpy.mock.calls[0] as [string, string];
    expect(payload).toContain('"event":"sign_in_failure"');
    expect(payload).toContain('"refreshOutcome":"replay_denied"');
    expect(payload).toContain('"refreshAttempts":2');
    expect(payload).toContain('"refresh_token":"[REDACTED]"');
    expect(payload).not.toContain("sensitive");
  });

  it("logs minimal authorization decisions without request payload details", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logAuthorizationDecision({
      route: "/api/jobs",
      method: "post",
      actorRole: "owner",
      policy: "jobs",
      action: "insert",
      decision: "allow",
      reasonCode: "PERMISSION_ALLOWED",
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [prefix, payload] = infoSpy.mock.calls[0] as [string, string];
    expect(prefix).toBe("[AUTHZ_DECISION]");
    expect(payload).toContain('"route":"/api/jobs"');
    expect(payload).toContain('"method":"POST"');
    expect(payload).toContain('"actor_role":"owner"');
    expect(payload).toContain('"policy":"jobs"');
    expect(payload).toContain('"action":"insert"');
    expect(payload).toContain('"decision":"allow"');
    expect(payload).toContain('"reason_code":"PERMISSION_ALLOWED"');
    expect(payload).not.toContain("requestId");
    expect(payload).not.toContain("correlationId");
    expect(payload).not.toContain("details");
  });

  it("emits alerts when metric thresholds are crossed", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const now = Date.now();

    for (let index = 0; index < 10; index += 1) {
      incrementAuthMetric("auth_sign_in_failure_total", {
        route: "/sign-in",
        category: "invalid_credentials",
        now: now + index,
      });
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, payload] = warnSpy.mock.calls[0] as [string, string];
    expect(payload).toContain('"metric":"auth_sign_in_failure_total"');
    expect(payload).toContain('"route":"/sign-in"');
    expect(payload).toContain('"authCategory":"invalid_credentials"');
  });
});

// ---------------------------------------------------------------------------
// Canonical metrics — Sprint S3
// ---------------------------------------------------------------------------

import {
  getAuthLatencyPercentiles,
  recordAuthDuration,
  startAuthTimer,
} from "@/lib/observability/auth";

describe("canonical auth metrics — S3", () => {
  beforeEach(() => {
    resetAuthObservabilityStateForTests();
    vi.restoreAllMocks();
  });

  it("auth_refresh_success_total is incrementable", () => {
    // Should not throw.
    incrementAuthMetric("auth_refresh_success_total", { route: "/api/session", category: "success" });
  });

  it("auth_refresh_expired_total triggers alert at threshold", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const now = Date.now();

    for (let index = 0; index < 20; index += 1) {
      incrementAuthMetric("auth_refresh_expired_total", {
        route: "/api/jobs",
        category: "expired",
        now: now + index,
      });
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, payload] = warnSpy.mock.calls[0] as [string, string];
    expect(payload).toContain('"metric":"auth_refresh_expired_total"');
  });

  it("auth_refresh_revoked_total triggers alert at threshold (10 in 5min)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const now = Date.now();

    for (let index = 0; index < 10; index += 1) {
      incrementAuthMetric("auth_refresh_revoked_total", {
        route: "/api/properties",
        category: "revoked",
        now: now + index,
      });
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, payload] = warnSpy.mock.calls[0] as [string, string];
    expect(payload).toContain('"metric":"auth_refresh_revoked_total"');
  });

  it("auth_refresh_replay_denied_total triggers alert at threshold (5 in 5min)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const now = Date.now();

    for (let index = 0; index < 5; index += 1) {
      incrementAuthMetric("auth_refresh_replay_denied_total", {
        route: "/api/customers",
        category: "replay_denied",
        now: now + index,
      });
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, payload] = warnSpy.mock.calls[0] as [string, string];
    expect(payload).toContain('"metric":"auth_refresh_replay_denied_total"');
  });

  it("auth_refresh_concurrency_conflict_total triggers alert at threshold (15 in 5min)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const now = Date.now();

    for (let index = 0; index < 15; index += 1) {
      incrementAuthMetric("auth_refresh_concurrency_conflict_total", {
        route: "/api/jobs",
        category: "concurrency_conflict",
        now: now + index,
      });
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [, payload] = warnSpy.mock.calls[0] as [string, string];
    expect(payload).toContain('"metric":"auth_refresh_concurrency_conflict_total"');
  });

  it("auth_authz_allow_total is incrementable without alert", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    incrementAuthMetric("auth_authz_allow_total", { route: "/api/jobs", category: "owner" });
    // No alert threshold for allow metric — expected non-failure path.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("alert deduplication prevents duplicate alerts in same window", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const now = Date.now();

    // Cross the threshold once.
    for (let index = 0; index < 10; index += 1) {
      incrementAuthMetric("auth_refresh_revoked_total", {
        route: "/api/test",
        category: "revoked",
        now: now + index,
      });
    }

    // Try to cross it again within the same window.
    for (let index = 0; index < 10; index += 1) {
      incrementAuthMetric("auth_refresh_revoked_total", {
        route: "/api/test",
        category: "revoked",
        now: now + 10 + index,
      });
    }

    // Should still be exactly 1 alert due to deduplication.
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Latency tracking — Sprint S3
// ---------------------------------------------------------------------------

describe("auth latency tracking — S3", () => {
  beforeEach(() => {
    resetAuthObservabilityStateForTests();
    vi.restoreAllMocks();
  });

  it("startAuthTimer returns a numeric timestamp", () => {
    const start = startAuthTimer();
    expect(typeof start).toBe("number");
    expect(start).toBeGreaterThan(0);
  });

  it("recordAuthDuration stores latency samples", () => {
    const start = startAuthTimer();
    recordAuthDuration("session_refresh", start);

    const percentiles = getAuthLatencyPercentiles("session_refresh");
    expect(percentiles.count).toBe(1);
    // p50/p95/p99 return 0 when fewer than 2 samples.
    expect(percentiles.p50).toBe(0);
  });

  it("percentiles are calculated from multiple samples", () => {
    // Insert 10 dummy samples using performance.now() directly won't work reliably
    // so we use the function signature that accepts a start value.
    const fakeNow = Date.now();
    for (let index = 0; index < 10; index += 1) {
      // Each call records the real elapsed time since startAuthTimer().
      const start = startAuthTimer();
      recordAuthDuration("api_guard", start, fakeNow + index);
    }

    const percentiles = getAuthLatencyPercentiles("api_guard");
    expect(percentiles.count).toBe(10);
    // All samples are near-zero (immediate calls) but percentiles must be numeric.
    expect(typeof percentiles.p50).toBe("number");
    expect(typeof percentiles.p95).toBe("number");
    expect(typeof percentiles.p99).toBe("number");
  });

  it("different labels maintain separate sample reservoirs", () => {
    const start = startAuthTimer();
    recordAuthDuration("session_refresh", start);
    recordAuthDuration("api_guard", start);
    recordAuthDuration("api_guard", start);

    expect(getAuthLatencyPercentiles("session_refresh").count).toBe(1);
    expect(getAuthLatencyPercentiles("api_guard").count).toBe(2);
    expect(getAuthLatencyPercentiles("permission_check").count).toBe(0);
  });

  it("resetAuthObservabilityStateForTests clears latency samples", () => {
    const start = startAuthTimer();
    recordAuthDuration("session_refresh", start);
    resetAuthObservabilityStateForTests();

    expect(getAuthLatencyPercentiles("session_refresh").count).toBe(0);
  });
});
