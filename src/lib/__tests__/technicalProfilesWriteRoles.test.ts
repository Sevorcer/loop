import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const VERSION = "20261121200000_technical_profiles_write_roles";

const migration = readFileSync(
  join(process.cwd(), `supabase/migrations/${VERSION}.sql`),
  "utf8",
);
const verify = readFileSync(
  join(process.cwd(), `supabase/migrations/${VERSION}.verify.sql`),
  "utf8",
);

/** SQL with comment lines removed, so the DOWN notes don't count as statements. */
const executable = migration
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

function policyBlock(name: string): string {
  const start = executable.indexOf(`CREATE POLICY "technical_profiles: ${name}"`);
  expect(start, `policy ${name} exists`).toBeGreaterThanOrEqual(0);
  const end = executable.indexOf(";", start);
  return executable.slice(start, end);
}

describe("technical_profiles write-roles migration", () => {
  it("runs in one transaction and drops the org-wide FOR ALL policy", () => {
    expect(executable).toMatch(/^\s*BEGIN;/m);
    expect(executable).toMatch(/^\s*COMMIT;/m);
    expect(executable).toContain(
      'DROP POLICY IF EXISTS "technical_profiles: org write" ON public.technical_profiles;',
    );
    expect(executable).not.toMatch(/FOR ALL/i);
  });

  it.each([
    ["office insert", "INSERT"],
    ["office update", "UPDATE"],
    ["office delete", "DELETE"],
  ])("%s is %s for authenticated office-type roles in the caller's org", (name, cmd) => {
    const block = policyBlock(name);
    expect(block).toContain(`FOR ${cmd}`);
    expect(block).toContain("TO authenticated");
    expect(block).toContain(
      "(select current_app_role()) IN ('owner', 'manager', 'office', 'dispatch')",
    );
    expect(block).toContain("org_id = (select current_org_id())");
    expect(block).not.toMatch(/'tech'|'sales'|'portal'/);
  });

  it("checks both USING and WITH CHECK on update", () => {
    const block = policyBlock("office update");
    expect(block).toContain("USING (");
    expect(block).toContain("WITH CHECK (");
  });

  it("leaves the read policy alone and removes anon privileges", () => {
    expect(executable).not.toContain('"technical_profiles: org read"');
    expect(executable).toContain("REVOKE ALL ON public.technical_profiles FROM anon;");
  });

  it("documents a manual DOWN that restores the old policy", () => {
    expect(migration).toContain("-- DOWN");
    expect(migration).toContain('CREATE POLICY "technical_profiles: org write"');
  });

  it("ships a read-only verify file that asserts the new shape", () => {
    expect(verify).toContain("DO $$");
    expect(verify).toContain("cmd = 'ALL'");
    expect(verify).toContain("IF n <> 3 THEN RAISE EXCEPTION");
    expect(verify).toContain("has_table_privilege('anon', 'public.technical_profiles', 'DELETE')");
    expect(verify).not.toMatch(/\b(INSERT INTO|UPDATE public|DELETE FROM|DROP|ALTER|CREATE)\b/);
  });
});
