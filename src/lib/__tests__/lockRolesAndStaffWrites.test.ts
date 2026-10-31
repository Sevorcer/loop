import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261031100000_lock_roles_and_staff_writes.sql"),
  "utf8",
);

const executable = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("lock roles and staff writes", () => {
  it("drops the dashboard profile policies by their exact names", () => {
    expect(executable).toContain('DROP POLICY IF EXISTS "insert own profile"');
    expect(executable).toContain('DROP POLICY IF EXISTS "read own profile"');
    expect(executable).toContain('DROP POLICY IF EXISTS "update own profile"');
    expect(executable).not.toContain('CREATE POLICY "insert own profile"');
    expect(executable).not.toContain('CREATE POLICY "update own profile"');
  });

  it("takes table-level writes off user_profiles before the name-only column grant", () => {
    const revokeAt = executable.indexOf(
      "REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.user_profiles FROM authenticated;",
    );
    const grantAt = executable.indexOf(
      "GRANT UPDATE (full_name, updated_at) ON TABLE public.user_profiles TO authenticated;",
    );
    expect(revokeAt).toBeGreaterThan(-1);
    expect(grantAt).toBeGreaterThan(revokeAt);
    expect(executable).toContain(
      "REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLE public.user_profiles FROM anon;",
    );
    expect(executable).toContain("GRANT SELECT ON TABLE public.user_profiles TO authenticated;");
    expect(executable).not.toMatch(/GRANT\s+(SELECT,\s*)?DELETE ON TABLE public\.user_profiles TO authenticated/i);
    expect(executable).toContain('"user_profiles: user updates own name"');
    expect(executable).toContain('"user_profiles: manager can update"');
    expect(executable).toContain('DROP POLICY IF EXISTS "user_profiles: owner can update"');
    expect(executable).toContain('DROP POLICY IF EXISTS "job_tasks: delete for owner"');
  });

  it("refuses a self role change and removing the last owner", () => {
    expect(executable).toContain("Changing your own role is denied");
    expect(executable).toContain("Choosing your own role or company is denied");
    expect(executable).toContain("Changing id or company is denied");
    expect(executable).toContain("Changing email is denied");
    expect(executable).toContain("Only an owner can grant or remove the owner role");
    expect(executable).toContain("Only an owner can grant the owner role");
    expect(executable).toContain("Removing the last owner is denied");
    expect(executable).toContain("FOR UPDATE");
    expect(executable).toContain(
      "A technician can only record their own name on a checklist item",
    );
  });

  it("limits assignee, task, dispatch, and equipment writes to office roles", () => {
    expect(executable).toContain(
      "current_app_role() IN ('owner', 'manager', 'office', 'dispatch')",
    );
    expect(executable).toContain('"job_tasks: org all"');
    expect(executable).toContain("FOR SELECT");
    expect(executable).toContain('"job_tasks: tech updates tasks on assigned jobs"');
    expect(executable).toContain('"dispatch_plans: tech updates assigned job status"');
    expect(executable).toContain('"installed_systems: tech inserts field equipment"');
    expect(executable).toContain("Technicians may only check a job task off");
    expect(executable).toContain("Technicians may only update dispatch status");
    expect(executable).not.toContain("'sales'");
  });

  it("pins health-check helpers and does not change existing rows", () => {
    expect(executable).toContain(
      "ALTER FUNCTION public.dbhc_rls_coverage() SET search_path = public;",
    );
    expect(executable).toContain(
      "REVOKE ALL ON FUNCTION public.dbhc_rls_coverage() FROM PUBLIC, anon, authenticated;",
    );
    expect(executable).toContain(
      "GRANT EXECUTE ON FUNCTION public.dbhc_rls_coverage() TO service_role;",
    );
    expect(executable).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(executable).not.toMatch(/\bUPDATE\s+public\./i);
    expect(executable).not.toMatch(/\bINSERT\s+INTO\b/i);
  });
});
