import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, getCustomerInvoicesMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getCustomerInvoicesMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/services/customerInvoices", () => ({ getCustomerInvoices: getCustomerInvoicesMock }));

import { GET } from "@/app/api/customers/[id]/invoices/route";

const params = Promise.resolve({ id: "cust-1" });
const request = () => new Request("http://localhost/api/customers/cust-1/invoices");

beforeEach(() => vi.resetAllMocks());

describe("GET /api/customers/[id]/invoices", () => {
  it("returns invoices and the paid/outstanding summary for an allowed role", async () => {
    requirePermissionMock.mockResolvedValue({ ok: true, ctx: { userId: "u1", role: "office" } });
    getCustomerInvoicesMock.mockResolvedValue({
      invoices: [{ id: "inv-1", number: "1001", totalCents: 5000, isPaid: false }],
      summary: { paidCents: 0, outstandingCents: 5000, paidCount: 0, awaitingCount: 1 },
      rolledUp: false,
    });

    const res = await GET(request(), { params });

    expect(res.status).toBe(200);
    expect((await res.json()).summary.outstandingCents).toBe(5000);
    expect(requirePermissionMock).toHaveBeenCalledWith(expect.anything(), "customer_invoices", "select");
    expect(getCustomerInvoicesMock).toHaveBeenCalledWith("cust-1");
  });

  it("returns 403 and never reads invoices when the guard denies (e.g. a technician)", async () => {
    requirePermissionMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 }),
    });

    const res = await GET(request(), { params });

    expect(res.status).toBe(403);
    expect(getCustomerInvoicesMock).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown customer", async () => {
    requirePermissionMock.mockResolvedValue({ ok: true, ctx: { userId: "u1", role: "owner" } });
    getCustomerInvoicesMock.mockResolvedValue(null);
    const res = await GET(request(), { params });
    expect(res.status).toBe(404);
  });
});
