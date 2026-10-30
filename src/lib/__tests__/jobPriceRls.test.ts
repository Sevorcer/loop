import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isTechDeniedApiPath, isTechDeniedPath } from "@/lib/auth/shellAccess";
import { canSeeJobRevenue, canViewJobPrice } from "@/features/reporting/utils/revenueAccess";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261031000000_person_team_reporting.sql"),
  "utf8",
);

function policySql(name: string): string {
  const marker = `CREATE POLICY "${name}"`;
  const start = migration.indexOf(marker);
  expect(start, name).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf(";", start);
  return migration.slice(start, end);
}

function between(startMarker: string, endMarker: string): string {
  const start = migration.indexOf(startMarker);
  const end = migration.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}

const FINANCE = "current_app_role() IN ('owner', 'manager', 'dispatch', 'office')";

describe("job price access", () => {
  it("lets dispatch read and write prices the same way office does", () => {
    for (const name of [
      "job_financials: finance read",
      "job_financials: finance insert",
      "job_financials: finance update",
      "job_financials: finance delete",
      "job_financials_history: finance read",
      "job_financials_history: finance insert",
    ]) {
      expect(policySql(name)).toContain(FINANCE);
    }
    expect(canSeeJobRevenue("dispatch")).toBe(true);
    expect(canSeeJobRevenue("office")).toBe(true);
  });

  it("lets a technician read an assigned job price and never write one", () => {
    const read = policySql("job_financials: tech reads assigned");
    expect(read).toContain("current_app_role() = 'tech'");
    expect(read).toContain("priced_job.assigned_user_id = auth.uid()");
    expect(read).toContain("assignee.user_id = auth.uid()");
    expect(read).toContain("FOR SELECT");

    const writes = between(
      "DROP POLICY IF EXISTS \"job_financials: finance insert\"",
      "DROP POLICY IF EXISTS \"job_financials: tech reads assigned\"",
    );
    expect(writes).not.toContain("= 'tech'");
    expect(canViewJobPrice("tech")).toBe(true);
    expect(canSeeJobRevenue("tech")).toBe(false);
    expect(isTechDeniedPath("/reporting")).toBe(true);
    expect(isTechDeniedApiPath("/api/reports")).toBe(true);
    expect(isTechDeniedApiPath("/api/reports/production")).toBe(true);
  });

  it("does not give sales or portal a price policy", () => {
    const revenue = between(
      "CREATE TABLE IF NOT EXISTS public.job_financials (",
      "CREATE TABLE IF NOT EXISTS public.job_financials_history",
    );
    expect(revenue).not.toMatch(/'sales'|'portal'/);
    expect(canSeeJobRevenue("sales")).toBe(false);
    expect(canViewJobPrice("sales")).toBe(false);
    expect(canViewJobPrice("portal")).toBe(false);
  });

  it("does not hide price timeline rows, and does not store an amount in that text", () => {
    expect(migration).not.toContain("IS DISTINCT FROM 'price'");
    expect(migration).toContain("does not include a dollar amount");
  });

  it("requires a price row to point at a job in the same company", () => {
    const followUp = readFileSync(
      join(process.cwd(), "supabase/migrations/20261031000001_price_trigger_definer.sql"),
      "utf8",
    );
    expect(followUp).toContain("priced_job.org_id = job_financials.org_id");
    expect(migration).toContain("job price must belong to a job in the same company");
    expect(migration).toContain("TRIGGER job_financials_same_company");
    expect(migration).toContain("TRIGGER job_financials_history_same_company");
  });

  it("requires a saved group member to belong to the group's company", () => {
    const insert = policySql("calendar_saved_group_members: office insert");
    expect(insert).toContain("member_profile.org_id = org_id");
    expect(insert).toContain("saved_group.org_id = org_id");
    expect(migration).toContain("calendar group members must belong to the same company as the group");
    expect(migration).toContain("TRIGGER calendar_group_member_same_company");
  });
});
