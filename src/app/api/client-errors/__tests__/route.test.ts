/**
 * Contract tests — POST /api/client-errors (diagnostic client-error sink).
 *
 * Verifies:
 *   - requires a session (returns the guard's 401 when unauthenticated)
 *   - accepts a POST and returns 204 on the happy path
 *   - emits a single structured `[CLIENT_ERROR]` log line
 *   - never persists (log-only) and never 500s on malformed input
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: vi.fn() }),
}));

const { requireApiSessionMock } = vi.hoisted(() => ({
  requireApiSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth/apiGuard", () => ({
  requireApiSession: requireApiSessionMock,
}));

import { POST } from "@/app/api/client-errors/route";

const authenticated = {
  error: null,
  user: {
    id: "test-user",
    email: "test@loop.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
};

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("POST /api/client-errors", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    requireApiSessionMock.mockReset();
    requireApiSessionMock.mockResolvedValue(authenticated);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("returns the guard's response when unauthenticated", async () => {
    const unauthorized = new Response(null, { status: 401 });
    requireApiSessionMock.mockResolvedValue({ error: unauthorized, user: null });

    const response = await POST(
      makeRequest(JSON.stringify({ message: "boom" })),
    );

    expect(response.status).toBe(401);
    // Must not log a client error when rejected at the guard.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("accepts a POST and returns 204", async () => {
    const response = await POST(
      makeRequest(
        JSON.stringify({
          message: "Cannot read properties of undefined",
          stack: "Error: boom\n  at Foo",
          url: "/jobs/new",
          userAgent: "Mozilla/5.0 (iPhone)",
          ts: new Date().toISOString(),
        }),
        { "x-request-id": "req-123" },
      ),
    );

    expect(response.status).toBe(204);
  });

  it("emits a single structured [CLIENT_ERROR] log line", async () => {
    await POST(
      makeRequest(
        JSON.stringify({
          message: "Cannot read properties of undefined (reading 'x')",
          stack: "Error: boom",
          url: "/jobs/new",
          userAgent: "iPhone Safari",
        }),
        { "x-request-id": "req-abc" },
      ),
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [tag, json] = errorSpy.mock.calls[0] as [string, string];
    expect(tag).toBe("[CLIENT_ERROR]");

    const logged = JSON.parse(json) as Record<string, unknown>;
    expect(logged.category).toBe("client_error");
    expect(logged.schema_version).toBe("1.0");
    expect(logged.request_id).toBe("req-abc");
    expect(logged.message).toBe(
      "Cannot read properties of undefined (reading 'x')",
    );
    expect(logged.url).toBe("/jobs/new");
    expect(typeof logged.timestamp).toBe("string");
  });

  it("does not throw on malformed JSON (still 204)", async () => {
    const response = await POST(makeRequest("not-json-at-all"));
    expect(response.status).toBe(204);
    // A minimal line is still emitted so the signal is not lost.
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("drops oversized bodies without logging the payload", async () => {
    const huge = JSON.stringify({ message: "x".repeat(20_000) });
    const response = await POST(makeRequest(huge));

    expect(response.status).toBe(204);
    const [, json] = errorSpy.mock.calls[0] as [string, string];
    const logged = JSON.parse(json) as Record<string, unknown>;
    expect(logged.dropped).toBe("oversized_body");
  });
});
