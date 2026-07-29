import { describe, it, expect } from "vitest";

import {
  formatScheduledShort,
  parseDatetimeLocalInput,
  toDatetimeLocalValue,
  isValidTimeWindow,
  getTimeWindowError,
  deriveScheduledStartAt,
} from "../utils/schedulingTime";

// ─── formatScheduledShort ────────────────────────────────────────────────────

describe("formatScheduledShort", () => {
  it("returns — for null", () => {
    expect(formatScheduledShort(null)).toBe("—");
  });

  it("returns — for undefined", () => {
    expect(formatScheduledShort(undefined)).toBe("—");
  });

  it("returns — for empty string", () => {
    expect(formatScheduledShort("")).toBe("—");
  });

  it("returns — for an invalid date string", () => {
    expect(formatScheduledShort("not-a-date")).toBe("—");
  });

  it("returns a non-empty string for a valid ISO timestamp", () => {
    const result = formatScheduledShort("2026-07-29T09:00:00Z");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("—");
  });

  it("returns a non-empty string for a date-only string", () => {
    const result = formatScheduledShort("2026-07-29");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("—");
  });
});

// ─── parseDatetimeLocalInput ─────────────────────────────────────────────────

describe("parseDatetimeLocalInput", () => {
  it("returns null for null", () => {
    expect(parseDatetimeLocalInput(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseDatetimeLocalInput(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDatetimeLocalInput("")).toBeNull();
  });

  it("normalises YYYY-MM-DDTHH:mm to YYYY-MM-DDTHH:mm:00", () => {
    expect(parseDatetimeLocalInput("2026-07-29T09:00")).toBe("2026-07-29T09:00:00");
  });

  it("returns the value unchanged when already HH:mm:ss", () => {
    expect(parseDatetimeLocalInput("2026-07-29T09:00:00")).toBe("2026-07-29T09:00:00");
  });

  it("returns null for obviously invalid input", () => {
    expect(parseDatetimeLocalInput("not-a-date")).toBeNull();
  });
});

// ─── toDatetimeLocalValue ────────────────────────────────────────────────────

describe("toDatetimeLocalValue", () => {
  it("returns empty string for null", () => {
    expect(toDatetimeLocalValue(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(toDatetimeLocalValue(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(toDatetimeLocalValue("")).toBe("");
  });

  it("returns a YYYY-MM-DDTHH:mm format string for a valid ISO timestamp", () => {
    // Use a known UTC timestamp and parse in local time
    // We can't assume timezone, but the format should be right
    const result = toDatetimeLocalValue("2026-07-29T09:00:00Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

// ─── isValidTimeWindow ────────────────────────────────────────────────────────

describe("isValidTimeWindow", () => {
  it("returns true when both are null", () => {
    expect(isValidTimeWindow(null, null)).toBe(true);
  });

  it("returns true when start is null", () => {
    expect(isValidTimeWindow(null, "2026-07-29T09:00:00Z")).toBe(true);
  });

  it("returns true when end is null", () => {
    expect(isValidTimeWindow("2026-07-29T09:00:00Z", null)).toBe(true);
  });

  it("returns true when start equals end", () => {
    expect(isValidTimeWindow("2026-07-29T09:00:00Z", "2026-07-29T09:00:00Z")).toBe(true);
  });

  it("returns true when start is before end", () => {
    expect(isValidTimeWindow("2026-07-29T09:00:00Z", "2026-07-29T11:00:00Z")).toBe(true);
  });

  it("returns false when start is after end", () => {
    expect(isValidTimeWindow("2026-07-29T11:00:00Z", "2026-07-29T09:00:00Z")).toBe(false);
  });

  it("returns false when either value is an invalid date", () => {
    expect(isValidTimeWindow("not-a-date", "2026-07-29T09:00:00Z")).toBe(false);
    expect(isValidTimeWindow("2026-07-29T09:00:00Z", "not-a-date")).toBe(false);
  });
});

// ─── getTimeWindowError ───────────────────────────────────────────────────────

describe("getTimeWindowError", () => {
  it("returns null for a valid window", () => {
    expect(getTimeWindowError("2026-07-29T09:00:00Z", "2026-07-29T11:00:00Z")).toBeNull();
  });

  it("returns null when either boundary is absent", () => {
    expect(getTimeWindowError(null, "2026-07-29T11:00:00Z")).toBeNull();
    expect(getTimeWindowError("2026-07-29T09:00:00Z", null)).toBeNull();
  });

  it("returns a non-null error message for an invalid window", () => {
    const err = getTimeWindowError("2026-07-29T11:00:00Z", "2026-07-29T09:00:00Z");
    expect(err).not.toBeNull();
    expect(typeof err).toBe("string");
    expect((err as string).length).toBeGreaterThan(0);
  });

  it("includes the custom label in the error message", () => {
    const err = getTimeWindowError(
      "2026-07-29T11:00:00Z",
      "2026-07-29T09:00:00Z",
      "arrival window end",
    );
    expect(err).toContain("arrival window end");
  });
});

// ─── deriveScheduledStartAt ───────────────────────────────────────────────────

describe("deriveScheduledStartAt", () => {
  it("returns null for null scheduledFor", () => {
    expect(deriveScheduledStartAt(null)).toBeNull();
  });

  it("returns null for undefined scheduledFor", () => {
    expect(deriveScheduledStartAt(undefined)).toBeNull();
  });

  it("returns null for an empty scheduledFor string", () => {
    expect(deriveScheduledStartAt("")).toBeNull();
  });

  it("returns null for a non-date string", () => {
    expect(deriveScheduledStartAt("not-a-date")).toBeNull();
  });

  it("returns a UTC ISO string combining date + default hour (9)", () => {
    const result = deriveScheduledStartAt("2026-07-29");
    expect(result).toBe("2026-07-29T09:00:00Z");
  });

  it("uses the supplied appointment hour", () => {
    expect(deriveScheduledStartAt("2026-07-29", 1)).toBe("2026-07-29T01:00:00Z");
    expect(deriveScheduledStartAt("2026-07-29", 12)).toBe("2026-07-29T12:00:00Z");
  });

  it("pads hours below 10 with a leading zero", () => {
    expect(deriveScheduledStartAt("2026-07-29", 8)).toBe("2026-07-29T08:00:00Z");
  });
});
