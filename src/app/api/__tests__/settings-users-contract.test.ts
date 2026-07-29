import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  listOrgUsersMock,
  inviteOrgUserMock,
  logWriteFailureMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  listOrgUsersMock: vi.fn(),
  inviteOrgUserMock: vi.fn(),
  logWriteFailureMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/lib/observability/writes", () => ({
  logWriteFailure: logWriteFailureMock,
}));

vi.mock("@/services/settingsUsers", () => ({
  listOrgUsers: listOrgUsersMock,
  inviteOrgUser: inviteOrgUserMock,
}));

import { GET, POST } from "@/app/api/settings/users/route";

function unauthorizedResponse() {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "UNAUTHORIZED", code: 401 }), {
      status: 401,
    }),
  };
}

function authorizedCtx(role = "owner") {
  return { ok: true, ctx: { userId: "user-1", role } };
}

describe("GET /api/settings/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    requirePermissionMock.mockResolvedValue(unauthorizedResponse());

    const response = await GET(new Request("http://localhost/api/settings/users"));

    expect(response.status).toBe(401);
  });

  it("returns users for authorized callers", async () => {
    requirePermissionMock.mockResolvedValue(authorizedCtx());
    listOrgUsersMock.mockResolvedValue([{ id: "user-2", email: "alex@example.com" }]);

    const response = await GET(new Request("http://localhost/api/settings/users"));
    const body = (await response.json()) as { users: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.users).toHaveLength(1);
    expect(listOrgUsersMock).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/settings/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionMock.mockResolvedValue(authorizedCtx());
  });

  it("returns 400 when appRole is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/settings/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "alex@example.com", fullName: "Alex" }),
      }),
    );

    const body = (await response.json()) as {
      code: string;
      fieldErrors?: Record<string, string[]>;
    };

    expect(response.status).toBe(400);
    expect(body.code).toBe("validation_failure");
    expect(body.fieldErrors?.appRole).toBeTruthy();
    expect(inviteOrgUserMock).not.toHaveBeenCalled();
  });

  it("passes appRole through to inviteOrgUser", async () => {
    inviteOrgUserMock.mockResolvedValue({ id: "user-2" });

    const response = await POST(
      new Request("http://localhost/api/settings/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "alex@example.com",
          fullName: "Alex Dispatcher",
          appRole: "dispatch",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(inviteOrgUserMock).toHaveBeenCalledWith("user-1", {
      email: "alex@example.com",
      fullName: "Alex Dispatcher",
      appRole: "dispatch",
    });
  });

  it("returns actionable Supabase error details on create failure", async () => {
    inviteOrgUserMock.mockRejectedValue(
      Object.assign(new Error("Database error creating new user"), {
        code: "23502",
        details: 'Failing row contains (id, email, null app_role).',
        status: 500,
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/settings/users", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "req-users-1" },
        body: JSON.stringify({
          email: "alex@example.com",
          fullName: "Alex Dispatcher",
          appRole: "dispatch",
        }),
      }),
    );

    const body = (await response.json()) as {
      error: string;
      message: string;
      code: string;
      details: string;
    };

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "USER_CREATE_FAILED",
      message: "Database error creating new user",
      code: "23502",
      details: "Failing row contains (id, email, null app_role).",
    });
    expect(logWriteFailureMock).toHaveBeenCalledWith(
      { route: "/api/settings/users", operation: "create_user", request: expect.any(Request) },
      expect.any(Error),
    );
  });
});
