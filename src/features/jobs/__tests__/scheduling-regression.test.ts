/**
 * Regression tests for PR3C scheduling.
 *
 * Tests that job scheduling fields are handled correctly across the following
 * scenarios:
 *  - Reading a job that only has legacy fields (no scheduledStartAt)
 *  - Reading a job that has PR3C fields set
 *  - Form validation of the new datetime-local inputs
 *  - Time window ordering rules
 */
import { describe, it, expect } from "vitest";

import {
  deriveScheduledStartAt,
  isValidTimeWindow,
  parseDatetimeLocalInput,
} from "../utils/schedulingTime";
import { jobToFormScheduling } from "../components/JobForm";

// ─── jobToFormScheduling (backward compat) ───────────────────────────────────

describe("jobToFormScheduling — legacy-only job", () => {
  it("derives scheduledStartAt from scheduledFor + appointmentHour when no PR3C field", () => {
    const result = jobToFormScheduling({
      scheduledStartAt: null,
      scheduledFor: "2026-07-29",
      appointmentHour: 9,
    });
    // Should produce a datetime-local value for the derived timestamp
    expect(result.scheduledStartAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(result.scheduledEndAt).toBe("");
    expect(result.arrivalWindowStartAt).toBe("");
    expect(result.arrivalWindowEndAt).toBe("");
  });

  it("falls back to default hour when appointmentHour is null", () => {
    const result = jobToFormScheduling({
      scheduledStartAt: null,
      scheduledFor: "2026-07-29",
      appointmentHour: null,
    });
    // Default hour is 9 → should not be empty
    expect(result.scheduledStartAt).not.toBe("");
  });
});

describe("jobToFormScheduling — PR3C job", () => {
  it("uses scheduledStartAt directly when set", () => {
    const result = jobToFormScheduling({
      scheduledStartAt: "2026-07-29T14:30:00Z",
      scheduledFor: "2026-07-29",
      appointmentHour: 9,
    });
    // Should map the PR3C timestamp to a datetime-local format
    expect(result.scheduledStartAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

// ─── mapJob / deriveScheduledStartAt (regression for old data) ───────────────

describe("Legacy → PR3C conversion", () => {
  it("converts Morning (hour=9) correctly", () => {
    expect(deriveScheduledStartAt("2026-07-15", 9)).toBe("2026-07-15T09:00:00Z");
  });

  it("converts Afternoon (hour=1 from PR3B backfill) correctly", () => {
    expect(deriveScheduledStartAt("2026-07-15", 1)).toBe("2026-07-15T01:00:00Z");
  });

  it("handles end of month dates", () => {
    expect(deriveScheduledStartAt("2026-07-31", 9)).toBe("2026-07-31T09:00:00Z");
  });

  it("returns null for a missing scheduledFor without throwing", () => {
    expect(() => deriveScheduledStartAt("", 9)).not.toThrow();
    expect(deriveScheduledStartAt("", 9)).toBeNull();
  });
});

// ─── Scheduling time-window validation (service-layer rules) ─────────────────

describe("Scheduled time window ordering", () => {
  it("accepts a valid scheduled_start < scheduled_end window", () => {
    expect(isValidTimeWindow("2026-07-29T08:00:00Z", "2026-07-29T12:00:00Z")).toBe(true);
  });

  it("accepts equal start and end times (zero-duration job)", () => {
    expect(isValidTimeWindow("2026-07-29T08:00:00Z", "2026-07-29T08:00:00Z")).toBe(true);
  });

  it("rejects scheduled_start > scheduled_end", () => {
    expect(isValidTimeWindow("2026-07-29T12:00:00Z", "2026-07-29T08:00:00Z")).toBe(false);
  });
});

describe("Arrival window ordering", () => {
  it("accepts valid arrival_window_start < arrival_window_end", () => {
    expect(isValidTimeWindow("2026-07-29T10:00:00Z", "2026-07-29T12:00:00Z")).toBe(true);
  });

  it("rejects arrival_window_start > arrival_window_end", () => {
    expect(isValidTimeWindow("2026-07-29T13:00:00Z", "2026-07-29T11:00:00Z")).toBe(false);
  });

  it("accepts when only start is provided (no end)", () => {
    expect(isValidTimeWindow("2026-07-29T10:00:00Z", null)).toBe(true);
  });

  it("accepts when only end is provided (no start)", () => {
    expect(isValidTimeWindow(null, "2026-07-29T12:00:00Z")).toBe(true);
  });
});

// ─── parseDatetimeLocalInput edge cases ──────────────────────────────────────

describe("parseDatetimeLocalInput edge cases", () => {
  it("handles whitespace-only input", () => {
    expect(parseDatetimeLocalInput("   ")).toBeNull();
  });

  it("handles ISO timestamp with timezone suffix", () => {
    // Full ISO strings should parse (they're already normalised)
    const result = parseDatetimeLocalInput("2026-07-29T09:00:00Z");
    expect(result).not.toBeNull();
  });
});
