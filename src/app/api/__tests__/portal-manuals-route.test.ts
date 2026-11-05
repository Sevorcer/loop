/**
 * GET /api/portal/[token]/manuals — token handling tests.
 *
 * Mirrors gc-portal-share-links.test.ts (same resolveShareToken contract),
 * plus a real resolveShareToken run against a fake admin client to prove
 * malformed / unknown / revoked tokens never resolve.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { resolveShareTokenMock, getPortalJobManualsMock } = vi.hoisted(() => ({
  resolveShareTokenMock: vi.fn(),
  getPortalJobManualsMock: vi.fn(),
}));

vi.mock("@/services/jobShareLinks", () => ({ resolveShareToken: resolveShareTokenMock }));
vi.mock("@/services/portalManuals", () => ({ getPortalJobManuals: getPortalJobManualsMock }));

const VALID_TOKEN = "a".repeat(64);
const ORG_ID = "org-001";
const JOB_A = "job-aaa-111";

function call(token: string) {
  return import("@/app/api/portal/[token]/manuals/route").then(({ GET }) =>
    GET(new Request(`http://localhost/api/portal/${token}/manuals`), { params: Promise.resolve({ token }) }),
  );
}

describe("GET /api/portal/[token]/manuals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the systems for a valid token, scoped to the token's job + org", async () => {
    resolveShareTokenMock.mockResolvedValue({ id: "link-1", orgId: ORG_ID, jobId: JOB_A });
    getPortalJobManualsMock.mockResolvedValue({
      jobId: JOB_A,
      systems: [{ id: "sys-1", systemName: "Heat pump", manufacturer: "Mitsubishi", modelNumber: "MSZ-GL09NA", location: null,
        manuals: [{ id: "m1", name: "Owner manual.pdf", docType: "user", docTypeLabel: "User manual", mimeType: "application/pdf",
          linkStatus: "confirmed", url: "https://drive.google.com/file/d/m1/view", updatedAt: "2026-11-04T00:00:00Z" }] }],
    });
    const res = await call(VALID_TOKEN);
    expect(res.status).toBe(200);
    expect(getPortalJobManualsMock).toHaveBeenCalledWith(JOB_A, ORG_ID);
    const body = await res.json();
    expect(body.systems[0].manuals[0].url).toBe("https://drive.google.com/file/d/m1/view");
  });

  it("wrong token → 404 and no data load", async () => {
    resolveShareTokenMock.mockResolvedValue(null);
    const res = await call("not-a-real-token");
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe("Invalid or expired share link.");
    expect(getPortalJobManualsMock).not.toHaveBeenCalled();
  });

  it("expired / revoked token → 404 and no data load", async () => {
    resolveShareTokenMock.mockResolvedValue(null);
    const res = await call("b".repeat(64));
    expect(res.status).toBe(404);
    expect(getPortalJobManualsMock).not.toHaveBeenCalled();
  });

  it("token A only ever loads job A", async () => {
    resolveShareTokenMock.mockResolvedValue({ id: "link-1", orgId: ORG_ID, jobId: JOB_A });
    getPortalJobManualsMock.mockResolvedValue({ jobId: JOB_A, systems: [] });
    await call(VALID_TOKEN);
    expect(getPortalJobManualsMock).toHaveBeenCalledTimes(1);
    expect(getPortalJobManualsMock.mock.calls[0]).toEqual([JOB_A, ORG_ID]);
  });

  it("job no longer in the org → 404", async () => {
    resolveShareTokenMock.mockResolvedValue({ id: "link-1", orgId: ORG_ID, jobId: JOB_A });
    getPortalJobManualsMock.mockResolvedValue(null);
    expect((await call(VALID_TOKEN)).status).toBe(404);
  });

  it("service failure → 500 without leaking the error", async () => {
    resolveShareTokenMock.mockResolvedValue({ id: "link-1", orgId: ORG_ID, jobId: JOB_A });
    getPortalJobManualsMock.mockRejectedValue(new Error("relation secret_table does not exist"));
    const res = await call(VALID_TOKEN);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret_table");
  });
});

describe("resolveShareToken (real) — wrong, revoked and expired tokens never resolve", () => {
  type Link = { id: string; org_id: string; job_id: string; token_hash: string; revoked_at: string | null };
  let links: Link[] = [];
  const dbCalls: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    links = [];
    dbCalls.length = 0;
    vi.doUnmock("@/services/jobShareLinks");
    vi.doMock("@/repositories/supabaseContext", () => ({ getRepositoryContext: vi.fn() }));
    vi.doMock("@/lib/supabase/admin", () => ({
      getSupabaseAdminClient: () => ({
        from(table: string) {
          dbCalls.push(table);
          const filters: Array<(r: Link) => boolean> = [];
          const b = {
            select: () => b,
            eq: (col: keyof Link, v: unknown) => (filters.push((r) => r[col] === v), b),
            is: (col: keyof Link, v: unknown) => (filters.push((r) => r[col] === v), b),
            maybeSingle: async () => ({ data: links.find((r) => filters.every((f) => f(r))) ?? null, error: null }),
          };
          return b;
        },
      }),
    }));
  });

  async function hash(token: string) {
    const { createHash } = await import("crypto");
    return createHash("sha256").update(token, "utf-8").digest("hex");
  }

  it("rejects malformed tokens without touching the database", async () => {
    const { resolveShareToken } = await import("@/services/jobShareLinks");
    expect(await resolveShareToken("")).toBeNull();
    expect(await resolveShareToken("short")).toBeNull();
    expect(await resolveShareToken("a".repeat(65))).toBeNull();
    expect(dbCalls).toEqual([]);
  });

  it("returns null for an unknown token", async () => {
    links = [{ id: "l1", org_id: ORG_ID, job_id: JOB_A, token_hash: await hash("c".repeat(64)), revoked_at: null }];
    const { resolveShareToken } = await import("@/services/jobShareLinks");
    expect(await resolveShareToken("d".repeat(64))).toBeNull();
  });

  it("returns null for a revoked (expired) token and resolves an active one", async () => {
    links = [
      { id: "old", org_id: ORG_ID, job_id: JOB_A, token_hash: await hash("e".repeat(64)), revoked_at: "2026-11-01T00:00:00Z" },
      { id: "new", org_id: ORG_ID, job_id: JOB_A, token_hash: await hash("f".repeat(64)), revoked_at: null },
    ];
    const { resolveShareToken } = await import("@/services/jobShareLinks");
    expect(await resolveShareToken("e".repeat(64))).toBeNull();
    expect(await resolveShareToken("f".repeat(64))).toEqual({ id: "new", orgId: ORG_ID, jobId: JOB_A });
  });
});
