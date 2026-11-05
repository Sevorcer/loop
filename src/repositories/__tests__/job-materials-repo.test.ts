import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Op = { method: string; args: unknown[] };
type Call = { table: string; ops: Op[] };
type Result = { data: unknown; error: { message: string; code?: string } | null };

const { state } = vi.hoisted(() => ({
  state: {
    calls: [] as Call[],
    handler: (() => ({ data: [], error: null })) as (call: Call) => Result,
  },
}));

vi.mock("../supabaseContext", () => {
  function builder(table: string) {
    const call: Call = { table, ops: [] };
    state.calls.push(call);
    const proxy: Record<string, unknown> = {};
    const chain = (method: string) =>
      (...args: unknown[]) => {
        call.ops.push({ method, args });
        return proxy;
      };
    for (const method of [
      "select", "insert", "update", "delete", "eq", "neq", "in", "is", "or",
      "overlaps", "order", "range", "limit",
    ]) {
      proxy[method] = chain(method);
    }
    const settle = () => Promise.resolve(state.handler(call));
    proxy.single = () => settle();
    proxy.maybeSingle = () => settle();
    proxy.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
      settle().then(resolve, reject);
    return proxy;
  }
  return {
    getRepositoryContext: async () => ({
      orgId: "org-1",
      userId: "user-1",
      mode: "session",
      supabase: { from: (table: string) => builder(table) },
    }),
  };
});

import {
  deleteJobMaterialLine,
  summarizeJobMaterialsForJobs,
  updateJobMaterialLine,
} from "../jobMaterials";
import {
  countSystemsForProperties,
  listKnowledgeForEquipment,
  listTechnicalSystemsForJob,
} from "../jobTechnicalData";

const opArgs = (call: Call, method: string) =>
  call.ops.filter((op) => op.method === method).map((op) => op.args);

beforeEach(() => {
  state.calls = [];
  state.handler = () => ({ data: [], error: null });
});

describe("job materials repository", () => {
  it("scopes updates by org, job and line, and never writes actor columns", async () => {
    state.handler = () => ({
      data: {
        id: "l1", job_id: "j1", name: "Pump", quantity: "2.000", unit: "ea", part_number: null,
        notes: "", state: "on_truck", sort_order: 0, created_by: "u0", created_at: "t",
        updated_by: "u1", updated_at: "t", state_changed_by: "u1", state_changed_at: "t",
      },
      error: null,
    });
    const line = await updateJobMaterialLine("j1", "l1", { state: "on_truck", quantity: 2 });
    const [call] = state.calls;
    expect(call.table).toBe("job_material_lines");
    expect(opArgs(call, "update")[0][0]).toEqual({ state: "on_truck", quantity: 2 });
    expect(opArgs(call, "eq")).toEqual([["org_id", "org-1"], ["job_id", "j1"], ["id", "l1"]]);
    expect(line.quantity).toBe(2);
    expect(line.state).toBe("on_truck");
  });

  it("turns an invisible line into a 404 and a 42501 into a 403", async () => {
    state.handler = () => ({ data: null, error: null });
    await expect(updateJobMaterialLine("j1", "l1", { state: "used" })).rejects.toMatchObject({ status: 404 });

    state.handler = () => ({ data: null, error: { message: "Technicians can only…", code: "42501" } });
    await expect(updateJobMaterialLine("j1", "l1", { name: "x" })).rejects.toMatchObject({ status: 403 });

    state.handler = () => ({ data: [], error: null });
    await expect(deleteJobMaterialLine("j1", "l1")).rejects.toMatchObject({ status: 404 });
  });

  it("summarizes many jobs in 80-id chunks and fills empty jobs", async () => {
    const ids = Array.from({ length: 170 }, (_, i) => `job-${i}`);
    state.handler = (call) => {
      const inIds = opArgs(call, "in")[0][1] as string[];
      return {
        data: inIds.includes("job-0")
          ? [
              { id: "a", job_id: "job-0", state: "needed" },
              { id: "b", job_id: "job-0", state: "used" },
              { id: "c", job_id: "job-0", state: "bogus" },
            ]
          : [],
        error: null,
      };
    };
    const result = await summarizeJobMaterialsForJobs(ids);
    expect(state.calls).toHaveLength(3);
    expect(state.calls.map((c) => (opArgs(c, "in")[0][1] as string[]).length)).toEqual([80, 80, 10]);
    expect(result["job-0"]).toEqual({ total: 2, needed: 1, onTruck: 0, used: 1 });
    expect(result["job-169"]).toEqual({ total: 0, needed: 0, onTruck: 0, used: 0 });
  });

  it("makes no request for an empty id list", async () => {
    expect(await summarizeJobMaterialsForJobs([])).toEqual({});
    expect(state.calls).toHaveLength(0);
  });
});

describe("technical data repository", () => {
  it("reads systems on the job or at its property in one filtered query", async () => {
    await listTechnicalSystemsForJob("j1", "p1");
    const [call] = state.calls;
    expect(call.table).toBe("installed_systems");
    expect(opArgs(call, "or")[0][0]).toBe("job_id.eq.j1,linked_workflow_ids.cs.{j1},property_id.eq.p1");
    expect(opArgs(call, "eq")[0]).toEqual(["org_id", "org-1"]);

    state.calls = [];
    await listTechnicalSystemsForJob("j1", null);
    expect(opArgs(state.calls[0], "or")[0][0]).toBe("job_id.eq.j1,linked_workflow_ids.cs.{j1}");
  });

  it("skips tag/title queries without tokens but still follows explicit links", async () => {
    state.handler = (call) => {
      if (call.table === "knowledge_relationships") {
        return { data: [{ knowledge_item_id: "k1", related_entity_id: "s1" }], error: null };
      }
      return {
        data: [{ id: "k1", title: "Notes", status: "published", knowledge_type: "faq", tags: null }],
        error: null,
      };
    };
    const result = await listKnowledgeForEquipment({ jobId: "j1", systemIds: ["s1"], tags: [], titleModels: [] });
    expect(state.calls.map((c) => c.table)).toEqual(["knowledge_relationships", "knowledge_items"]);
    expect(opArgs(state.calls[1], "in")[0]).toEqual(["id", ["k1"]]);
    expect(result.items.map((i) => i.id)).toEqual(["k1"]);
    expect(result.links).toEqual([{ knowledgeItemId: "k1", relatedEntityId: "s1" }]);
  });

  it("propagates a query error", async () => {
    state.handler = () => ({ data: null, error: { message: "boom" } });
    await expect(
      listKnowledgeForEquipment({ jobId: "j1", systemIds: [], tags: ["Trane"], titleModels: [] }),
    ).rejects.toThrow("boom");
  });

  it("counts systems and profiles per property", async () => {
    state.handler = () => ({
      data: [
        { property_id: "p1", technical_profile_id: null },
        { property_id: "p1", technical_profile_id: "tp" },
        { property_id: "p2", technical_profile_id: null },
      ],
      error: null,
    });
    expect(await countSystemsForProperties(["p1", "p2", "p3", "p1"])).toEqual({
      p1: { systems: 2, withProfile: 1 },
      p2: { systems: 1, withProfile: 0 },
      p3: { systems: 0, withProfile: 0 },
    });
    expect(state.calls).toHaveLength(1);
  });
});
