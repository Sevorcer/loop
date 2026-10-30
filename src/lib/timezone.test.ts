import { describe, expect, it } from "vitest";

import {
  companyCalendarDate,
  companyTimeOfDay,
  hoursBetweenIso,
  shiftIsoToCompanyDate,
  utcIsoToCompanyDateTimeLocal,
  zonedWallTimeToUtcIso,
} from "./timezone";

describe("company timezone scheduling", () => {
  it("stores 2:00 PM Pacific on Oct 30 as 21:00 UTC the same day", () => {
    expect(
      zonedWallTimeToUtcIso({
        year: 2026,
        month: 10,
        day: 30,
        hour: 14,
        minute: 0,
        timeZone: "America/Los_Angeles",
      }),
    ).toBe("2026-10-30T21:00:00.000Z");
  });

  it("keeps a 2:00–5:00 PM Pacific window on Oct 30, not Oct 31", () => {
    const start = zonedWallTimeToUtcIso({
      year: 2026,
      month: 10,
      day: 30,
      hour: 14,
      minute: 0,
      timeZone: "America/Los_Angeles",
    });
    const end = zonedWallTimeToUtcIso({
      year: 2026,
      month: 10,
      day: 30,
      hour: 17,
      minute: 0,
      timeZone: "America/Los_Angeles",
    });

    expect(end).toBe("2026-10-31T00:00:00.000Z");
    expect(companyCalendarDate(start, "America/Los_Angeles")).toBe("2026-10-30");
    expect(companyCalendarDate(end, "America/Los_Angeles")).toBe("2026-10-30");
    expect(hoursBetweenIso(start, end)).toBe(3);
    expect(companyTimeOfDay(start, "America/Los_Angeles")).toBe("14:00");
    expect(companyTimeOfDay(end, "America/Los_Angeles")).toBe("17:00");
  });

  it("round-trips a company wall clock through datetime-local", () => {
    const iso = "2026-10-30T21:00:00.000Z";
    expect(utcIsoToCompanyDateTimeLocal(iso, "America/Los_Angeles")).toBe("2026-10-30T14:00");
  });

  it("moves a window onto another company date without changing the clock time", () => {
    const shifted = shiftIsoToCompanyDate(
      "2026-10-30T21:00:00.000Z",
      "2026-11-02",
      "America/Los_Angeles",
    );
    expect(companyCalendarDate(shifted, "America/Los_Angeles")).toBe("2026-11-02");
    expect(companyTimeOfDay(shifted, "America/Los_Angeles")).toBe("14:00");
  });
});
