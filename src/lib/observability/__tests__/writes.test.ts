import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logWriteFailure } from "@/lib/observability/writes";

describe("logWriteFailure", () => {
  let consoleErrorMock: ReturnType<typeof vi.spyOn>;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    consoleErrorMock.mockRestore();
  });

  it("emits [WRITE_FAILURE] with structured JSON payload", () => {
    process.env.NODE_ENV = "production";
    logWriteFailure(
      { route: "/api/jobs", operation: "create_job", requestId: "req-123" },
      new Error("db timeout"),
    );

    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    const [prefix, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    expect(prefix).toBe("[WRITE_FAILURE]");

    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.category).toBe("write_failure");
    expect(payload.schema_version).toBe("1.0");
    expect(payload.route).toBe("/api/jobs");
    expect(payload.operation).toBe("create_job");
    expect(payload.request_id).toBe("req-123");
    expect(payload.sanitized_message).toBe("db timeout");
    expect(payload.error_code).toBeNull();
    expect(payload.stack).toBeUndefined();
    expect(typeof payload.timestamp).toBe("string");
  });

  it("extracts errorCode from structured error objects", () => {
    process.env.NODE_ENV = "production";
    const error = Object.assign(new Error("insert failed"), { code: "23505" });
    logWriteFailure({ route: "/api/properties", operation: "create_property", requestId: "req-abc" }, error);

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.error_code).toBe("23505");
    expect(payload.sanitized_message).toBe("insert failed");
  });

  it("extracts requestId from request x-request-id header when not explicitly provided", () => {
    process.env.NODE_ENV = "production";
    const request = new Request("http://localhost/api/customers", {
      headers: { "x-request-id": "req-from-header" },
    });

    logWriteFailure({ route: "/api/customers", operation: "create_customer", request }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.request_id).toBe("req-from-header");
  });

  it("falls back to x-correlation-id when x-request-id is absent", () => {
    process.env.NODE_ENV = "production";
    const request = new Request("http://localhost/api/customers", {
      headers: { "x-correlation-id": "corr-999" },
    });

    logWriteFailure({ route: "/api/customers", operation: "create_customer", request }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.request_id).toBe("corr-999");
  });

  it("sets requestId to null when no request or header is available", () => {
    process.env.NODE_ENV = "production";
    logWriteFailure({ route: "/api/jobs", operation: "create_job" }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.request_id).toBeNull();
  });

  it("redacts sensitive values from sanitized_message", () => {
    process.env.NODE_ENV = "production";
    logWriteFailure(
      { route: "/api/properties", operation: "create_property", requestId: "req-1" },
      new Error("Authorization=****** cookie=session123 ops@loop.com"),
    );

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.sanitized_message).toBe(
      "Authorization=[REDACTED] cookie=[REDACTED] [REDACTED_EMAIL]",
    );
  });

  it("includes stack traces outside production", () => {
    process.env.NODE_ENV = "test";
    logWriteFailure({ route: "/api/jobs", operation: "create_job", requestId: "req-1" }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(typeof payload.stack).toBe("string");
    expect(String(payload.stack)).toContain("Error: fail");
  });

  it("handles non-Error values gracefully", () => {
    process.env.NODE_ENV = "production";
    logWriteFailure({ route: "/api/jobs", operation: "create_job" }, "something went wrong");

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.sanitized_message).toBe("something went wrong");
    expect(payload.error_code).toBeNull();
  });

  it("handles null error gracefully", () => {
    process.env.NODE_ENV = "production";
    logWriteFailure({ route: "/api/jobs", operation: "create_job" }, null);

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.sanitized_message).toBe("null");
  });

  it("explicit requestId takes precedence over request header", () => {
    process.env.NODE_ENV = "production";
    const request = new Request("http://localhost/api/jobs", {
      headers: { "x-request-id": "header-id" },
    });

    logWriteFailure(
      { route: "/api/jobs", operation: "create_job", request, requestId: "explicit-id" },
      new Error("fail"),
    );

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.request_id).toBe("explicit-id");
  });

  it("omits stack traces in production", () => {
    process.env.NODE_ENV = "production";
    logWriteFailure({ route: "/api/jobs", operation: "create_job" }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    expect(raw).not.toContain('"stack"');
  });
});
