/**
 * Scoped installed-systems reads (Bundle C perf fix 2).
 *
 * Job and customer screens used to load the whole register (2,778 live rows
 * in three sequential pages + all technical profiles + four counts) and filter
 * in JavaScript. These tests pin the scoped reads: the filters reach the
 * database, the job rule matches getInstalledSystemsForJob (job_id OR
 * linked_workflow_ids), property ids are chunked, and bad ids are refused.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Row = Record<string, unknown>;
interface Call {
  table: string;
  or: string[];
  inFilters: Array<{ column: string; values: string[] }>;
}

const { fakeSupabase, calls, tables } = vi.hoisted(() => {
  const calls: Call[] = [];
  const tables: Record<string, Row[]> = { installed_systems: [], technical_profiles: [] };

  class FakeQuery {
    private call: Call;
    private predicates: Array<(row: Row) => boolean> = [];
    constructor(private readonly table: string) {
      this.call = { table, or: [], inFilters: [] };
    }
    select() { return this; }
    order() { return this; }
    eq(column: string, value: unknown) {
      this.predicates.push((row) => row[column] === value);
      return this;
    }
    in(column: string, values: string[]) {
      this.call.inFilters.push({ column, values });
      this.predicates.push((row) => values.includes(String(row[column])));
      return this;
    }
    or(expression: string) {
      this.call.or.push(expression);
      const match = /^job_id\.eq\.([^,]+),linked_workflow_ids\.cs\.\{([^}]+)\}$/.exec(expression);
      if (!match) throw new Error(`unexpected or() ${expression}`);
      const [, jobId, linked] = match;
      this.predicates.push(
        (row) => row.job_id === jobId || ((row.linked_workflow_ids as string[]) ?? []).includes(linked),
      );
      return this;
    }
    range(from: number, to: number) {
      calls.push(this.call);
      const rows = (tables[this.table] ?? []).filter((row) => this.predicates.every((p) => p(row)));
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    }
  }

  const fakeSupabase = { from: (table: string) => new FakeQuery(table) };
  return { fakeSupabase, calls, tables };
});

vi.mock("@/repositories/supabaseContext", () => ({
  getRepositoryContext: vi.fn().mockResolvedValue({ supabase: fakeSupabase, orgId: "org-1" }),
}));

import {
  listInstalledSystemsForProperties,
  loadInstalledSystemsForJob,
} from "@/repositories/installedSystems";

const JOB_A = "11111111-1111-4111-8111-111111111111";
const JOB_B = "22222222-2222-4222-8222-222222222222";

function system(id: string, extra: Row): Row {
  return {
    id,
    org_id: "org-1",
    technical_identity_id: "",
    technical_profile_id: null,
    system_name: id,
    lifecycle_status: "Active",
    customer_name: "",
    property_id: null,
    property_name: "",
    location: "",
    estimate_id: null,
    job_id: null,
    job_number: null,
    match_state: "exact",
    match_confidence: 1,
    install_date: "2026-01-01",
    manufacturer: "",
    model_number: "",
    serial_numbers: [],
    warranty_expiry: "",
    warranty_registered: false,
    warranty_registered_at: null,
    warranty_registered_by: null,
    accessories: [],
    linked_workflow_ids: [],
    permit_ready: false,
    operational_history: [],
    created_at: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

beforeEach(() => {
  calls.length = 0;
  tables.installed_systems = [];
  tables.technical_profiles = [];
});

describe("loadInstalledSystemsForJob", () => {
  it("returns systems on the job by job_id or linked_workflow_ids — and nothing else", async () => {
    tables.installed_systems = [
      system("direct", { job_id: JOB_A, technical_profile_id: "tp-1" }),
      system("linked", { linked_workflow_ids: [JOB_A] }),
      system("other-job", { job_id: JOB_B }),
      ...Array.from({ length: 2500 }, (_, i) => system(`unrelated-${i}`, { property_id: `p-${i}` })),
    ];
    tables.technical_profiles = [
      { id: "tp-1", org_id: "org-1", system_name: "Profile 1", catalog_entry_ids: [], permit_fields: [], known_facts: [], discovered_facts: [] },
      { id: "tp-2", org_id: "org-1", system_name: "Unused", catalog_entry_ids: [], permit_fields: [], known_facts: [], discovered_facts: [] },
    ];

    const result = await loadInstalledSystemsForJob(JOB_A);

    expect(result.installedSystems.map((s) => s.id).sort()).toEqual(["direct", "linked"]);
    expect(result.technicalProfiles.map((p) => p.id)).toEqual(["tp-1"]);
    expect(calls[0].or).toEqual([`job_id.eq.${JOB_A},linked_workflow_ids.cs.{${JOB_A}}`]);
  });

  it("refuses a non-UUID job id before touching the database", async () => {
    await expect(loadInstalledSystemsForJob("x),org_id.neq.(y")).rejects.toThrow("Invalid job id.");
    expect(calls).toHaveLength(0);
  });
});

describe("listInstalledSystemsForProperties", () => {
  it("reads only the given properties, in chunks, newest first", async () => {
    const propertyIds = Array.from({ length: 185 }, (_, i) => `prop-${i}`);
    tables.installed_systems = [
      system("old", { property_id: "prop-0", created_at: "2025-01-01T00:00:00Z" }),
      system("new", { property_id: "prop-184", created_at: "2026-06-01T00:00:00Z" }),
      system("elsewhere", { property_id: "prop-999" }),
    ];

    const result = await listInstalledSystemsForProperties(propertyIds);

    expect(result.map((s) => s.id)).toEqual(["new", "old"]);
    const chunks = calls.map((call) => call.inFilters[0]?.values.length);
    expect(chunks).toEqual([80, 80, 25]);
  });

  it("makes no request for a customer with no properties", async () => {
    expect(await listInstalledSystemsForProperties([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
