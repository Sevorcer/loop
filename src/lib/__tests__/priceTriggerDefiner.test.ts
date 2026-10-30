import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { hasPermission } from "@/services/authorization";

vi.mock("server-only", () => ({}));

const followUp = readFileSync(
  join(process.cwd(), "supabase/migrations/20261031000001_price_trigger_definer.sql"),
  "utf8",
);
const baseline = readFileSync(
  join(process.cwd(), "supabase/migrations/20260719000001_baseline_core_schema.sql"),
  "utf8",
);
const applied = readFileSync(
  join(process.cwd(), "supabase/migrations/20261031000000_person_team_reporting.sql"),
  "utf8",
);

describe("price trigger follow-up", () => {
  it("matches the no-argument helper signatures and gives them a public search path", () => {
    expect(baseline).toContain("CREATE OR REPLACE FUNCTION current_app_role()");
    expect(baseline).toContain("CREATE OR REPLACE FUNCTION current_org_id()");
    expect(baseline).not.toMatch(/FUNCTION current_app_role\([^)]+/);
    expect(baseline).not.toMatch(/FUNCTION current_org_id\([^)]+/);
    expect(followUp).toContain("ALTER FUNCTION public.current_app_role() SET search_path = public;");
    expect(followUp).toContain("ALTER FUNCTION public.current_org_id() SET search_path = public;");
  });

  it("runs the triggers as their owner, with an empty search path, and not as callable functions", () => {
    expect(followUp).toContain(
      "ALTER FUNCTION private.enforce_job_price_same_company() SECURITY DEFINER;",
    );
    expect(followUp).toContain(
      "ALTER FUNCTION private.enforce_calendar_group_member_same_company() SECURITY DEFINER;",
    );
    expect(followUp).toContain(
      "ALTER FUNCTION private.enforce_job_price_same_company() SET search_path = '';",
    );
    expect(followUp).toContain(
      "ALTER FUNCTION private.enforce_calendar_group_member_same_company() SET search_path = '';",
    );
    expect(applied).toContain("SET search_path = ''");
    expect(followUp).toContain(
      "REVOKE ALL ON FUNCTION private.enforce_job_price_same_company() FROM anon;",
    );
    expect(followUp).toContain(
      "REVOKE ALL ON FUNCTION private.enforce_job_price_same_company() FROM authenticated;",
    );
    expect(followUp).toContain(
      "REVOKE ALL ON FUNCTION private.enforce_calendar_group_member_same_company() FROM authenticated;",
    );
    const executable = followUp
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(executable).not.toMatch(
      /GRANT EXECUTE ON FUNCTION private\.enforce_job_price_same_company\(\) TO authenticated/i,
    );
  });

  it("qualifies the company comparison so it is not a column compared to itself", () => {
    expect(followUp).toContain("priced_job.org_id = job_financials.org_id");
    expect(followUp).toContain("priced_job.org_id = job_financials_history.org_id");
    expect(followUp).toContain(
      "member_profile.org_id = calendar_saved_group_members.org_id",
    );
    expect(followUp).not.toContain("priced_job.org_id = org_id");
  });
});

describe("owner inserting a price", () => {
  it("allows the owner to insert a price and records the change without an amount", async () => {
    expect(hasPermission("owner", "job_financials", "insert")).toBe(true);
    const insert = followUp.slice(
      followUp.indexOf('CREATE POLICY "job_financials: finance insert"'),
      followUp.indexOf('DROP POLICY IF EXISTS "job_financials: finance update"'),
    );
    expect(insert).toContain("'owner'");
    expect(insert).toContain("priced_job.org_id = job_financials.org_id");

    const { setJobPriceForRole } = await import("@/services/jobPrice");
    const jobs = await import("@/repositories/jobs");
    const prices = await import("@/repositories/jobPrice");
    const operator = await import("@/services/currentOperator");

    vi.spyOn(jobs, "getJobById").mockResolvedValue({ id: "job-1" } as never);
    vi.spyOn(jobs, "createJobActivity").mockResolvedValue({} as never);
    vi.spyOn(prices, "readJobPrice").mockResolvedValue(null);
    const write = vi.spyOn(prices, "writeJobPrice").mockResolvedValue();
    vi.spyOn(operator, "getCurrentOperator").mockResolvedValue({
      name: "Alex Nguyen",
      appRole: "owner",
    });

    const saved = await setJobPriceForRole("owner", "job-1", 120050, "owner-user");

    expect(saved).toBe(120050);
    expect(write).toHaveBeenCalledWith("job-1", 120050, "owner-user", null);
    const activity = vi.mocked(jobs.createJobActivity).mock.calls[0]?.[0];
    expect(activity?.type).toBe("price");
    expect(activity?.description).toBe("Alex Nguyen set the job price.");
    expect(activity?.description).not.toMatch(/\$|\d/);
  });
});
