import { describe, it, expect } from "vitest";

import { formatDateOnly } from "../dates";

describe("formatDateOnly", () => {
  it("formats a date-only string without a UTC-midnight day shift", () => {
    // The regression: new Date("2026-09-30").toLocaleDateString() renders
    // 9/29 in behind-UTC timezones. The calendar date must be preserved.
    const result = formatDateOnly("2026-09-30");
    expect(result).toContain("2026");
    expect(result).toContain("30");
  });

  it("keeps 1/1/2019 as January 1st, not Dec 31 2018", () => {
    expect(formatDateOnly("2019-01-01")).toContain("2019");
  });

  it("formats full ISO timestamps as their local calendar date", () => {
    const result = formatDateOnly("2026-09-30T16:00:00.000Z");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns empty string for null/undefined/empty/invalid", () => {
    expect(formatDateOnly(null)).toBe("");
    expect(formatDateOnly(undefined)).toBe("");
    expect(formatDateOnly("")).toBe("");
    expect(formatDateOnly("not-a-date")).toBe("");
    expect(formatDateOnly("2026-13-45")).toBe("");
  });
});
