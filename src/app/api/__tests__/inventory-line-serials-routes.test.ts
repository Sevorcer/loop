import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listLinePicks: vi.fn(),
  createLinePick: vi.fn(),
  deleteLinePick: vi.fn(),
  listPickedUnitIds: vi.fn(),
  listSerialUnits: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: m.requirePermission };
});
vi.mock("@/repositories/inventoryLineSerials", () => ({
  listLinePicks: m.listLinePicks,
  createLinePick: m.createLinePick,
  deleteLinePick: m.deleteLinePick,
  listPickedUnitIds: m.listPickedUnitIds,
}));
vi.mock("@/repositories/inventorySerialUnits", () => ({ listSerialUnits: m.listSerialUnits }));

import { DELETE as releaseRoute } from "@/app/api/inventory/line-serials/[unitId]/route";
import { GET as listRoute, POST as pickRoute } from "@/app/api/inventory/line-serials/route";
import { listPickableUnits } from "@/services/inventoryLineSerials";

const LINE = "11111111-1111-4111-8111-111111111111";
const UNIT = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";

const allow = () => ({ ok: true as const, ctx: { userId: "user-1", role: "office" } });
const deny = (status: 401 | 403) => ({
  ok: false as const,
  response: NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", code: status }, { status }),
});

function req(method: string, body?: unknown, url = "http://localhost/api/inventory/line-serials") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const unitCtx = (unitId = UNIT) => ({ params: Promise.resolve({ unitId }) });

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.requirePermission.mockResolvedValue(allow());
});

describe("line serial routes: permission gate", () => {
  it.each([
    ["list GET", () => listRoute(req("GET", undefined, `http://localhost/api/inventory/line-serials?lineIds=${LINE}`)), "select"],
    ["pick POST", () => pickRoute(req("POST", { lineId: LINE, serialUnitId: UNIT })), "insert"],
    ["release DELETE", () => releaseRoute(req("DELETE"), unitCtx()), "delete"],
  ] as const)("%s checks job_material_line_serials %s and stops on 401/403", async (_name, call, action) => {
    for (const status of [401, 403] as const) {
      m.requirePermission.mockResolvedValueOnce(deny(status));
      expect((await call()).status).toBe(status);
    }
    expect(m.requirePermission).toHaveBeenNthCalledWith(1, expect.any(Request), "job_material_line_serials", action);
    expect(m.listLinePicks).not.toHaveBeenCalled();
    expect(m.createLinePick).not.toHaveBeenCalled();
    expect(m.deleteLinePick).not.toHaveBeenCalled();
  });
});

describe("GET /api/inventory/line-serials", () => {
  it("returns the picks for the lines asked about", async () => {
    m.listLinePicks.mockResolvedValue([{ lineId: LINE, serialUnitId: UNIT, serialNumber: "SN-1", locationId: null, status: "in_stock" }]);
    const response = await listRoute(req("GET", undefined, `http://localhost/api/inventory/line-serials?lineIds=${LINE}`));
    expect(response.status).toBe(200);
    expect((await response.json()).picks).toHaveLength(1);
    expect(m.listLinePicks).toHaveBeenCalledWith([LINE]);
  });

  it("needs line ids and refuses malformed ones", async () => {
    expect((await listRoute(req("GET"))).status).toBe(400);
    expect((await listRoute(req("GET", undefined, "http://localhost/api/inventory/line-serials?lineIds=nope"))).status).toBe(400);
    expect(m.listLinePicks).not.toHaveBeenCalled();
  });
});

describe("POST /api/inventory/line-serials", () => {
  it("picks a unit for a line as the signed-in user", async () => {
    m.createLinePick.mockResolvedValue(undefined);
    const response = await pickRoute(req("POST", { lineId: LINE, serialUnitId: UNIT }));
    expect(response.status).toBe(201);
    expect(m.createLinePick).toHaveBeenCalledWith(LINE, UNIT, "user-1");
  });

  it("validates both ids before touching the database", async () => {
    expect((await pickRoute(req("POST", { serialUnitId: UNIT }))).status).toBe(400);
    expect((await pickRoute(req("POST", { lineId: LINE, serialUnitId: "x" }))).status).toBe(400);
    expect(m.createLinePick).not.toHaveBeenCalled();
  });

  it("passes the database guard's refusal through as 400 and a taken unit as 409", async () => {
    m.createLinePick.mockRejectedValueOnce(Object.assign(new Error("this line already has all of its units picked"), { status: 400 }));
    const full = await pickRoute(req("POST", { lineId: LINE, serialUnitId: UNIT }));
    expect(full.status).toBe(400);
    expect(JSON.stringify(await full.json())).toContain("all of its units");

    m.createLinePick.mockRejectedValueOnce(Object.assign(new Error("That unit is already picked for a material line."), { status: 409 }));
    expect((await pickRoute(req("POST", { lineId: LINE, serialUnitId: UNIT }))).status).toBe(409);
  });
});

describe("DELETE /api/inventory/line-serials/[unitId]", () => {
  it("releases a picked unit", async () => {
    m.deleteLinePick.mockResolvedValue(true);
    expect((await releaseRoute(req("DELETE"), unitCtx())).status).toBe(200);
    expect(m.deleteLinePick).toHaveBeenCalledWith(UNIT);
  });

  it("returns 404 when the unit was not picked and 400 for a bad id", async () => {
    m.deleteLinePick.mockResolvedValue(false);
    expect((await releaseRoute(req("DELETE"), unitCtx())).status).toBe(404);
    expect((await releaseRoute(req("DELETE"), unitCtx("nope"))).status).toBe(400);
  });
});

describe("listPickableUnits", () => {
  it("offers in-stock, unflagged units that no line has taken, in serial order", async () => {
    m.listSerialUnits.mockResolvedValue([
      { id: "u-b", serialNumber: "SN-B" },
      { id: "u-a", serialNumber: "SN-A" },
      { id: "u-taken", serialNumber: "SN-C" },
    ]);
    m.listPickedUnitIds.mockResolvedValue(new Set(["u-taken"]));
    expect(await listPickableUnits(ITEM)).toEqual([
      { id: "u-a", serialNumber: "SN-A" },
      { id: "u-b", serialNumber: "SN-B" },
    ]);
    expect(m.listSerialUnits).toHaveBeenCalledWith({ itemId: ITEM, status: "in_stock", needsReview: false, limit: 200 });
  });
});
