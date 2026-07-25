import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resolveRequestRole,
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/api-auth";
import type { AppRole } from "@/services/authorization";

// ---------------------------------------------------------------------------
// Mock the Supabase server client so tests remain pure unit tests.
// By default, return no authenticated user — the x-loop-role header fallback
// (non-production) is what drives all assertions below.
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } });

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(role?: string, path = "http://localhost/api/test"): Request {
  const headers: Record<string, string> = {};
  if (role !== undefined) {
    headers["x-loop-role"] = role;
  }
  return new Request(path, { headers });
}

// ---------------------------------------------------------------------------
// resolveRequestRole
// ---------------------------------------------------------------------------

describe("resolveRequestRole", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("returns null when no role header is present", async () => {
    expect(await resolveRequestRole(makeRequest())).toBeNull();
  });

  it("returns the role when a valid X-Loop-Role header is provided", async () => {
    const roles: AppRole[] = ["owner", "manager", "dispatch", "tech", "office", "sales", "portal"];
    for (const role of roles) {
      expect(await resolveRequestRole(makeRequest(role))).toBe(role);
    }
  });

  it("returns null for an unrecognised role value", async () => {
    expect(await resolveRequestRole(makeRequest("superadmin"))).toBeNull();
    expect(await resolveRequestRole(makeRequest("OWNER"))).toBeNull();
    expect(await resolveRequestRole(makeRequest(""))).toBeNull();
    expect(await resolveRequestRole(makeRequest("  "))).toBeNull();
  });

  it("returns null for a role value that is not a string (empty header)", async () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-loop-role": "" },
    });
    expect(await resolveRequestRole(req)).toBeNull();
  });

  it("resolves role from Supabase user app_metadata.app_role when present", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { app_metadata: { app_role: "manager" }, user_metadata: {} } },
    });
    expect(await resolveRequestRole(makeRequest())).toBe("manager");
  });

  it("falls back to user_metadata.app_role when app_metadata.app_role is absent", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { app_metadata: {}, user_metadata: { app_role: "tech" } } },
    });
    expect(await resolveRequestRole(makeRequest())).toBe("tech");
  });

  it("falls back to app_metadata.role when app_role fields are absent", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { app_metadata: { role: "office" }, user_metadata: {} } },
    });
    expect(await resolveRequestRole(makeRequest())).toBe("office");
  });

  it("falls back to user_metadata.role as last resort", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { app_metadata: {}, user_metadata: { role: "sales" } } },
    });
    expect(await resolveRequestRole(makeRequest())).toBe("sales");
  });

  it("prefers Supabase session role over x-loop-role header", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { app_metadata: { app_role: "owner" }, user_metadata: {} } },
    });
    // Even though the header says "tech", the session-resolved role should win
    expect(await resolveRequestRole(makeRequest("tech"))).toBe("owner");
  });
});

// ---------------------------------------------------------------------------
// requirePermission — unauthenticated (no role)
// ---------------------------------------------------------------------------

