import { beforeEach, describe, expect, it, vi } from "vitest";

import { logWriteFailure } from "@/lib/observability/writes";

describe("logWriteFailure", () => {
  let consoleErrorMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorMock.mockRestore();
  });

  it("emits [WRITE_FAILURE] with structured JSON payload", () => {
    logWriteFailure({ route: "/api/jobs", requestId: "req-123" }, new Error("db timeout"));

    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    const [prefix, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    expect(prefix).toBe("[WRITE_FAILURE]");

    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.category).toBe("write_failure");
    expect(payload.schemaVersion).toBe("1.0");
    expect(payload.event).toBe("write_failure");
    expect(payload.route).toBe("/api/jobs");
    expect(payload.requestId).toBe("req-123");
    expect(payload.errorName).toBe("Error");
    expect(payload.errorMessage).toBe("db timeout");
    expect(payload.errorCode).toBeNull();
    expect(typeof payload.timestamp).toBe("string");
  });

  it("extracts errorCode from structured error objects", () => {
    const error = Object.assign(new Error("insert failed"), { code: "23505" });
    logWriteFailure({ route: "/api/properties", requestId: "req-abc" }, error);

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.errorCode).toBe("23505");
    expect(payload.errorMessage).toBe("insert failed");
  });

  it("extracts requestId from request x-request-id header when not explicitly provided", () => {
    const request = new Request("http://localhost/api/customers", {
      headers: { "x-request-id": "req-from-header" },
    });

    logWriteFailure({ route: "/api/customers", request }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.requestId).toBe("req-from-header");
  });

  it("falls back to x-correlation-id when x-request-id is absent", () => {
    const request = new Request("http://localhost/api/customers", {
      headers: { "x-correlation-id": "corr-999" },
    });

    logWriteFailure({ route: "/api/customers", request }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.requestId).toBe("corr-999");
  });

  it("sets requestId to null when no request or header is available", () => {
    logWriteFailure({ route: "/api/jobs" }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.requestId).toBeNull();
  });

  it("includes step in payload when provided", () => {
    logWriteFailure(
      { route: "/api/properties", requestId: "req-1", step: "create_property_service" },
      new Error("fail"),
    );

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.step).toBe("create_property_service");
  });

  it("sets step to null when not provided", () => {
    logWriteFailure({ route: "/api/jobs", requestId: "req-1" }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.step).toBeNull();
  });

  it("handles non-Error values gracefully", () => {
    logWriteFailure({ route: "/api/jobs" }, "something went wrong");

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.errorName).toBe("string");
    expect(payload.errorMessage).toBe("something went wrong");
    expect(payload.errorCode).toBeNull();
  });

  it("handles null error gracefully", () => {
    logWriteFailure({ route: "/api/jobs" }, null);

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.errorName).toBe("object");
    expect(payload.errorMessage).toBe("null");
  });

  it("explicit requestId takes precedence over request header", () => {
    const request = new Request("http://localhost/api/jobs", {
      headers: { "x-request-id": "header-id" },
    });

    logWriteFailure({ route: "/api/jobs", request, requestId: "explicit-id" }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    const payload = JSON.parse(raw) as Record<string, unknown>;
    expect(payload.requestId).toBe("explicit-id");
  });

  it("does not include stack traces in the payload", () => {
    logWriteFailure({ route: "/api/jobs" }, new Error("fail"));

    const [, raw] = consoleErrorMock.mock.calls[0] as [string, string];
    expect(raw).not.toContain("stack");
    expect(raw).not.toContain("at ");
  });
});
