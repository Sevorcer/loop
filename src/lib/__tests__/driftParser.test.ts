import { describe, it, expect } from "vitest";
import {
  parsePolicyNames,
  parseTableNames,
  parseRlsEnabledTables,
  parseHelperFunctions,
  computeDrift,
  buildDriftReport,
} from "../driftParser";

// ── parsePolicyNames ──────────────────────────────────────────────────────────

describe("parsePolicyNames", () => {
  it("extracts quoted policy names", () => {
    const sql = `
      CREATE POLICY "customers: read for internal operational roles"
        ON public.customers FOR SELECT USING (current_org_id() = org_id);

      CREATE POLICY "customers: delete for owner only"
        ON public.customers FOR DELETE USING (current_app_role() = 'owner');
    `;
    expect(parsePolicyNames(sql)).toEqual([
      "customers: delete for owner only",
      "customers: read for internal operational roles",
    ]);
  });

  it("extracts unquoted policy names", () => {
    const sql = `
      CREATE POLICY storage_objects_org_select ON public.storage_objects
        FOR SELECT USING (current_org_id() = org_id);

      CREATE POLICY storage_objects_org_insert ON public.storage_objects
        FOR INSERT WITH CHECK (current_org_id() = org_id);
    `;
    const names = parsePolicyNames(sql);
    expect(names).toContain("storage_objects_org_select");
    expect(names).toContain("storage_objects_org_insert");
  });

  it("deduplicates duplicate policy names", () => {
    const sql = `
      CREATE POLICY "my policy" ON foo FOR SELECT USING (true);
      CREATE POLICY "my policy" ON foo FOR SELECT USING (true);
    `;
    expect(parsePolicyNames(sql)).toHaveLength(1);
    expect(parsePolicyNames(sql)[0]).toBe("my policy");
  });

  it("returns empty array for SQL with no policies", () => {
    const sql = "CREATE TABLE foo (id uuid PRIMARY KEY);";
    expect(parsePolicyNames(sql)).toEqual([]);
  });

  it("handles mixed quoted and unquoted policy names", () => {
    const sql = `
      CREATE POLICY "quoted policy" ON t1 FOR SELECT USING (true);
      CREATE POLICY unquoted_policy ON t2 FOR SELECT USING (true);
    `;
    const names = parsePolicyNames(sql);
    expect(names).toContain("quoted policy");
    expect(names).toContain("unquoted_policy");
  });

  it("returns results in sorted order", () => {
    const sql = `
      CREATE POLICY "z policy" ON t FOR SELECT USING (true);
      CREATE POLICY "a policy" ON t FOR SELECT USING (true);
      CREATE POLICY "m policy" ON t FOR SELECT USING (true);
    `;
    const names = parsePolicyNames(sql);
    expect(names).toEqual(["a policy", "m policy", "z policy"]);
  });
});

// ── parseTableNames ───────────────────────────────────────────────────────────

