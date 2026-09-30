import { describe, expect, it } from "vitest";

import {
  formatDateTimeLocal,
  parseDateTimeLocal,
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
