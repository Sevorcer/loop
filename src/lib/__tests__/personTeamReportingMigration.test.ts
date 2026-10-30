import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261031000000_person_team_reporting.sql"),
  "utf8",
);
const verification = readFileSync(
  join(process.cwd(), "supabase/verifications/20261031000000_person_team_reporting.verify.sql"),
  "utf8",
);

describe("person and team reporting migration", () => {
  it("does not change or delete existing rows", () => {
    const withoutComments = migration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(withoutComments).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(withoutComments).not.toMatch(/\bUPDATE\s+(public|ONLY)\b/i);
    expect(withoutComments).not.toMatch(/\bTRUNCATE\b/i);
    expect(withoutComments).not.toMatch(/DROP\s+TABLE/i);
    expect(withoutComments).not.toMatch(/INSERT\s+INTO/i);
  });

  it("locks job revenue to owner, manager, and office", () => {
    expect(migration).toContain('current_app_role() IN (\'owner\', \'manager\', \'office\')');
    expect(migration).toContain("ALTER TABLE public.job_financials FORCE ROW LEVEL SECURITY");
    expect(migration).not.toMatch(/job_financials[\s\S]*'tech'/);
    expect(verification).toContain("technicians, dispatch, and sales must not be named on job financials");
  });

  it("shares calendar groups with office roles and not technicians", () => {
    expect(migration).toContain(
      "current_app_role() IN ('owner', 'manager', 'dispatch', 'office')",
    );
    expect(migration).toContain("ALTER TABLE public.calendar_saved_groups FORCE ROW LEVEL SECURITY");
    expect(migration).toContain(
      "ALTER TABLE public.calendar_saved_group_members FORCE ROW LEVEL SECURITY",
    );
    expect(verification).toContain("techs must not have a calendar group policy");
  });
});
