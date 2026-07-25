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
