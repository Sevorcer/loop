import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listSerialUnits: vi.fn(),
  getSerialUnit: vi.fn(),
  listSerialReviewQueue: vi.fn(),
  clearSerialUnitReview: vi.fn(),
  scrapDetachedUnit: vi.fn(),
  getInstalledSystemSerials: vi.fn(),
  setInstalledSystemSerials: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: m.requirePermission };
});
vi.mock("@/repositories/inventorySerialUnits", () => ({
  listSerialUnits: m.listSerialUnits,
  getSerialUnit: m.getSerialUnit,
  listSerialReviewQueue: m.listSerialReviewQueue,
  clearSerialUnitReview: m.clearSerialUnitReview,
  scrapDetachedUnit: m.scrapDetachedUnit,
}));
vi.mock("@/repositories/installedSystems", () => ({
  getInstalledSystemSerials: m.getInstalledSystemSerials,
  setInstalledSystemSerials: m.setInstalledSystemSerials,
}));

import { GET as listRoute } from "@/app/api/inventory/serials/route";
import { GET as reviewRoute } from "@/app/api/inventory/serials/review/route";
import { PATCH as resolveRoute } from "@/app/api/inventory/serials/[id]/route";

const UNIT = "11111111-1111-4111-8111-111111111111";
const SYSTEM = "22222222-2222-4222-8222-222222222222";

const allow = (role = "office") => ({ ok: true as const, ctx: { userId: "user-1", role } });
const deny = (status: 401 | 403) => ({
  ok: false as const,
  response: NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", code: status }, { status }),
});

function req(method: string, body?: unknown, url = "http://localhost/api/inventory/serials") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id = UNIT) => ({ params: Promise.resolve({ id }) });

const flaggedUnit = {
  id: UNIT,
  itemId: null,
  manufacturer: "Bosch",
  modelNumber: "B1",
  serialNumber: "DUP-1",
  status: "installed",
  locationId: null,
  installedSystemId: SYSTEM,
  source: "backfill",
  needsReview: true,
  reviewReason: "duplicate_serial",
  createdAt: "2026-11-11T00:00:00Z",
  updatedAt: "2026-11-11T00:00:00Z",
};

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset());
  m.requirePermission.mockResolvedValue(allow());
});

describe("serial routes: permission gate", () => {
  it.each([
    ["list GET", () => listRoute(req("GET")), "inventory_serial_units", "select"],
    ["review GET", () => reviewRoute(req("GET")), "inventory_serial_units", "update"],
    ["resolve PATCH", () => resolveRoute(req("PATCH", { action: "keep" }), ctx()), "inventory_serial_units", "update"],
  ] as const)("%s checks %s %s and stops on 401/403 before any data call", async (_name, call, table, action) => {
    for (const status of [401, 403] as const) {
      m.requirePermission.mockResolvedValueOnce(deny(status));
      const response = await call();
      expect(response.status).toBe(status);
    }
    expect(m.requirePermission).toHaveBeenNthCalledWith(1, expect.any(Request), table, action);
    expect(m.listSerialUnits).not.toHaveBeenCalled();
    expect(m.listSerialReviewQueue).not.toHaveBeenCalled();
    expect(m.getSerialUnit).not.toHaveBeenCalled();
    expect(m.setInstalledSystemSerials).not.toHaveBeenCalled();
  });
});

describe("GET /api/inventory/serials", () => {
  it("passes filters through and returns units", async () => {
    m.listSerialUnits.mockResolvedValue([flaggedUnit]);
    const response = await listRoute(
      req("GET", undefined, `http://localhost/api/inventory/serials?status=installed&needsReview=1&search=dup&limit=25&installedSystemId=${SYSTEM}`),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ units: [flaggedUnit] });
    expect(m.listSerialUnits).toHaveBeenCalledWith({
      status: "installed",
      needsReview: true,
      search: "dup",
      limit: 25,
      installedSystemId: SYSTEM,
    });
  });

  it("rejects an unknown status", async () => {
    const response = await listRoute(req("GET", undefined, "http://localhost/api/inventory/serials?status=lost"));
    expect(response.status).toBe(400);
    expect(m.listSerialUnits).not.toHaveBeenCalled();
  });
});

