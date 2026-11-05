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
      "overlaps", "order", "range", "limit", "upsert",
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
  deleteManualDecision,
  listManualLinksForSystems,
  mapManualLink,
  upsertOfficeManualDecision,
} from "../installedSystemManuals";

const opArgs = (call: Call, method: string) =>
  call.ops.filter((op) => op.method === method).map((op) => op.args);

beforeEach(() => {
  state.calls = [];
  state.handler = () => ({ data: [], error: null });
});

describe("installedSystemManuals repository", () => {
  it("maps rows defensively", () => {
    expect(
      mapManualLink({
        id: "l", installed_system_id: "s", manual_file_id: "m", status: "weird", source: "x", match_kind: "nope",
        confidence: "0.970", reason: "", decided_at: "t", manual: null,
      }),
    ).toMatchObject({ status: "suggested", source: "office", kind: "manual", confidence: 0.97, manual: null });
  });

  it("reads links for systems in chunks of 80, skipping empty input", async () => {
    expect(await listManualLinksForSystems([])).toEqual([]);
    expect(state.calls).toHaveLength(0);
    await listManualLinksForSystems(Array.from({ length: 81 }, (_, i) => `s-${i}`));
    expect(state.calls).toHaveLength(2);
    expect(opArgs(state.calls[0], "eq")).toEqual([["org_id", "org-1"]]);
    expect(String(opArgs(state.calls[0], "select")[0][0])).toContain("manual:drive_manual_files(");
  });

  it("upserts office decisions on the pair, clamping confidence", async () => {
    state.handler = () => ({
      data: { id: "l", installed_system_id: "s", manual_file_id: "m", status: "confirmed", source: "office", match_kind: "manual", confidence: 1, reason: "r", decided_at: "t", manual: null },
      error: null,
    });
    await upsertOfficeManualDecision({ installedSystemId: "s", manualId: "m", status: "confirmed", kind: "manual", confidence: 3, reason: "x".repeat(600) });
    const [[row, opts]] = opArgs(state.calls[0], "upsert") as [[Record<string, unknown>, unknown]];
    expect(opts).toEqual({ onConflict: "installed_system_id,manual_file_id" });
    expect(row).toMatchObject({ org_id: "org-1", source: "office", confidence: 1 });
    expect(String(row.reason)).toHaveLength(500);
  });

  it("maps FK violations to 404 and reports deletes", async () => {
    state.handler = () => ({ data: null, error: { message: "fk", code: "23503" } });
    await expect(
      upsertOfficeManualDecision({ installedSystemId: "s", manualId: "m", status: "rejected", kind: "manual", confidence: 0, reason: "" }),
    ).rejects.toMatchObject({ status: 404 });
    state.handler = () => ({ data: [{ id: "l" }], error: null });
    expect(await deleteManualDecision("s", "m")).toBe(true);
  });
});
