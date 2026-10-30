import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { NAV_ROUTE_ROLES } from "@/features/auth/utils/navPermissions";
import { JOB_REVENUE_ROLES, canSeeJobRevenue, canViewJobPrice } from "@/features/reporting/utils/revenueAccess";
import { isTechDeniedApiPath, isTechDeniedPath } from "@/lib/auth/shellAccess";
import { ROUTES } from "@/lib/routes";
import { hasPermission } from "@/services/authorization";

vi.mock("server-only", () => ({}));

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261031000002_sales_job_price_access.sql"),
  "utf8",
);

const executable = migration
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

function policySql(name: string): string {
  const marker = `CREATE POLICY "${name}"`;
  const start = migration.indexOf(marker);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf(";", start);
  return migration.slice(start, end);
}

const FINANCE = "current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')";

describe("sales job price and report access", () => {
  it("keeps revenue on one list that includes sales and leaves out tech and portal", () => {
    expect(JOB_REVENUE_ROLES).toEqual(["owner", "manager", "dispatch", "office", "sales"]);
    expect(canSeeJobRevenue("sales")).toBe(true);
    expect(canViewJobPrice("sales")).toBe(true);
    expect(canSeeJobRevenue("office")).toBe(true);
    expect(canSeeJobRevenue("tech")).toBe(false);
    expect(canSeeJobRevenue("portal")).toBe(false);
    expect(canViewJobPrice("tech")).toBe(true);
    expect(canViewJobPrice("portal")).toBe(false);
  });

  it("lets sales read and write a price in their own company and refuses another company", () => {
    for (const name of [
      "job_financials: finance read",
      "job_financials: finance insert",
      "job_financials: finance update",
      "job_financials: finance delete",
      "job_financials_history: finance read",
      "job_financials_history: finance insert",
    ]) {
      const sql = policySql(name);
      expect(sql).toContain(FINANCE);
      expect(sql).toContain("current_org_id()");
    }

    const insert = policySql("job_financials: finance insert");
    expect(insert).toContain("org_id = current_org_id()");
    expect(insert).toContain("priced_job.org_id = job_financials.org_id");
    expect(insert).not.toContain("priced_job.org_id = org_id");

    const history = policySql("job_financials_history: finance insert");
    expect(history).toContain("priced_job.org_id = job_financials_history.org_id");

    expect(hasPermission("sales", "job_financials", "select")).toBe(true);
    expect(hasPermission("sales", "job_financials", "insert")).toBe(true);
    expect(hasPermission("sales", "job_financials", "update")).toBe(true);
    expect(hasPermission("sales", "job_financials", "delete")).toBe(true);
    expect(hasPermission("sales", "job_financials_history", "select")).toBe(true);
    expect(hasPermission("sales", "job_financials_history", "insert")).toBe(true);
    expect(hasPermission("portal", "job_financials", "select")).toBe(false);
    expect(hasPermission("portal", "job_financials", "insert")).toBe(false);
    expect(hasPermission("tech", "job_financials", "update")).toBe(false);
  });

  it("lets sales read company activity for reports and insert only a price row", () => {
    const read = policySql("job_activity: sales reads own company");
    expect(read).toContain("FOR SELECT");
    expect(read).toContain("current_app_role() = 'sales'");
    expect(read).toContain("org_id = current_org_id()");

    const write = policySql("job_activity: sales records a price change");
    expect(write).toContain("FOR INSERT");
    expect(write).toContain("type = 'price'");
    expect(write).toContain("org_id = current_org_id()");

    expect(executable).not.toMatch(/'tech'|'portal'/);
    const activity = executable.slice(executable.indexOf("job_activity: sales reads own company"));
    expect(activity).not.toMatch(/FOR UPDATE|FOR DELETE/);
    expect(hasPermission("sales", "job_activity", "select")).toBe(true);
    expect(hasPermission("sales", "job_activity", "insert")).toBe(false);
  });

  it("lets sales open reports and keeps technicians and portal out", () => {
    const reporting = NAV_ROUTE_ROLES[ROUTES.REPORTING] ?? [];
    expect(reporting).toContain("sales");
    expect(reporting).not.toContain("tech");
    expect(reporting).not.toContain("portal");
    expect(hasPermission("sales", "jobs", "select")).toBe(true);
    expect(hasPermission("portal", "jobs", "select")).toBe(false);
    expect(isTechDeniedPath("/reporting")).toBe(true);
    expect(isTechDeniedApiPath("/api/reports")).toBe(true);
    expect(isTechDeniedApiPath("/api/reports/production")).toBe(true);
  });
});

describe("sales entering a price", () => {
  it("saves the price and records who changed it without an amount", async () => {
    const { setJobPriceForRole } = await import("@/services/jobPrice");
    const jobs = await import("@/repositories/jobs");
    const prices = await import("@/repositories/jobPrice");
    const operator = await import("@/services/currentOperator");

    vi.spyOn(jobs, "getJobById").mockResolvedValue({ id: "job-1" } as never);
    vi.spyOn(jobs, "createJobActivity").mockResolvedValue({
      id: "activity-sales",
      jobId: "job-1",
      type: "price",
      title: "Job price updated",
      description: "Priya Shah set the job price.",
      timestamp: "2026-10-30T18:00:00.000Z",
    } as never);
    vi.spyOn(prices, "readJobPrice").mockResolvedValue(null);
    const write = vi.spyOn(prices, "writeJobPrice").mockResolvedValue();
    vi.spyOn(operator, "getCurrentOperator").mockResolvedValue({
      name: "Priya Shah",
      appRole: "sales",
    });

    const saved = await setJobPriceForRole("sales", "job-1", 240000, "sales-user");

    expect(saved.revenueCents).toBe(240000);
    expect(saved.activity?.title).toBe("Job price updated");
    expect(saved.activity?.description).not.toMatch(/\$|\d/);
    expect(write).toHaveBeenCalledWith("job-1", 240000, "sales-user", null);
    const activity = vi.mocked(jobs.createJobActivity).mock.calls[0]?.[0];
    expect(activity?.type).toBe("price");
    expect(activity?.description).toBe("Priya Shah set the job price.");
    expect(activity?.description).not.toMatch(/\$|\d/);
  });
});
