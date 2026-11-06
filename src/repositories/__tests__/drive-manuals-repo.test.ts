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
  listDriveManualFiles,
  mapDriveManualFile,
  markDriveManualFilesRemoved,
  upsertDriveManualFiles,
  type DriveManualFileRow,
} from "../driveManuals";

const opArgs = (call: Call, method: string) =>
  call.ops.filter((op) => op.method === method).map((op) => op.args);

const baseRow: DriveManualFileRow = {
  id: "m1", drive_file_id: "d1", name: "Coleman.pdf", mime_type: "application/pdf", folder_path: "Crew Install References",
  drive_modified_at: null, web_view_link: "https://drive.google.com/file/d/d1/view", size_bytes: "12",
  parsed_manufacturer: "Coleman", parsed_manufacturers: ["Coleman"], parsed_models: ["ABC123"], parsed_doc_type: "install",
  manufacturer_override: null, model_override: null, status: "active", last_seen_at: "t", updated_at: "t",
};

beforeEach(() => {
  state.calls = [];
  state.handler = () => ({ data: [], error: null });
});

describe("driveManuals repository", () => {
  it("maps rows; overrides win over parsed values", () => {
    expect(mapDriveManualFile(baseRow)).toMatchObject({ manufacturer: "Coleman", models: ["ABC123"], sizeBytes: 12, docType: "install" });
    expect(
      mapDriveManualFile({ ...baseRow, manufacturer_override: "Daikin", model_override: "ftx09", parsed_doc_type: "bogus" }),
    ).toMatchObject({ manufacturer: "Daikin", models: ["FTX09"], docType: "other" });
  });

  it("lists active rows for the org, paging", async () => {
    let n = 0;
    state.handler = () => ({ data: n++ === 0 ? Array.from({ length: 500 }, () => baseRow) : [baseRow], error: null });
    const files = await listDriveManualFiles();
    expect(files).toHaveLength(501);
    expect(opArgs(state.calls[0], "eq")).toEqual([["org_id", "org-1"], ["status", "active"]]);
    expect(opArgs(state.calls[1], "range")).toEqual([[500, 999]]);
  });

  it("upserts on (org_id, drive_file_id) and never sends override columns", async () => {
    await upsertDriveManualFiles(
      [{
        listed: { driveFileId: "d1", name: "n", mimeType: "application/pdf", folderPath: "F", rootFolderId: "R", parentFolderId: "R", modifiedTime: null, webViewLink: "", sizeBytes: null },
        parsed: { manufacturer: null, manufacturers: [], models: [], docType: "other" },
      }],
      "2026-11-04T00:00:00Z",
    );
    const [[rows, opts]] = opArgs(state.calls[0], "upsert") as [[Array<Record<string, unknown>>, unknown]];
    expect(opts).toEqual({ onConflict: "org_id,drive_file_id" });
    expect(rows[0]).toMatchObject({ org_id: "org-1", drive_file_id: "d1", status: "active" });
    expect(Object.keys(rows[0])).not.toContain("manufacturer_override");
    expect(Object.keys(rows[0])).not.toContain("model_override");
  });

  it("marks removed in id chunks of 80", async () => {
    await markDriveManualFilesRemoved(Array.from({ length: 81 }, (_, i) => `id-${i}`));
    expect(state.calls).toHaveLength(2);
    expect(opArgs(state.calls[0], "update")).toEqual([[{ status: "removed" }]]);
    await markDriveManualFilesRemoved([]);
    expect(state.calls).toHaveLength(2);
  });

  it("maps 42501 to a 403-style error", async () => {
    state.handler = () => ({ data: null, error: { message: "denied", code: "42501" } });
    await expect(listDriveManualFiles()).rejects.toMatchObject({ status: 403 });
  });
});

describe("driveManuals repository — portal eligibility (20261121500000)", () => {
  it("maps storage_path to hasLocalFile without exposing the path", () => {
    expect(mapDriveManualFile({ ...baseRow, storage_path: "abc/Manual.pdf" }).hasLocalFile).toBe(true);
    expect(mapDriveManualFile({ ...baseRow, storage_path: null }).hasLocalFile).toBe(false);
    expect(mapDriveManualFile(baseRow).hasLocalFile).toBe(false);
    expect(JSON.stringify(mapDriveManualFile({ ...baseRow, storage_path: "abc/Manual.pdf" }))).not.toContain("abc/Manual.pdf");
  });

  it("reads portal_eligible and maps it (missing → false)", () => {
    expect(mapDriveManualFile({ ...baseRow, portal_eligible: true }).portalEligible).toBe(true);
    expect(mapDriveManualFile(baseRow).portalEligible).toBe(false);
  });

  it("writes portal_eligible from the Drive walk on every sync", async () => {
    const listed = { driveFileId: "d1", name: "n", mimeType: "application/pdf", folderPath: "F / Customer manuals", rootFolderId: "R", parentFolderId: "C", modifiedTime: null, webViewLink: "", sizeBytes: null };
    const parsed = { manufacturer: null, manufacturers: [], models: [], docType: "other" as const };
    await upsertDriveManualFiles(
      [{ listed: { ...listed, portalEligible: true }, parsed }, { listed: { ...listed, driveFileId: "d2", portalEligible: false }, parsed }],
      "2026-11-04T00:00:00Z",
    );
    const [[rows]] = opArgs(state.calls[0], "upsert") as [[Array<Record<string, unknown>>]];
    expect(rows.map((r) => r.portal_eligible)).toEqual([true, false]);
  });
});
