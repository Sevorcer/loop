/**
 * Portal digital manuals — service scope tests.
 *
 * Uses an in-memory fake of the admin client that really applies the
 * eq / contains / limit filters, so scope bugs show up as leaked rows.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = { jobs: [], equipment_manual_links_v: [] };
const queries: Array<{ table: string; filters: string[] }> = [];
let viewError: { code?: string; message: string } | null = null;

function fakeAdmin() {
  return {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      const log: string[] = [];
      queries.push({ table, filters: log });
      let limit = Infinity;
      let single = false;
      const builder = {
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          log.push(`eq:${col}`);
          filters.push((r) => r[col] === val);
          return builder;
        },
        contains(col: string, vals: unknown[]) {
          log.push(`contains:${col}`);
          filters.push((r) => Array.isArray(r[col]) && vals.every((v) => (r[col] as unknown[]).includes(v)));
          return builder;
        },
        limit(n: number) {
          limit = n;
          return builder;
        },
        maybeSingle() {
          single = true;
          return builder;
        },
        then(resolve: (v: unknown) => void) {
          if (table === "equipment_manual_links_v" && viewError) return resolve({ data: null, error: viewError });
          const rows = (db[table] ?? []).filter((r) => filters.every((f) => f(r))).slice(0, limit);
          resolve(single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null });
        },
      };
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => fakeAdmin() }));

const ORG_A = "org-a";
const ORG_B = "org-b";
const JOB = "job-1";
const PROP = "prop-1";
const CUST = "cust-1";

function link(partial: Row): Row {
  return {
    org_id: ORG_A,
    installed_system_id: "sys-1",
    property_id: PROP,
    job_id: null,
    linked_workflow_ids: null,
    system_name: "Heat pump",
    manufacturer: "Mitsubishi",
    model_number: "MSZ-GL09NA",
    location: "Attic",
    manual_id: "man-1",
    manual_name: "MSZ-GL09NA owner manual.pdf",
    doc_type: "user",
    mime_type: "application/pdf",
    web_view_link: "https://drive.google.com/file/d/m1/view",
    link_status: "confirmed",
    updated_at: "2026-11-04T00:00:00Z",
    ...partial,
  };
}

beforeEach(() => {
  queries.length = 0;
  viewError = null;
  db.jobs = [
    { id: JOB, org_id: ORG_A, property_id: PROP, customer_id: CUST },
    { id: "job-2", org_id: ORG_A, property_id: PROP, customer_id: CUST },
    { id: "job-other", org_id: ORG_A, property_id: "prop-2", customer_id: "cust-2" },
    { id: "job-b", org_id: ORG_B, property_id: PROP, customer_id: "cust-b" },
  ];
  db.equipment_manual_links_v = [];
});

async function load(jobId = JOB, orgId = ORG_A) {
  const { getPortalJobManuals } = await import("@/services/portalManuals");
  return getPortalJobManuals(jobId, orgId);
}

describe("getPortalJobManuals", () => {
  it("returns the job's manuals with url = Drive web-view link and no customer data", async () => {
    db.equipment_manual_links_v = [link({ job_id: JOB })];
    const result = await load();
    expect(result?.systems).toHaveLength(1);
    const [system] = result!.systems;
    expect(system).toMatchObject({ id: "sys-1", systemName: "Heat pump", manufacturer: "Mitsubishi", modelNumber: "MSZ-GL09NA" });
    expect(system.manuals[0]).toMatchObject({
      id: "man-1",
      url: "https://drive.google.com/file/d/m1/view",
      linkStatus: "confirmed",
      docTypeLabel: "User manual",
    });
    expect(JSON.stringify(result)).not.toMatch(/customer|cust-1|notes/i);
  });

  it("filters every query by the token's org", async () => {
    await load();
    for (const q of queries) expect(q.filters).toContain("eq:org_id");
  });

  it("includes systems linked through linked_workflow_ids and dedupes repeats", async () => {
    db.equipment_manual_links_v = [
      link({ installed_system_id: "sys-2", property_id: "prop-x", linked_workflow_ids: [JOB, "other"] }),
      link({ job_id: JOB }),
    ];
    const result = await load();
    expect(result?.systems.map((s) => s.id).sort()).toEqual(["sys-1", "sys-2"]);
    expect(result?.systems.flatMap((s) => s.manuals)).toHaveLength(2);
  });

  it("hides non-eligible / undecided rows even if the view ever returned them", async () => {
    const { groupPortalManualRows } = await import("@/services/portalManuals");
    const rows = [
      link({ manual_id: "ok" }),
      link({ manual_id: "sugg", link_status: "suggested" }),
      link({ manual_id: "rej", link_status: "rejected" }),
      link({ manual_id: "nolink", web_view_link: "" }),
      link({ manual_id: "js", web_view_link: "javascript:alert(1)" }),
      link({ manual_id: "orgb", org_id: ORG_B }),
    ] as Parameters<typeof groupPortalManualRows>[0];
    const systems = groupPortalManualRows(rows, ORG_A);
    expect(systems.flatMap((s) => s.manuals.map((m) => m.id))).toEqual(["ok"]);
  });

  it("only shows what the portal view exposes (internal manuals never appear)", async () => {
    // The view only holds portal-eligible rows; an internal manual linked to
    // the same system is simply absent from it.
    db.equipment_manual_links_v = [link({ job_id: JOB, manual_id: "cust" })];
    const result = await load();
    expect(result?.systems[0].manuals.map((m) => m.id)).toEqual(["cust"]);
  });

  it("includes property systems when the property belongs only to this customer", async () => {
    db.equipment_manual_links_v = [link({ installed_system_id: "sys-prop" })];
    const result = await load();
    expect(result?.systems.map((s) => s.id)).toEqual(["sys-prop"]);
    expect(queries.some((q) => q.table === "equipment_manual_links_v" && q.filters.includes("eq:property_id"))).toBe(true);
  });

  it("cross-customer isolation: a property shared with another customer falls back to job-linked systems only", async () => {
    db.jobs.push({ id: "job-3", org_id: ORG_A, property_id: PROP, customer_id: "cust-OTHER" });
    db.equipment_manual_links_v = [
      link({ installed_system_id: "sys-other-customer", manual_id: "man-x" }),
      link({ installed_system_id: "sys-mine", job_id: JOB }),
    ];
    const result = await load();
    expect(result?.systems.map((s) => s.id)).toEqual(["sys-mine"]);
    expect(queries.some((q) => q.table === "equipment_manual_links_v" && q.filters.includes("eq:property_id"))).toBe(false);
  });

  it("cross-customer isolation: another job's systems at another property never appear", async () => {
    db.equipment_manual_links_v = [
      link({ installed_system_id: "sys-elsewhere", property_id: "prop-2", job_id: "job-other" }),
    ];
    const result = await load();
    expect(result?.systems).toEqual([]);
  });

  it("cross-org isolation: another org's rows at the same property id never appear", async () => {
    db.equipment_manual_links_v = [link({ org_id: ORG_B, installed_system_id: "sys-b", job_id: "job-b" })];
    expect((await load())?.systems).toEqual([]);
  });

  it("returns null when the job is not in the token's org", async () => {
    expect(await load("job-b", ORG_A)).toBeNull();
    expect(await load(JOB, ORG_B)).toBeNull();
  });

  it("shows no manuals (not an error) before the migration is applied", async () => {
    viewError = { code: "PGRST205", message: "Could not find the table" };
    expect(await load()).toEqual({ jobId: JOB, systems: [] });
  });

  it("throws on other database errors", async () => {
    viewError = { code: "57014", message: "timeout" };
    await expect(load()).rejects.toThrow("timeout");
  });
});
