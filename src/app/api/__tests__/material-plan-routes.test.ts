import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getMaterialPlanView: vi.fn(),
  generateMaterialPlan: vi.fn(),
  confirmMaterialPlan: vi.fn(),
  reopenMaterialPlan: vi.fn(),
  attachKitToJob: vi.fn(),
  refreshJobKit: vi.fn(),
  adjustPlanLine: vi.fn(),
  linkPlanLineToItem: vi.fn(),
  markPlanLineNotStock: vi.fn(),
  removePlanLine: vi.fn(),
  getMaterialPlanHistory: vi.fn(),
  getNeedsSkuQueue: vi.fn(),
  saveJobMaterialsAsKit: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: m.requirePermission };
});
vi.mock("@/services/materialPlans", () => ({
  getMaterialPlanView: m.getMaterialPlanView,
  generateMaterialPlan: m.generateMaterialPlan,
  confirmMaterialPlan: m.confirmMaterialPlan,
  reopenMaterialPlan: m.reopenMaterialPlan,
  attachKitToJob: m.attachKitToJob,
  refreshJobKit: m.refreshJobKit,
  adjustPlanLine: m.adjustPlanLine,
  linkPlanLineToItem: m.linkPlanLineToItem,
  markPlanLineNotStock: m.markPlanLineNotStock,
  removePlanLine: m.removePlanLine,
  getMaterialPlanHistory: m.getMaterialPlanHistory,
  getNeedsSkuQueue: m.getNeedsSkuQueue,
  saveJobMaterialsAsKit: m.saveJobMaterialsAsKit,
}));

import { GET as getPlan, PATCH as patchPlan, POST as postPlan } from "@/app/api/jobs/[id]/material-plan/route";
import { POST as attachKit } from "@/app/api/jobs/[id]/material-plan/kits/route";
import { POST as refreshKit } from "@/app/api/jobs/[id]/material-plan/kits/[kitId]/route";
import { PATCH as patchLine } from "@/app/api/jobs/[id]/material-plan/lines/[lineId]/route";
import { GET as getHistory } from "@/app/api/jobs/[id]/material-plan/history/route";
import { POST as saveAsKit } from "@/app/api/jobs/[id]/material-plan/save-as-kit/route";
import { GET as getNeedsSku } from "@/app/api/inventory/needs-sku/route";

const JOB = "11111111-1111-4111-8111-111111111111";
const KIT = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";
const ITEM = "44444444-4444-4444-8444-444444444444";

const allow = (role = "office") => ({ ok: true as const, ctx: { userId: "user-1", role } });
const deny = (status: 401 | 403) => ({
  ok: false as const,
  response: NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", code: status }, { status }),
});

