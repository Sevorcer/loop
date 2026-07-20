import { describe, it, expect } from "vitest";

import {
  resolveRequestRole,
  requirePermission,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/api-auth";
import type { AppRole } from "@/services/authorization";

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
  it("returns null when no role header is present", () => {
    expect(resolveRequestRole(makeRequest())).toBeNull();
  });

  it("returns the role when a valid X-Loop-Role header is provided", () => {
    const roles: AppRole[] = ["owner", "manager", "dispatch", "tech", "office", "sales", "portal"];
    for (const role of roles) {
      expect(resolveRequestRole(makeRequest(role))).toBe(role);
    }
  });

  it("returns null for an unrecognised role value", () => {
    expect(resolveRequestRole(makeRequest("superadmin"))).toBeNull();
    expect(resolveRequestRole(makeRequest("OWNER"))).toBeNull();
    expect(resolveRequestRole(makeRequest(""))).toBeNull();
    expect(resolveRequestRole(makeRequest("  "))).toBeNull();
  });

  it("returns null for a role value that is not a string (empty header)", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-loop-role": "" },
    });
    expect(resolveRequestRole(req)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// requirePermission — unauthenticated (no role)
// ---------------------------------------------------------------------------

describe("requirePermission — unauthenticated", () => {
  it("returns ok: false with a 401 response when no role is present", async () => {
    const result = requirePermission(makeRequest(), "jobs", "select");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const body = (await result.response.json()) as { error: string; code: number };
      expect(body.error).toBe("UNAUTHORIZED");
      expect(body.code).toBe(401);
    }
  });

  it("401 body contains a message field", async () => {
    const result = requirePermission(makeRequest(), "customers", "insert");
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
  it("returns ok: true with AuthContext for owner on any table/action", () => {
    const tables = ["customers", "properties", "jobs"] as const;
    for (const table of tables) {
      const result = requirePermission(makeRequest("owner"), table, "delete");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.ctx.role).toBe("owner");
      }
    }
  });

  it("returns ok: true for manager creating customers", () => {
    const result = requirePermission(makeRequest("manager"), "customers", "insert");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ctx.role).toBe("manager");
  });

  it("returns ok: true for dispatch reading jobs", () => {
    const result = requirePermission(makeRequest("dispatch"), "jobs", "select");
    expect(result.ok).toBe(true);
  });

  it("returns ok: true for tech reading properties", () => {
    const result = requirePermission(makeRequest("tech"), "properties", "select");
    expect(result.ok).toBe(true);
  });

  it("returns ok: true for office creating jobs", () => {
    const result = requirePermission(makeRequest("office"), "jobs", "insert");
    expect(result.ok).toBe(true);
  });

  it("returns ok: true for sales reading customers", () => {
    const result = requirePermission(makeRequest("sales"), "customers", "select");
    expect(result.ok).toBe(true);
  });

  it("returns ok: true for portal reading own portal_users row", () => {
    const result = requirePermission(makeRequest("portal"), "portal_users", "select");
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requirePermission — denied roles (403 paths)
// ---------------------------------------------------------------------------

describe("requirePermission — denied (403)", () => {
  it("returns ok: false with a 403 for tech trying to delete jobs", async () => {
    const result = requirePermission(makeRequest("tech"), "jobs", "delete");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = (await result.response.json()) as { error: string; code: number };
      expect(body.error).toBe("FORBIDDEN");
      expect(body.code).toBe(403);
    }
  });

  it("returns ok: false with a 403 for dispatch trying to insert jobs", async () => {
    const result = requirePermission(makeRequest("dispatch"), "jobs", "insert");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns ok: false for portal accessing internal jobs table", () => {
    const actions = ["select", "insert", "update", "delete"] as const;
    for (const action of actions) {
      const result = requirePermission(makeRequest("portal"), "jobs", action);
      expect(result.ok).toBe(false);
    }
  });

  it("returns ok: false for portal accessing customers", () => {
    const result = requirePermission(makeRequest("portal"), "customers", "select");
    expect(result.ok).toBe(false);
  });

  it("returns ok: false for sales trying to delete customers", () => {
    const result = requirePermission(makeRequest("sales"), "customers", "delete");
    expect(result.ok).toBe(false);
  });

  it("returns ok: false for tech trying to access customers", () => {
    const result = requirePermission(makeRequest("tech"), "customers", "select");
    expect(result.ok).toBe(false);
  });

  it("returns ok: false for office trying to access contractors", () => {
    const result = requirePermission(makeRequest("office"), "contractors", "select");
    expect(result.ok).toBe(false);
  });

  it("403 body includes role, action, and table in message", async () => {
    const result = requirePermission(makeRequest("dispatch"), "jobs", "delete");
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

  it("no role may update job_activity", () => {
    for (const role of allRoles) {
      const result = requirePermission(makeRequest(role), "job_activity", "update");
      expect(result.ok).toBe(false);
    }
  });

  it("no role may delete job_activity", () => {
    for (const role of allRoles) {
      const result = requirePermission(makeRequest(role), "job_activity", "delete");
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
    const body = (await unauthorizedResponse().json()) as { error: string };
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("accepts a custom message", async () => {
    const body = (await unauthorizedResponse("custom msg").json()) as { message: string };
    expect(body.message).toBe("custom msg");
  });
});

describe("forbiddenResponse", () => {
  it("returns status 403", () => {
    expect(forbiddenResponse("tech", "jobs", "delete").status).toBe(403);
  });

  it("returns FORBIDDEN error code in body", async () => {
    const body = (await forbiddenResponse("tech", "jobs", "delete").json()) as { error: string };
    expect(body.error).toBe("FORBIDDEN");
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
  // A role with no header at all must never get access
  it("a request with no identity header is always denied", () => {
    const tables = ["customers", "properties", "jobs", "contractors", "job_activity"] as const;
    const actions = ["select", "insert", "update", "delete"] as const;
    for (const table of tables) {
      for (const action of actions) {
        const result = requirePermission(makeRequest(), table, action);
        expect(result.ok, `unauthenticated should be denied on ${table}/${action}`).toBe(false);
        if (!result.ok) {
          expect(result.response.status).toBe(401);
        }
      }
    }
  });

  it("portal cannot access any internal operational table (full isolation)", () => {
    const internalTables = ["customers", "properties", "contractors", "jobs", "job_activity"] as const;
    const actions = ["select", "insert", "update", "delete"] as const;
    for (const table of internalTables) {
      for (const action of actions) {
        const result = requirePermission(makeRequest("portal"), table, action);
        expect(result.ok, `portal must be denied on ${table}/${action}`).toBe(false);
        if (!result.ok) {
          expect(result.response.status).toBe(403);
        }
      }
    }
  });
});
