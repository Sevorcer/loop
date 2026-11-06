import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  postOfficeVanCount: vi.fn(),
  postOfficeRestock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: m.requirePermission };
});

vi.mock("@/services/inventoryOfficePosts", () => ({
  postOfficeVanCount: m.postOfficeVanCount,
  postOfficeRestock: m.postOfficeRestock,
}));

import { POST as postCount } from "@/app/api/inventory/vans/[vehicleId]/count/route";
import { POST as postRestock } from "@/app/api/inventory/restock/route";

const allow = (role = "office") => ({ ok: true as const, ctx: { userId: "user-1", role } });
const deny = () => ({
  ok: false as const,
  response: NextResponse.json({ error: "FORBIDDEN", code: 403 }, { status: 403 }),
});

function req(url: string, body?: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.postOfficeVanCount.mockResolvedValue({ posted: 1, skipped: 0, noChange: false, countedIn: true });
  m.postOfficeRestock.mockResolvedValue({ posted: 1 });
});

describe("POST /api/inventory/vans/[vehicleId]/count", () => {
  const context = { params: Promise.resolve({ vehicleId: "van-1" }) };

  it("requires a ledger insert and does not count on 403", async () => {
    m.requirePermission.mockResolvedValue(deny());
    const res = await postCount(req("http://localhost/api/inventory/vans/van-1/count", { lines: [{ itemId: "a", countedQty: 1 }] }), context);
    expect(res.status).toBe(403);
    expect(m.requirePermission).toHaveBeenCalledWith(expect.any(Request), "inventory_transactions", "insert");
    expect(m.postOfficeVanCount).not.toHaveBeenCalled();
  });

  it("posts the office count for the van in the path", async () => {
    m.requirePermission.mockResolvedValue(allow("manager"));
    const res = await postCount(
      req("http://localhost/api/inventory/vans/van-1/count", {
        lines: [{ itemId: "a", countedQty: 2 }],
        reason: "Initial count-in",
        unitCostCents: 800,
      }),
      context,
    );
    expect(res.status).toBe(201);
    expect(m.postOfficeVanCount).toHaveBeenCalledWith("van-1", [{ itemId: "a", countedQty: 2 }], "Initial count-in", "user-1");
  });

  it("returns 200 when every line matches on-hand", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.postOfficeVanCount.mockResolvedValue({ posted: 0, skipped: 1, noChange: true, countedIn: false });
    const res = await postCount(req("http://localhost/api/inventory/vans/van-1/count", { lines: [{ itemId: "a", countedQty: 0 }] }), context);
    expect(res.status).toBe(200);
  });

  it("rejects an empty sheet before the service runs", async () => {
    m.requirePermission.mockResolvedValue(allow());
    const res = await postCount(req("http://localhost/api/inventory/vans/van-1/count", { lines: [] }), context);
    expect(res.status).toBe(400);
    expect(m.postOfficeVanCount).not.toHaveBeenCalled();
  });
});

describe("POST /api/inventory/restock", () => {
  it("requires a ledger insert and does not pull on 403", async () => {
    m.requirePermission.mockResolvedValue(deny());
    const res = await postRestock(
      req("http://localhost/api/inventory/restock", {
        lines: [{ itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 1 }],
      }),
    );
    expect(res.status).toBe(403);
    expect(m.requirePermission).toHaveBeenCalledWith(expect.any(Request), "inventory_transactions", "insert");
    expect(m.postOfficeRestock).not.toHaveBeenCalled();
  });

  it("posts the checked lines and does not forward a client reason or cost", async () => {
    m.requirePermission.mockResolvedValue(allow("owner"));
    const res = await postRestock(
      req("http://localhost/api/inventory/restock", {
        reason: "Something else",
        lines: [{ itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 2, unitCostCents: 500 }],
      }),
    );
    expect(res.status).toBe(201);
    expect(m.postOfficeRestock).toHaveBeenCalledWith(
      [{ itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 2 }],
      "user-1",
    );
  });

  it("rejects a zero quantity before the service runs", async () => {
    m.requirePermission.mockResolvedValue(allow());
    const res = await postRestock(
      req("http://localhost/api/inventory/restock", {
        lines: [{ itemId: "a", fromLocationId: "shop", toLocationId: "van", qty: 0 }],
      }),
    );
    expect(res.status).toBe(400);
    expect(m.postOfficeRestock).not.toHaveBeenCalled();
  });
});
