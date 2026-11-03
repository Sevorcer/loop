import { describe, expect, it } from "vitest";

import {
  applyDateTimePartChange,
  formatDateTimeLocal,
  parseDateTimeLocal,
  parseDefaultTime,
} from "@/components/atlas/DateTimePicker";
import { isInstallDateValueValid } from "@/features/installed-systems/components/InstalledSystemForm";

describe("DateTimePicker helpers (F11)", () => {
  it("parses a datetime-local value into labeled parts", () => {
    expect(parseDateTimeLocal("2026-09-30T09:05")).toEqual({
      date: "2026-09-30",
      hour12: "9",
      minute: "05",
      period: "AM",
    });
    expect(parseDateTimeLocal("2026-09-30T14:30")).toEqual({
      date: "2026-09-30",
      hour12: "2",
      minute: "30",
      period: "PM",
    });
    expect(parseDateTimeLocal("2026-09-30T00:00")).toEqual({
      date: "2026-09-30",
      hour12: "12",
      minute: "00",
      period: "AM",
    });
    expect(parseDateTimeLocal("2026-09-30T12:00")).toEqual({
      date: "2026-09-30",
      hour12: "12",
      minute: "00",
      period: "PM",
    });
  });

  it("returns empty parts for blank/invalid values", () => {
    expect(parseDateTimeLocal("")).toEqual({ date: "", hour12: "", minute: "", period: "" });
    expect(parseDateTimeLocal("not-a-date")).toEqual({ date: "", hour12: "", minute: "", period: "" });
  });

  it("formats parts back into datetime-local values", () => {
    expect(
      formatDateTimeLocal({ date: "2026-09-30", hour12: "9", minute: "05", period: "AM" }),
    ).toBe("2026-09-30T09:05");
    expect(
      formatDateTimeLocal({ date: "2026-09-30", hour12: "2", minute: "30", period: "PM" }),
    ).toBe("2026-09-30T14:30");
    expect(
      formatDateTimeLocal({ date: "2026-09-30", hour12: "12", minute: "00", period: "AM" }),
    ).toBe("2026-09-30T00:00");
  });

  it("returns empty string unless all parts are present and valid", () => {
    expect(formatDateTimeLocal({ date: "", hour12: "9", minute: "05", period: "AM" })).toBe("");
    expect(formatDateTimeLocal({ date: "2026-09-30", hour12: "", minute: "05", period: "AM" })).toBe("");
    expect(formatDateTimeLocal({ date: "2026-09-30", hour12: "9", minute: "05", period: "" })).toBe("");
    expect(formatDateTimeLocal({ date: "2026-13-99", hour12: "9", minute: "05", period: "AM" })).toBe("2026-13-99T09:05");
  });

  it("round-trips parse -> format", () => {
    for (const value of ["2026-09-30T09:05", "2026-09-30T14:30", "2026-01-01T00:00"]) {
      expect(formatDateTimeLocal(parseDateTimeLocal(value))).toBe(value);
    }
  });
});

describe("applyDateTimePartChange (F11 regression: partial input must stick)", () => {
  it("preserves each chosen part until all parts are filled", () => {
    // Simulates a user filling the picker one control at a time: hour, then
    // minute, then AM/PM, then date. Before this fix the component derived the
    // parts from `value` on every render, so each choice was wiped because the
    // combined value stayed "" until complete — the picker could never be filled.
    let parts = { date: "", hour12: "", minute: "", period: "" };

    let r = applyDateTimePartChange(parts, "hour12", "9");
    expect(r.next.hour12).toBe("9");
    expect(r.combined).toBe("");
    parts = r.next;

    r = applyDateTimePartChange(parts, "minute", "05");
    expect(r.next).toEqual({ date: "", hour12: "9", minute: "05", period: "" });
    expect(r.combined).toBe("");
    parts = r.next;

    r = applyDateTimePartChange(parts, "period", "AM");
    expect(r.next.period).toBe("AM");
    expect(r.combined).toBe("");
    parts = r.next;

    r = applyDateTimePartChange(parts, "date", "2026-09-30");
    expect(r.next).toEqual({ date: "2026-09-30", hour12: "9", minute: "05", period: "AM" });
    expect(r.combined).toBe("2026-09-30T09:05");
  });

  it("converts PM hours to 24h on completion", () => {
    const parts = { date: "2026-09-30", hour12: "2", minute: "30", period: "" };
    const r = applyDateTimePartChange(parts, "period", "PM");
    expect(r.combined).toBe("2026-09-30T14:30");
  });
});