describe("requirePermission — unauthenticated", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("returns ok: false with a 401 response when no role is present", async () => {
    const result = await requirePermission(makeRequest(), "jobs", "select");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = (await result.response.json()) as {
        error: string;
        code: number;
        reason: string;
      };
      expect(body.error).toBe("UNAUTHORIZED");
      expect(body.code).toBe(401);
      expect(body.reason).toBe("missing_token");
      expect(result.response.headers.get("www-authenticate")).toContain("Bearer");
    }
  });

  it("401 body contains a message field", async () => {
    const result = await requirePermission(makeRequest(), "customers", "insert");
    if (!result.ok) {
      const body = (await result.response.json()) as { message: string };
      expect(typeof body.message).toBe("string");
      expect(body.message.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// requirePermission — authorized roles (allow paths)
// ---------------------------------------------------------------------------

describe("requirePermission — authorized (allow)", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("returns ok: true with AuthContext for owner on any table/action", async () => {
    const tables = ["customers", "properties", "jobs"] as const;
    for (const table of tables) {
      const result = await requirePermission(makeRequest("owner"), table, "delete");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ctx.role).toBe("owner");
      }
    }
  });

  it("returns ok: true for manager creating customers", async () => {
    const result = await requirePermission(makeRequest("manager"), "customers", "insert");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ctx.role).toBe("manager");
  });

  it("returns ok: true for dispatch reading jobs", async () => {
    const result = await requirePermission(makeRequest("dispatch"), "jobs", "select");
    expect(result.ok).toBe(true);
  });

  it("returns ok: true for tech reading properties", async () => {
    const result = await requirePermission(makeRequest("tech"), "properties", "select");
    expect(result.ok).toBe(true);
  });

  it("returns ok: true for office creating jobs", async () => {
    const result = await requirePermission(makeRequest("office"), "jobs", "insert");
    expect(result.ok).toBe(true);
  });

  it("returns ok: true for sales reading customers", async () => {
    const result = await requirePermission(makeRequest("sales"), "customers", "select");
    expect(result.ok).toBe(true);
  });

  it("returns ok: true for portal reading own portal_users row", async () => {
    const result = await requirePermission(makeRequest("portal"), "portal_users", "select");
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requirePermission — denied roles (403 paths)
// ---------------------------------------------------------------------------

describe("requirePermission — denied (403)", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("returns ok: false with a 403 for tech trying to delete jobs", async () => {
    const result = await requirePermission(makeRequest("tech"), "jobs", "delete");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = (await result.response.json()) as {
        error: string;
        code: number;
        reason: string;
      };
      expect(body.error).toBe("FORBIDDEN");
      expect(body.code).toBe(403);
      expect(body.reason).toBe("insufficient_permission");
    }
  });

  it("returns ok: false with a 403 for dispatch trying to insert jobs", async () => {
    const result = await requirePermission(makeRequest("dispatch"), "jobs", "insert");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns ok: false for portal accessing internal jobs table", async () => {
    const actions = ["select", "insert", "update", "delete"] as const;
    for (const action of actions) {
      const result = await requirePermission(makeRequest("portal"), "jobs", action);
      expect(result.ok).toBe(false);
    }
  });

  it("returns ok: false for portal accessing customers", async () => {
    const result = await requirePermission(makeRequest("portal"), "customers", "select");
    expect(result.ok).toBe(false);
  });

  it("returns ok: false for sales trying to delete customers", async () => {
    const result = await requirePermission(makeRequest("sales"), "customers", "delete");
    expect(result.ok).toBe(false);
  });

  it("returns ok: false for tech trying to access customers", async () => {
    const result = await requirePermission(makeRequest("tech"), "customers", "select");
    expect(result.ok).toBe(false);
  });

  it("returns ok: false for office trying to access contractors", async () => {
    const result = await requirePermission(makeRequest("office"), "contractors", "select");
    expect(result.ok).toBe(false);
  });

  it("403 body includes role, action, and table in message", async () => {
    const result = await requirePermission(makeRequest("dispatch"), "jobs", "delete");
    if (!result.ok) {
      const body = (await result.response.json()) as { message: string };
      expect(body.message).toContain("dispatch");
      expect(body.message).toContain("delete");
      expect(body.message).toContain("jobs");
    }
  });
});

// ---------------------------------------------------------------------------
// requirePermission — append-only job_activity
// ---------------------------------------------------------------------------

describe("requirePermission — job_activity append-only invariant", () => {
  const allRoles: AppRole[] = ["owner", "manager", "dispatch", "tech", "office", "sales", "portal"];

  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("no role may update job_activity", async () => {
    for (const role of allRoles) {
      const result = await requirePermission(makeRequest(role), "job_activity", "update");
      expect(result.ok).toBe(false);
    }
  });

  it("no role may delete job_activity", async () => {
    for (const role of allRoles) {
      const result = await requirePermission(makeRequest(role), "job_activity", "delete");
      expect(result.ok).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Error response helpers
// ---------------------------------------------------------------------------

describe("unauthorizedResponse", () => {
  it("returns status 401", () => {
    expect(unauthorizedResponse().status).toBe(401);
  });

  it("returns UNAUTHORIZED error code in body", async () => {
    const body = (await unauthorizedResponse().json()) as { error: string; reason: string };
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.reason).toBe("missing_token");
  });

  it("accepts a custom message", async () => {
    const body = (await unauthorizedResponse("custom msg").json()) as { message: string };
    expect(body.message).toBe("custom msg");
  });

  it("sets WWW-Authenticate and reason headers", () => {
    const response = unauthorizedResponse(undefined, "expired_token");
    expect(response.headers.get("www-authenticate")).toContain('error="invalid_token"');
    expect(response.headers.get("x-loop-auth-reason")).toBe("expired_token");
  });
});

describe("forbiddenResponse", () => {
  it("returns status 403", () => {
    expect(forbiddenResponse("tech", "jobs", "delete").status).toBe(403);
  });

  it("returns FORBIDDEN error code in body", async () => {
    const body = (await forbiddenResponse("tech", "jobs", "delete").json()) as {
      error: string;
      reason: string;
    };
    expect(body.error).toBe("FORBIDDEN");
    expect(body.reason).toBe("insufficient_permission");
  });

  it("includes role, table, and action in the message", async () => {
    const body = (await forbiddenResponse("sales", "contractors", "select").json()) as { message: string };
    expect(body.message).toContain("sales");
    expect(body.message).toContain("contractors");
    expect(body.message).toContain("select");
  });
});

// ---------------------------------------------------------------------------
// Role x action coverage matrix for all in-scope tables
// ---------------------------------------------------------------------------

describe("role x action coverage matrix — deny-by-default verification", () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it("a request with no identity header is always denied", async () => {
    const tables = ["customers", "properties", "jobs", "contractors", "job_activity"] as const;
    const actions = ["select", "insert", "update", "delete"] as const;
    for (const table of tables) {
      for (const action of actions) {
        const result = await requirePermission(makeRequest(), table, action);
        expect(result.ok, `unauthenticated should be denied on ${table}/${action}`).toBe(false);
        if (!result.ok) {
          expect(result.response.status).toBe(401);
        }
      }
    }
  });

  it("portal cannot access any internal operational table (full isolation)", async () => {
    const internalTables = ["customers", "properties", "contractors", "jobs", "job_activity"] as const;
    const actions = ["select", "insert", "update", "delete"] as const;
    for (const table of internalTables) {
      for (const action of actions) {
        const result = await requirePermission(makeRequest("portal"), table, action);
        expect(result.ok, `portal must be denied on ${table}/${action}`).toBe(false);
        if (!result.ok) {
          expect(result.response.status).toBe(403);
        }
      }
    }
  });
});