describe("parseTableNames", () => {
  it("extracts simple table names", () => {
    const sql = `
      CREATE TABLE organizations (id uuid PRIMARY KEY);
      CREATE TABLE user_profiles (id uuid PRIMARY KEY, org_id uuid);
    `;
    expect(parseTableNames(sql)).toEqual(["organizations", "user_profiles"]);
  });

  it("handles IF NOT EXISTS syntax", () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS jobs (id uuid PRIMARY KEY);
    `;
    expect(parseTableNames(sql)).toContain("jobs");
  });

  it("strips schema prefix", () => {
    const sql = `
      CREATE TABLE public.customers (id uuid PRIMARY KEY);
    `;
    expect(parseTableNames(sql)).toContain("customers");
  });

  it("returns empty array for SQL with no tables", () => {
    const sql = "CREATE POLICY foo ON bar FOR SELECT USING (true);";
    expect(parseTableNames(sql)).toEqual([]);
  });
});

// ── parseRlsEnabledTables ─────────────────────────────────────────────────────

describe("parseRlsEnabledTables", () => {
  it("extracts tables with ENABLE ROW LEVEL SECURITY", () => {
    const sql = `
      ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    `;
    expect(parseRlsEnabledTables(sql)).toEqual([
      "organizations",
      "user_profiles",
    ]);
  });

  it("handles schema-qualified table names", () => {
    const sql = `
      ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
    `;
    expect(parseRlsEnabledTables(sql)).toContain("customers");
  });

  it("returns empty array when no ENABLE ROW LEVEL SECURITY present", () => {
    const sql = "CREATE TABLE foo (id uuid PRIMARY KEY);";
    expect(parseRlsEnabledTables(sql)).toEqual([]);
  });

  it("is case-insensitive", () => {
    const sql = `
      alter table properties enable row level security;
    `;
    expect(parseRlsEnabledTables(sql)).toContain("properties");
  });
});

// ── parseHelperFunctions ──────────────────────────────────────────────────────

describe("parseHelperFunctions", () => {
  it("extracts function names", () => {
    const sql = `
      CREATE OR REPLACE FUNCTION current_org_id()
        RETURNS uuid LANGUAGE sql STABLE AS $$
          SELECT (auth.jwt() -> 'user_metadata' ->> 'org_id')::uuid;
        $$;

      CREATE FUNCTION current_app_role()
        RETURNS text LANGUAGE sql STABLE AS $$
          SELECT auth.jwt() -> 'user_metadata' ->> 'app_role';
        $$;
    `;
    const fns = parseHelperFunctions(sql);
    expect(fns).toContain("current_org_id");
    expect(fns).toContain("current_app_role");
  });

  it("strips schema prefix from function names", () => {
    const sql = `
      CREATE FUNCTION public.my_func() RETURNS void LANGUAGE sql AS $$ $$;
    `;
    expect(parseHelperFunctions(sql)).toContain("my_func");
  });
});

// ── computeDrift ──────────────────────────────────────────────────────────────

describe("computeDrift", () => {
  it("returns empty missing and unexpected when sets match", () => {
    const result = computeDrift(["a", "b", "c"], ["a", "b", "c"]);
    expect(result.missing).toEqual([]);
    expect(result.unexpected).toEqual([]);
  });

  it("identifies missing items", () => {
    const result = computeDrift(["a", "b", "c"], ["a", "c"]);
    expect(result.missing).toEqual(["b"]);
  });

  it("identifies unexpected items", () => {
    const result = computeDrift(["a", "b"], ["a", "b", "c"]);
    expect(result.unexpected).toEqual(["c"]);
  });

  it("handles both missing and unexpected simultaneously", () => {
    const result = computeDrift(["a", "b", "d"], ["a", "b", "c"]);
    expect(result.missing).toEqual(["d"]);
    expect(result.unexpected).toEqual(["c"]);
  });

  it("handles empty expected set", () => {
    const result = computeDrift([], ["a", "b"]);
    expect(result.missing).toEqual([]);
    expect(result.unexpected).toEqual(["a", "b"]);
  });

  it("handles empty actual set", () => {
    const result = computeDrift(["a", "b"], []);
    expect(result.missing).toEqual(["a", "b"]);
    expect(result.unexpected).toEqual([]);
  });
});

// ── buildDriftReport ──────────────────────────────────────────────────────────

describe("buildDriftReport", () => {
  it("returns status ok when no drift", () => {
    const report = buildDriftReport("policies", ["pol_a", "pol_b"], [
      "pol_a",
      "pol_b",
    ]);
    expect(report.status).toBe("ok");
    expect(report.missing).toEqual([]);
    expect(report.unexpected).toEqual([]);
  });

  it("returns status drift when policies are missing", () => {
    const report = buildDriftReport("policies", ["pol_a", "pol_b"], ["pol_a"]);
    expect(report.status).toBe("drift");
    expect(report.missing).toEqual(["pol_b"]);
  });

  it("includes timestamp, category, and counts", () => {
    const report = buildDriftReport("policies", ["pol_a"], ["pol_a"]);
    expect(report.category).toBe("policies");
    expect(report.totalExpected).toBe(1);
    expect(report.totalActual).toBe(1);
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
