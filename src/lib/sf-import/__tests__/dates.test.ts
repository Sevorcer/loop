import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { laterCalendarDate } from "../dates";

describe("later calendar date", () => {
  it("keeps the later of the Loop date and the Service Fusion date", () => {
    expect(laterCalendarDate("2026-10-01", "2025-01-15")).toBe("2026-10-01");
    expect(laterCalendarDate("2024-11-01", "2026-08-20")).toBe("2026-08-20");
    expect(laterCalendarDate("2026-05-01", "2026-05-01")).toBe("2026-05-01");
  });

  it("does not erase a date when the other side is missing", () => {
    expect(laterCalendarDate("2026-10-01", null)).toBe("2026-10-01");
    expect(laterCalendarDate(null, "2025-06-01")).toBe("2025-06-01");
    expect(laterCalendarDate(null, null)).toBeNull();
    expect(laterCalendarDate("", "2025-06-01")).toBe("2025-06-01");
  });
});

describe("customer last activity in the import function", () => {
  it("stores the later date when an existing customer is updated", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261101193000_sf_import_followups.sql"),
      "utf8",
    );
    expect(sql).toContain("GREATEST(customers.last_activity, EXCLUDED.last_activity)");
    expect(sql).not.toContain("last_activity = COALESCE(EXCLUDED.last_activity, customers.last_activity)");
    expect(sql).toContain("GREATEST(\n            property.last_visit,");
  });
});
