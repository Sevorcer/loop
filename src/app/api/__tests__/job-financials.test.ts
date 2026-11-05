import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, getFinancialsMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getFinancialsMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/services/jobFinancials", () => ({
  getJobFinancialsForRole: getFinancialsMock,
}));

import { GET } from "../jobs/[id]/financials/route";

const PARAMS = { params: Promise.resolve({ id: "job-1" }) };

function req() {
  return new Request("http://localhost/api/jobs/job-1/financials");
}

describe("GET /api/jobs/[id]/financials", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getFinancialsMock.mockReset();
  });

  it("returns the guard's failure response untouched (guard result is never discarded)", async () => {
    const denied = new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
      status: 401,
    });
    requirePermissionMock.mockResolvedValue({ ok: false, response: denied });
    const res = await GET(req(), PARAMS);
    expect(res.status).toBe(401);
    expect(getFinancialsMock).not.toHaveBeenCalled();
  });

  it("returns the composed financials for the owner", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { role: "owner", userId: "u-1" },
    });
    getFinancialsMock.mockResolvedValue({
      summary: { totalCents: 100, invoicedCents: 100, paidCents: 100, balanceCents: 0, hasImportedDetail: true },
      lineItems: [],
      invoices: [],
      payments: [],
    });
    const res = await GET(req(), PARAMS);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.balanceCents).toBe(0);
    expect(getFinancialsMock).toHaveBeenCalledWith("owner", "job-1");
  });

  it("maps the service's owner-only 403 to a 403 response", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: true,
      ctx: { role: "office", userId: "u-2" },
    });
    getFinancialsMock.mockRejectedValue(
      Object.assign(new Error("Financial detail is restricted to the owner."), {
        status: 403,
      }),
    );
    const res = await GET(req(), PARAMS);
    expect(res.status).toBe(403);
  });
});