function req(method: string, body?: unknown) {
  return new Request("http://localhost/api/x", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const job = { params: Promise.resolve({ id: JOB }) };
const jobKit = { params: Promise.resolve({ id: JOB, kitId: KIT }) };
const jobLine = { params: Promise.resolve({ id: JOB, lineId: LINE }) };

const view = { plan: null, lines: [], kits: [], needsSkuCount: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  m.requirePermission.mockResolvedValue(allow());
  m.getMaterialPlanView.mockResolvedValue(view);
});

describe("GET /material-plan", () => {
  it("returns the plan view under job_material_plans/select", async () => {
    const res = await getPlan(req("GET"), job);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(view);
    expect(m.requirePermission).toHaveBeenCalledWith(expect.anything(), "job_material_plans", "select");
    expect(m.getMaterialPlanView).toHaveBeenCalledWith(JOB);
  });

  it("passes the guard's refusal through", async () => {
    m.requirePermission.mockResolvedValue(deny(403));
    expect((await getPlan(req("GET"), job)).status).toBe(403);
    expect(m.getMaterialPlanView).not.toHaveBeenCalled();
  });
});

describe("POST /material-plan (generate)", () => {
  it("generates from the estimate and kits and returns the new view", async () => {
    m.generateMaterialPlan.mockResolvedValue({ planId: "p1", added: 3, skipped: 0, nonProductSkipped: 1, needsSku: 1 });
    const res = await postPlan(req("POST", { kits: [{ kitId: KIT, multiplier: 2 }] }), job);
    expect(res.status).toBe(201);
    expect(m.generateMaterialPlan).toHaveBeenCalledWith(
      JOB,
      { includeEstimate: undefined, kits: [{ kitId: KIT, multiplier: 2 }] },
      "user-1",
    );
    expect((await res.json()).summary.added).toBe(3);
  });

  it("refuses tech and rejects a non-boolean includeEstimate", async () => {
    m.requirePermission.mockResolvedValue(allow("tech"));
    expect((await postPlan(req("POST", {}), job)).status).toBe(403);
    m.requirePermission.mockResolvedValue(allow("office"));
    expect((await postPlan(req("POST", { includeEstimate: "yes" }), job)).status).toBe(400);
    expect(m.generateMaterialPlan).not.toHaveBeenCalled();
  });

  it("rejects a malformed kit list and bad JSON", async () => {
    expect((await postPlan(req("POST", { kits: [{ kitId: "nope" }] }), job)).status).toBe(400);
    const bad = new Request("http://localhost/api/x", { method: "POST", body: "{" });
    expect((await postPlan(bad, job)).status).toBe(400);
  });

  it("surfaces service validation errors as 400", async () => {
    m.generateMaterialPlan.mockRejectedValue(Object.assign(new Error("Pick the estimate, a kit, or both."), { status: 400 }));
    const res = await postPlan(req("POST", { includeEstimate: false }), job);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /material-plan (confirm / reopen)", () => {
  it("confirms and reopens", async () => {
    expect((await patchPlan(req("PATCH", { status: "confirmed" }), job)).status).toBe(200);
    expect(m.confirmMaterialPlan).toHaveBeenCalledWith(JOB, "user-1");
    expect((await patchPlan(req("PATCH", { status: "draft" }), job)).status).toBe(200);
    expect(m.reopenMaterialPlan).toHaveBeenCalledWith(JOB, "user-1");
  });

  it("keeps sales and tech out and validates status", async () => {
    for (const role of ["sales", "tech"]) {
      m.requirePermission.mockResolvedValue(allow(role));
      expect((await patchPlan(req("PATCH", { status: "confirmed" }), job)).status).toBe(403);
    }
    m.requirePermission.mockResolvedValue(allow("owner"));
    expect((await patchPlan(req("PATCH", { status: "done" }), job)).status).toBe(400);
    expect(m.confirmMaterialPlan).not.toHaveBeenCalled();
  });
});

describe("kits", () => {
  it("attaches a kit with a multiplier", async () => {
    m.attachKitToJob.mockResolvedValue({ planId: "p1", added: 2, skipped: 0, nonProductSkipped: 0, needsSku: 0 });
    const res = await attachKit(req("POST", { kitId: KIT, multiplier: 2 }), job);
    expect(res.status).toBe(201);
    expect(m.attachKitToJob).toHaveBeenCalledWith(JOB, { kitId: KIT, multiplier: 2 }, "user-1");
  });

  it("reports a duplicate attach as 409 and a bad kit id as 400", async () => {
    m.attachKitToJob.mockRejectedValue(Object.assign(new Error("already on this job"), { status: 409 }));
    expect((await attachKit(req("POST", { kitId: KIT }), job)).status).toBe(409);
    expect((await attachKit(req("POST", { kitId: "x" }), job)).status).toBe(400);
  });

  it("refreshes an attached kit and returns the counts", async () => {
    m.refreshJobKit.mockResolvedValue({ added: 1, updated: 2, skipped: 3 });
    const res = await refreshKit(req("POST"), jobKit);
    expect(res.status).toBe(200);
    expect((await res.json()).result).toEqual({ added: 1, updated: 2, skipped: 3 });
    expect(m.refreshJobKit).toHaveBeenCalledWith(JOB, KIT, "user-1");
  });

  it("refuses tech on both", async () => {
    m.requirePermission.mockResolvedValue(allow("tech"));
    expect((await attachKit(req("POST", { kitId: KIT }), job)).status).toBe(403);
    expect((await refreshKit(req("POST"), jobKit)).status).toBe(403);
  });
});

describe("PATCH /material-plan/lines/[lineId]", () => {
  it("adjusts a line, passing the whole body so the service can read the reason", async () => {
    const body = { action: "adjust", quantity: 3, reason: "Longer run" };
    expect((await patchLine(req("PATCH", body), jobLine)).status).toBe(200);
    expect(m.adjustPlanLine).toHaveBeenCalledWith(JOB, LINE, body, "user-1");
  });

  it("removes a line with a reason", async () => {
    expect((await patchLine(req("PATCH", { action: "remove", reason: "Customer declined" }), jobLine)).status).toBe(200);
    expect(m.removePlanLine).toHaveBeenCalledWith(JOB, LINE, "Customer declined", "user-1");
  });

  it("links and marks not-stock only for owner/manager/office", async () => {
    expect((await patchLine(req("PATCH", { action: "link", catalogItemId: ITEM }), jobLine)).status).toBe(200);
    expect(m.linkPlanLineToItem).toHaveBeenCalledWith(JOB, LINE, ITEM, true);
    expect((await patchLine(req("PATCH", { action: "link", catalogItemId: ITEM, writeAlias: false }), jobLine)).status).toBe(200);
    expect(m.linkPlanLineToItem).toHaveBeenLastCalledWith(JOB, LINE, ITEM, false);
    expect((await patchLine(req("PATCH", { action: "not_stock", reason: "Bought on site" }), jobLine)).status).toBe(200);
    expect(m.markPlanLineNotStock).toHaveBeenCalledWith(JOB, LINE, "Bought on site");

    for (const role of ["dispatch", "sales"]) {
      m.requirePermission.mockResolvedValue(allow(role));
      expect((await patchLine(req("PATCH", { action: "link", catalogItemId: ITEM }), jobLine)).status).toBe(403);
      expect((await patchLine(req("PATCH", { action: "not_stock", reason: "x" }), jobLine)).status).toBe(403);
    }
  });

  it("still lets dispatch and sales adjust and remove", async () => {
    for (const role of ["dispatch", "sales"]) {
      m.requirePermission.mockResolvedValue(allow(role));
      expect((await patchLine(req("PATCH", { action: "adjust", notes: "n" }), jobLine)).status).toBe(200);
    }
  });

  it("refuses tech and unknown actions", async () => {
    m.requirePermission.mockResolvedValue(allow("tech"));
    expect((await patchLine(req("PATCH", { action: "adjust", quantity: 2 }), jobLine)).status).toBe(403);
    m.requirePermission.mockResolvedValue(allow("office"));
    expect((await patchLine(req("PATCH", { action: "explode" }), jobLine)).status).toBe(400);
    expect((await patchLine(req("PATCH", { action: "link", catalogItemId: ITEM, writeAlias: "y" }), jobLine)).status).toBe(400);
  });

  it("maps a service 409 (duplicate item on the plan) through", async () => {
    m.linkPlanLineToItem.mockRejectedValue(Object.assign(new Error("already on this job's plan"), { status: 409 }));
    expect((await patchLine(req("PATCH", { action: "link", catalogItemId: ITEM }), jobLine)).status).toBe(409);
  });
});

describe("history, save-as-kit and the needs-SKU queue", () => {
  it("returns history under job_material_line_events/select", async () => {
    m.getMaterialPlanHistory.mockResolvedValue([{ id: "e1" }]);
    const res = await getHistory(req("GET"), job);
    expect((await res.json()).events).toEqual([{ id: "e1" }]);
    expect(m.requirePermission).toHaveBeenCalledWith(expect.anything(), "job_material_line_events", "select");
  });

  it("saves the plan as a kit under kit_templates/insert", async () => {
    m.saveJobMaterialsAsKit.mockResolvedValue({ kit: { id: KIT }, skippedUnlinked: 1 });
    const res = await saveAsKit(req("POST", { name: "Furnace swap" }), job);
    expect(res.status).toBe(201);
    expect(m.requirePermission).toHaveBeenCalledWith(expect.anything(), "kit_templates", "insert");
    expect(m.saveJobMaterialsAsKit).toHaveBeenCalledWith(JOB, "Furnace swap");
  });

  it("lists the needs-SKU queue under catalog_item_aliases/select", async () => {
    m.getNeedsSkuQueue.mockResolvedValue([{ lineId: LINE }]);
    const res = await getNeedsSku(req("GET"));
    expect((await res.json()).lines).toEqual([{ lineId: LINE }]);
    expect(m.requirePermission).toHaveBeenCalledWith(expect.anything(), "catalog_item_aliases", "select");
  });

  it("refuses unauthenticated callers on every read", async () => {
    m.requirePermission.mockResolvedValue(deny(401));
    expect((await getHistory(req("GET"), job)).status).toBe(401);
    expect((await getNeedsSku(req("GET"))).status).toBe(401);
    expect((await saveAsKit(req("POST", { name: "x" }), job)).status).toBe(401);
  });
});
