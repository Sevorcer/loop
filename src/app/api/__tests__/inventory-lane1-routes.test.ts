import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  postLedgerCommand: vi.fn(),
  listLedger: vi.fn(),
  listStockLevels: vi.fn(),
  createVehicle: vi.fn(),
  createLocation: vi.fn(),
  createCategory: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: m.requirePermission };
});

vi.mock("@/services/inventoryLedger", async () => {
  const actual = await vi.importActual<typeof import("@/services/inventoryLedger")>("@/services/inventoryLedger");
  return { ...actual, postLedgerCommand: m.postLedgerCommand, listLedger: m.listLedger, listStockLevels: m.listStockLevels };
});

vi.mock("@/services/inventoryLocations", async () => {
  const actual = await vi.importActual<typeof import("@/services/inventoryLocations")>("@/services/inventoryLocations");
  return { ...actual, createVehicle: m.createVehicle, createLocation: m.createLocation };
});

vi.mock("@/services/inventoryCatalog", async () => {
  const actual = await vi.importActual<typeof import("@/services/inventoryCatalog")>("@/services/inventoryCatalog");
  return { ...actual, createCategory: m.createCategory };
});

import { GET as getStock } from "@/app/api/inventory/stock/route";
import { GET as getTxns, POST as postTxn } from "@/app/api/inventory/transactions/route";
import { POST as postVehicle } from "@/app/api/inventory/vehicles/route";
import { POST as postLocation } from "@/app/api/inventory/locations/route";
import { POST as postCategory } from "@/app/api/inventory/categories/route";

const allow = (role = "office", userId = "user-1") => ({ ok: true as const, ctx: { userId, role } });
const deny = (status: 401 | 403) => ({
  ok: false as const,
  response: NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", code: status }, { status }),
});

function req(method: string, body?: unknown, url = "http://localhost/api/inventory/x") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
});

describe("inventory Lane 1 routes: permission gate", () => {
  it.each([
    ["stock GET", () => getStock(req("GET")), "inventory_stock_levels", "select"],
    ["transactions GET", () => getTxns(req("GET")), "inventory_transactions", "select"],
    ["transactions POST", () => postTxn(req("POST", {})), "inventory_transactions", "insert"],
    ["vehicles POST", () => postVehicle(req("POST", {})), "vehicles", "insert"],
    ["locations POST", () => postLocation(req("POST", {})), "inventory_locations", "insert"],
    ["categories POST", () => postCategory(req("POST", {})), "catalog_categories", "insert"],
  ])("%s asks for the right table and action and stops on 403", async (_label, call, table, action) => {
    m.requirePermission.mockResolvedValue(deny(403));
    const res = await call();
    expect(res.status).toBe(403);
    expect(m.requirePermission).toHaveBeenCalledWith(expect.any(Request), table, action);
    expect(m.postLedgerCommand).not.toHaveBeenCalled();
    expect(m.createVehicle).not.toHaveBeenCalled();
  });

  it("returns 401 untouched when there is no session", async () => {
    m.requirePermission.mockResolvedValue(deny(401));
    expect((await postTxn(req("POST", {}))).status).toBe(401);
  });
});

describe("POST /api/inventory/transactions", () => {
  it("rejects an unknown command kind with 400 and posts nothing", async () => {
    m.requirePermission.mockResolvedValue(allow());
    const res = await postTxn(req("POST", { kind: "teleport" }));
    expect(res.status).toBe(400);
    expect(m.postLedgerCommand).not.toHaveBeenCalled();
  });

  it("uses the session user as the actor, never a created_by from the body", async () => {
    m.requirePermission.mockResolvedValue(allow("office", "session-user"));
    m.postLedgerCommand.mockResolvedValue({ entries: [], noChange: false });
    const res = await postTxn(
      req("POST", { kind: "receive", itemId: "i1", locationId: "l1", qty: 5, createdBy: "someone-else", created_by: "x" }),
    );
    expect(res.status).toBe(201);
    expect(m.postLedgerCommand).toHaveBeenCalledTimes(1);
    expect(m.postLedgerCommand.mock.calls[0][1]).toBe("session-user");
  });

  it("answers 200 when a count matched on-hand and nothing was posted", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.postLedgerCommand.mockResolvedValue({ entries: [], noChange: true });
    const res = await postTxn(req("POST", { kind: "count", itemId: "i1", locationId: "l1", countedQty: 3 }));
    expect(res.status).toBe(200);
    expect((await res.json()).noChange).toBe(true);
  });

  it("maps a service-thrown status 400 to a 400 response", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.postLedgerCommand.mockRejectedValue(Object.assign(new Error("Item is not stockable."), { status: 400 }));
    const res = await postTxn(req("POST", { kind: "receive", itemId: "i1", locationId: "l1", qty: 1 }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/inventory/locations", () => {
  it("refuses van and job types: those are created with a vehicle or by a job", async () => {
    m.requirePermission.mockResolvedValue(allow());
    for (const type of ["van", "job", "nope"]) {
      const res = await postLocation(req("POST", { name: "X", type }));
      expect(res.status).toBe(400);
    }
    expect(m.createLocation).not.toHaveBeenCalled();
  });

  it("creates a warehouse", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.createLocation.mockResolvedValue({ id: "l1", type: "warehouse", name: "Main" });
    const res = await postLocation(req("POST", { name: "Main", type: "warehouse" }));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/inventory/vehicles", () => {
  it("requires a name and rejects a bad status", async () => {
    m.requirePermission.mockResolvedValue(allow());
    expect((await postVehicle(req("POST", { plate: "ABC" }))).status).toBe(400);
    expect((await postVehicle(req("POST", { name: "Van 1", status: "flying" }))).status).toBe(400);
    expect(m.createVehicle).not.toHaveBeenCalled();
  });

  it("creates a vehicle only from what the request sends", async () => {
    m.requirePermission.mockResolvedValue(allow());
    m.createVehicle.mockResolvedValue({ vehicle: { id: "v1" }, location: { id: "l1" } });
    const res = await postVehicle(req("POST", { name: "Van 1", plate: "ABC123" }));
    expect(res.status).toBe(201);
    expect(m.createVehicle).toHaveBeenCalledWith(expect.objectContaining({ name: "Van 1", plate: "ABC123" }));
  });
});