describe("GET /api/inventory/serials/review", () => {
  it("returns the review rows", async () => {
    const rows = [
      { reason: "duplicate_serial", serialUnitId: UNIT, installedSystemId: SYSTEM, manufacturer: "Bosch", modelNumber: "B1", serialNumber: "DUP-1" },
    ];
    m.listSerialReviewQueue.mockResolvedValue(rows);
    const response = await reviewRoute(req("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows });
  });
});

describe("PATCH /api/inventory/serials/[id]", () => {
  it("keep clears the flag and does not ask for the installed-systems permission", async () => {
    m.getSerialUnit.mockResolvedValue(flaggedUnit);
    m.clearSerialUnitReview.mockResolvedValue({ ...flaggedUnit, needsReview: false, reviewReason: null });

    const response = await resolveRoute(req("PATCH", { action: "keep" }), ctx());

    expect(response.status).toBe(200);
    expect(m.clearSerialUnitReview).toHaveBeenCalledWith(UNIT);
    expect(m.requirePermission).toHaveBeenCalledTimes(1);
    expect(m.setInstalledSystemSerials).not.toHaveBeenCalled();
  });

  it("keep reports a conflict while another unit holds the serial", async () => {
    m.getSerialUnit.mockResolvedValue(flaggedUnit);
    m.clearSerialUnitReview.mockRejectedValue(
      Object.assign(new Error("Another unit already holds this serial. Resolve that one first."), { status: 409 }),
    );
    const response = await resolveRoute(req("PATCH", { action: "keep" }), ctx());
    expect(response.status).toBe(409);
  });

  it("correct swaps the serial in the system list, keeps placeholders, and also needs installed_systems update", async () => {
    m.getSerialUnit.mockResolvedValue(flaggedUnit);
    m.getInstalledSystemSerials.mockResolvedValue(["unknown", "DUP-1"]);
    m.setInstalledSystemSerials.mockResolvedValue(["unknown", "DUP-2"]);
    m.listSerialUnits.mockResolvedValue([{ ...flaggedUnit, serialNumber: "DUP-2", needsReview: false, reviewReason: null }]);

    const response = await resolveRoute(req("PATCH", { action: "correct", serialNumber: " DUP-2 " }), ctx());

    expect(response.status).toBe(200);
    expect(m.requirePermission).toHaveBeenNthCalledWith(2, expect.any(Request), "installed_systems", "update");
    expect(m.setInstalledSystemSerials).toHaveBeenCalledWith(SYSTEM, ["unknown", "DUP-2"]);
    expect(m.listSerialUnits).toHaveBeenCalledWith({ installedSystemId: SYSTEM });
  });

  it("remove takes the serial off the system", async () => {
    m.getSerialUnit.mockResolvedValue(flaggedUnit);
    m.getInstalledSystemSerials.mockResolvedValue(["DUP-1"]);
    m.setInstalledSystemSerials.mockResolvedValue([]);
    m.listSerialUnits.mockResolvedValue([]);

    const response = await resolveRoute(req("PATCH", { action: "remove" }), ctx());

    expect(response.status).toBe(200);
    expect(m.setInstalledSystemSerials).toHaveBeenCalledWith(SYSTEM, []);
  });

  it("correct and remove stop when the installed_systems permission is denied", async () => {
    m.requirePermission.mockResolvedValueOnce(allow()).mockResolvedValueOnce(deny(403));
    const response = await resolveRoute(req("PATCH", { action: "remove" }), ctx());
    expect(response.status).toBe(403);
    expect(m.getSerialUnit).not.toHaveBeenCalled();
    expect(m.setInstalledSystemSerials).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown action", { action: "merge" }],
    ["correct without a serial", { action: "correct" }],
    ["correct with a placeholder", { action: "correct", serialNumber: "unknown" }],
  ])("returns 400 for %s and writes nothing", async (_name, body) => {
    const response = await resolveRoute(req("PATCH", body), ctx());
    expect(response.status).toBe(400);
    expect(m.setInstalledSystemSerials).not.toHaveBeenCalled();
    expect(m.clearSerialUnitReview).not.toHaveBeenCalled();
  });

  it("returns 404 when the unit does not exist", async () => {
    m.getSerialUnit.mockResolvedValue(null);
    const response = await resolveRoute(req("PATCH", { action: "keep" }), ctx());
    expect(response.status).toBe(404);
  });

  it("returns 400 when the unit is not flagged", async () => {
    m.getSerialUnit.mockResolvedValue({ ...flaggedUnit, needsReview: false, reviewReason: null });
    const response = await resolveRoute(req("PATCH", { action: "keep" }), ctx());
    expect(response.status).toBe(400);
    expect(m.clearSerialUnitReview).not.toHaveBeenCalled();
  });

  it("returns 400 when correcting to the serial the system already has", async () => {
    m.getSerialUnit.mockResolvedValue(flaggedUnit);
    const response = await resolveRoute(req("PATCH", { action: "correct", serialNumber: "dup-1" }), ctx());
    expect(response.status).toBe(400);
    expect(m.setInstalledSystemSerials).not.toHaveBeenCalled();
  });

  it("returns 400 when the unit is not attached to a system", async () => {
    m.getSerialUnit.mockResolvedValue({ ...flaggedUnit, installedSystemId: null });
    const response = await resolveRoute(req("PATCH", { action: "remove" }), ctx());
    expect(response.status).toBe(400);
    expect(m.setInstalledSystemSerials).not.toHaveBeenCalled();
  });

  it("returns 404 when the system cannot be found", async () => {
    m.getSerialUnit.mockResolvedValue(flaggedUnit);
    m.getInstalledSystemSerials.mockResolvedValue(null);
    const response = await resolveRoute(req("PATCH", { action: "remove" }), ctx());
    expect(response.status).toBe(404);
    expect(m.setInstalledSystemSerials).not.toHaveBeenCalled();
  });

  it("scrap writes off a detached unit and needs only the serial-unit permission", async () => {
    const detached = { ...flaggedUnit, needsReview: false, reviewReason: null, installedSystemId: null };
    m.getSerialUnit.mockResolvedValue(detached);
    m.scrapDetachedUnit.mockResolvedValue({ ...detached, status: "scrapped" });
    const response = await resolveRoute(req("PATCH", { action: "scrap" }), ctx());
    expect(response.status).toBe(200);
    expect(m.scrapDetachedUnit).toHaveBeenCalledWith(UNIT);
    expect(m.requirePermission).toHaveBeenCalledTimes(1);
    expect(m.requirePermission.mock.calls[0].slice(1)).toEqual(["inventory_serial_units", "update"]);
  });

  it("scrap refuses a unit that is not detached (stale click) and changes nothing", async () => {
    m.getSerialUnit.mockResolvedValue(flaggedUnit);
    m.scrapDetachedUnit.mockResolvedValue(null);
    const response = await resolveRoute(req("PATCH", { action: "scrap" }), ctx());
    expect(response.status).toBe(400);
  });

  it("scrap returns 404 for an unknown unit", async () => {
    m.getSerialUnit.mockResolvedValue(null);
    expect((await resolveRoute(req("PATCH", { action: "scrap" }), ctx())).status).toBe(404);
    expect(m.scrapDetachedUnit).not.toHaveBeenCalled();
  });
});