describe("parseDefaultTime (date-only fallback parts)", () => {
  it("parses a 24h HH:mm into labeled picker parts", () => {
    expect(parseDefaultTime("17:00")).toEqual({ hour12: "5", minute: "00", period: "PM" });
    expect(parseDefaultTime("00:30")).toEqual({ hour12: "12", minute: "30", period: "AM" });
    expect(parseDefaultTime("12:00")).toEqual({ hour12: "12", minute: "00", period: "PM" });
    expect(parseDefaultTime("9:05")).toEqual({ hour12: "9", minute: "05", period: "AM" });
  });

  it("rejects blank or out-of-range values", () => {
    expect(parseDefaultTime("")).toBeNull();
    expect(parseDefaultTime(null)).toBeNull();
    expect(parseDefaultTime("25:00")).toBeNull();
    expect(parseDefaultTime("10:61")).toBeNull();
    expect(parseDefaultTime("noon")).toBeNull();
  });
});

describe("applyDateTimePartChange — date-only default (T3: end date must not be dropped)", () => {
  // The New Job form's Scheduled End is optional and commonly entered as just a
  // day ("runs through Nov 5"). Without a fallback the picker emits "" until a
  // time is also chosen, so the end — and the whole multi-day span — was lost.
  it("commits a date-only end by defaulting the time to the supplied fallback", () => {
    const parts = { date: "", hour12: "", minute: "", period: "" };
    const r = applyDateTimePartChange(parts, "date", "2026-11-05", "17:00");
    // Both the emitted value and the visible parts carry the default time.
    expect(r.combined).toBe("2026-11-05T17:00");
    expect(r.next).toEqual({ date: "2026-11-05", hour12: "5", minute: "00", period: "PM" });
  });

  it("lets an explicit time override the default once picked", () => {
    let parts = { date: "", hour12: "", minute: "", period: "" };
    parts = applyDateTimePartChange(parts, "date", "2026-11-05", "17:00").next;
    const r = applyDateTimePartChange(parts, "hour12", "9", "17:00");
    // Hour becomes 9, minute/period keep the already-filled default -> 9:00 PM.
    expect(r.combined).toBe("2026-11-05T21:00");
  });

  it("clears the value when the date is removed, fallback notwithstanding", () => {
    const parts = { date: "2026-11-05", hour12: "5", minute: "00", period: "PM" };
    const r = applyDateTimePartChange(parts, "date", "", "17:00");
    expect(r.combined).toBe("");
  });

  it("leaves behavior unchanged when no fallback is supplied (start/arrival fields)", () => {
    const parts = { date: "", hour12: "", minute: "", period: "" };
    const r = applyDateTimePartChange(parts, "date", "2026-11-05");
    expect(r.combined).toBe("");
    expect(r.next).toEqual({ date: "2026-11-05", hour12: "", minute: "", period: "" });
  });
});

describe("isInstallDateValueValid (F9)", () => {
  it("accepts a year or a full date", () => {
    expect(isInstallDateValueValid("2024")).toBe(true);
    expect(isInstallDateValueValid("2024-06-15")).toBe(true);
  });

  it("rejects blank and malformed values", () => {
    expect(isInstallDateValueValid("")).toBe(false);
    expect(isInstallDateValueValid("June 2024")).toBe(false);
    expect(isInstallDateValueValid("24")).toBe(false);
    expect(isInstallDateValueValid("2024-6-5")).toBe(false);
  });
});
