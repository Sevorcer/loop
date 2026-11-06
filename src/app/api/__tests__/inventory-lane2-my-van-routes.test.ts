import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requireApiSession: vi.fn(),
  resolveRequestRole: vi.fn(),
  postTechVanCount: vi.fn(),
  postTechVanRestock: vi.fn(),
}));

vi.mock("@/lib/auth/apiGuard", () => ({
  requireApiSession: m.requireApiSession,
}));
vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, resolveRequestRole: m.resolveRequestRole };
});
vi.mock("@/services/inventoryTechPosts", () => ({
  postTechVanCount: m.postTechVanCount,
  postTechVanRestock: m.postTechVanRestock,
}));

import { POST as postCount } from "@/app/api/inventory/my-van/count/route";
import { POST as postRestock } from "@/app/api/inventory/my-van/restock/route";

function req(url: string, body?: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.requireApiSession.mockResolvedValue({ error: null, user: { id: "tech-1" } });
  m.resolveRequestRole.mockResolvedValue("tech");
  m.postTechVanCount.mockResolvedValue({ posted: 1, skipped: 0, noChange: false });
  m.postTechVanRestock.mockResolvedValue({ posted: 1 });
});

describe("POST /api/inventory/my-van/count", () => {
  it("refuses a role that is not tech and does not post", async () => {
    m.resolveRequestRole.mockResolvedValue("office");
    const res = await postCount(req("http://localhost/api/inventory/my-van/count", { lines: [{ itemId: "cap", countedQty: 1 }] }));
    expect(res.status).toBe(403);
    expect(m.postTechVanCount).not.toHaveBeenCalled();
  });

  it("returns the session error without posting", async () => {
    m.requireApiSession.mockResolvedValue({
      error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
      user: null,
    });
    const res = await postCount(req("http://localhost/api/inventory/my-van/count", { lines: [{ itemId: "cap", countedQty: 1 }] }));
    expect(res.status).toBe(401);
    expect(m.postTechVanCount).not.toHaveBeenCalled();
  });

  it("posts a recount and drops cost from the body", async () => {
    const res = await postCount(
      req("http://localhost/api/inventory/my-van/count", {
        vehicleId: "van-1",
        unitCostCents: 800,
        txn_type: "adjust",
        lines: [{ itemId: "cap", countedQty: 2, unitCostCents: 800 }],
      }),
    );
    expect(res.status).toBe(201);
    expect(m.postTechVanCount).toHaveBeenCalledWith("tech-1", "van-1", [{ itemId: "cap", countedQty: 2 }], null);
  });

  it("returns 200 when the count matches on-hand", async () => {
    m.postTechVanCount.mockResolvedValue({ posted: 0, skipped: 1, noChange: true });
    const res = await postCount(req("http://localhost/api/inventory/my-van/count", { lines: [{ itemId: "cap", countedQty: 1 }] }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/inventory/my-van/restock", () => {
  it("refuses office and does not post", async () => {
    m.resolveRequestRole.mockResolvedValue("office");
    const res = await postRestock(
      req("http://localhost/api/inventory/my-van/restock", { lines: [{ itemId: "cap", qty: 1 }] }),
    );
    expect(res.status).toBe(403);
    expect(m.postTechVanRestock).not.toHaveBeenCalled();
  });

  it("posts item and quantity only, ignoring a client location and cost", async () => {
    const res = await postRestock(
      req("http://localhost/api/inventory/my-van/restock", {
        vehicleId: "van-1",
        lines: [{ itemId: "cap", qty: 2, fromLocationId: "other-van", toLocationId: "also", unitCostCents: 500 }],
      }),
    );
    expect(res.status).toBe(201);
    expect(m.postTechVanRestock).toHaveBeenCalledWith("tech-1", "van-1", [{ itemId: "cap", qty: 2 }]);
  });
});
