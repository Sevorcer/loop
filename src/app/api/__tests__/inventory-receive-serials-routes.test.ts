import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getItem: vi.fn(),
  getLocation: vi.fn(),
  appendLedgerRows: vi.fn(),
  createReceivedUnits: vi.fn(),
  discardUnits: vi.fn(),
  reconcileAfterStockChange: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: m.requirePermission };
});
vi.mock("@/repositories/catalog", () => ({ getItem: m.getItem }));
vi.mock("@/repositories/inventoryLocations", () => ({ getLocation: m.getLocation }));
vi.mock("@/repositories/inventoryLedger", () => ({
  appendLedgerRows: m.appendLedgerRows,
  getOnHand: vi.fn(),
  getTransactionWithGroup: vi.fn(),
  listCountedLocationIds: vi.fn(),
  listStockLevels: vi.fn(),
  listTransactions: vi.fn(),
}));
vi.mock("@/repositories/inventorySerialUnits", () => ({
  createReceivedUnits: m.createReceivedUnits,
  discardUnits: m.discardUnits,
}));
vi.mock("@/services/inventoryReservations", () => ({ reconcileAfterStockChange: m.reconcileAfterStockChange }));

import { POST } from "@/app/api/inventory/transactions/route";

const ITEM = "11111111-1111-4111-8111-111111111111";
const LOC = "22222222-2222-4222-8222-222222222222";

const furnace = { id: ITEM, name: "Furnace 80k", isStockable: true, isActive: true, trackingMode: "serialized", brand: "Bosch", model: "BGH96", mfrPartNumber: null };
const filter = { ...furnace, name: "Filter", trackingMode: "quantity", brand: null, model: null };

function post(body: unknown) {
  return POST(new Request("http://localhost/api/inventory/transactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

const receive = (extra: Record<string, unknown>) => ({ kind: "receive", itemId: ITEM, locationId: LOC, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  m.requirePermission.mockResolvedValue({ ok: true, ctx: { userId: "user-1", role: "office" } });
  m.getLocation.mockResolvedValue({ id: LOC, name: "Shop", isActive: true });
  m.getItem.mockResolvedValue(furnace);
  m.createReceivedUnits.mockImplementation(async (units: { serialNumber: string }[]) =>
    units.map((unit, index) => ({ id: `unit-${index + 1}`, serialNumber: unit.serialNumber })),
  );
  m.appendLedgerRows.mockImplementation(async (rows: unknown[]) => rows.map((row, index) => ({ id: `txn-${index + 1}`, ...(row as object) })));
  m.discardUnits.mockResolvedValue(true);
});

describe("POST /api/inventory/transactions: receive with serials", () => {
  it("keeps the permission gate", async () => {
    m.requirePermission.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) });
    expect((await post(receive({ serialNumbers: ["A1B2C3"] }))).status).toBe(403);
    expect(m.createReceivedUnits).not.toHaveBeenCalled();
  });

  it("creates one in-stock unit and one quantity-1 ledger entry per serial", async () => {
    const response = await post(receive({ serialNumbers: ["SN-0001", "SN-0002"], unitCostCents: 125000 }));
    expect(response.status).toBe(201);
    expect(m.createReceivedUnits).toHaveBeenCalledWith(
      [
        { itemId: ITEM, locationId: LOC, manufacturer: "Bosch", modelNumber: "BGH96", serialNumber: "SN-0001" },
        { itemId: ITEM, locationId: LOC, manufacturer: "Bosch", modelNumber: "BGH96", serialNumber: "SN-0002" },
      ],
      "user-1",
    );
    const rows = m.appendLedgerRows.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ txnType: "receive", qtyDelta: 1, serialUnitId: "unit-1", unitCostCents: 125000 });
    expect(rows[1]).toMatchObject({ qtyDelta: 1, serialUnitId: "unit-2" });
  });

  it("accepts a quantity that matches the serial count and rejects one that does not", async () => {
    expect((await post(receive({ qty: 2, serialNumbers: ["SN-0001", "SN-0002"] }))).status).toBe(201);
    const response = await post(receive({ qty: 3, serialNumbers: ["SN-0001", "SN-0002"] }));
    expect(response.status).toBe(400);
    expect(m.createReceivedUnits).toHaveBeenCalledTimes(1);
  });

  it("requires serial numbers for a serialized item", async () => {
    const response = await post(receive({ qty: 2 }));
    expect(response.status).toBe(400);
    expect(m.createReceivedUnits).not.toHaveBeenCalled();
    expect(m.appendLedgerRows).not.toHaveBeenCalled();
  });

  it("rejects placeholders and repeats instead of guessing", async () => {
    expect((await post(receive({ serialNumbers: ["unknown"] }))).status).toBe(400);
    expect((await post(receive({ serialNumbers: ["SN-0001", "sn-0001"] }))).status).toBe(400);
    expect((await post(receive({ serialNumbers: [] }))).status).toBe(400);
    expect(m.createReceivedUnits).not.toHaveBeenCalled();
  });

  it("answers 409 and posts nothing when a serial is already on file", async () => {
    m.createReceivedUnits.mockRejectedValue(Object.assign(new Error("One of these serial numbers is already on file."), { status: 409 }));
    const response = await post(receive({ serialNumbers: ["SN-0001"] }));
    expect(response.status).toBe(409);
    expect(m.appendLedgerRows).not.toHaveBeenCalled();
  });

  it("discards the new units when the ledger post fails", async () => {
    m.appendLedgerRows.mockRejectedValue(new Error("db down"));
    const response = await post(receive({ serialNumbers: ["SN-0001", "SN-0002"] }));
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(m.discardUnits).toHaveBeenCalledWith(["unit-1", "unit-2"]);
  });

  it("leaves counted items on the quantity path and refuses serials for them", async () => {
    m.getItem.mockResolvedValue(filter);
    expect((await post(receive({ qty: 4 }))).status).toBe(201);
    expect(m.createReceivedUnits).not.toHaveBeenCalled();
    expect(m.appendLedgerRows.mock.calls[0][0]).toHaveLength(1);
    expect((await post(receive({ qty: 1, serialNumbers: ["SN-0001"] }))).status).toBe(400);
  });

  it("still needs qty or serialNumbers", async () => {
    expect((await post(receive({}))).status).toBe(400);
  });
});
