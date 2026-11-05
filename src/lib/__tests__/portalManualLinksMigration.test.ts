import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const VERSION = "20261121500000_portal_manual_links";
const migration = readFileSync(join(process.cwd(), `supabase/migrations/${VERSION}.sql`), "utf8");
const verify = readFileSync(join(process.cwd(), `supabase/migrations/${VERSION}.verify.sql`), "utf8");
const executable = migration
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("portal manual links migration", () => {
  it("adds portal_eligible defaulting to false (nothing is portal-visible until a sync says so)", () => {
    expect(executable).toContain("ADD COLUMN IF NOT EXISTS portal_eligible boolean NOT NULL DEFAULT false");
  });

  it("view only exposes decided links to active, portal-eligible manuals in one org", () => {
    const view = executable.slice(executable.indexOf("CREATE OR REPLACE VIEW public.equipment_manual_links_v"));
    expect(view).toContain("security_invoker = true");
    expect(view).toContain("security_barrier = true");
    expect(view).toContain("m.status IN ('confirmed', 'auto_linked')");
    expect(view).toContain("f.status = 'active'");
    expect(view).toContain("f.portal_eligible");
    expect(view).toContain("s.org_id = m.org_id");
    expect(view).toContain("f.org_id = m.org_id");
    const select = view.slice(0, view.indexOf("FROM public.installed_system_manuals"));
    for (const pii of ["customer_name", "notes", "property_name", "serial_numbers", "attributes"]) {
      expect(select).not.toContain(pii);
    }
  });

  it("is readable by service_role only", () => {
    expect(executable).toContain("REVOKE ALL ON public.equipment_manual_links_v FROM PUBLIC;");
    expect(executable).toContain("REVOKE ALL ON public.equipment_manual_links_v FROM anon;");
    expect(executable).toContain("REVOKE ALL ON public.equipment_manual_links_v FROM authenticated;");
    expect(executable).toContain("GRANT SELECT ON public.equipment_manual_links_v TO service_role;");
    expect(executable).not.toMatch(/GRANT [^;]* TO (anon|authenticated)/);
  });

  it("has DOWN notes and a read-only verify file", () => {
    expect(migration).toContain("-- DOWN");
    expect(verify).toContain("DO $$");
    expect(verify).not.toMatch(/\b(INSERT INTO|UPDATE public|DELETE FROM|DROP|ALTER|CREATE)\b/);
  });
});
