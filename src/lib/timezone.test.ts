import { describe, expect, it } from "vitest";

import {
  companyCalendarDate,
  companyTimeOfDay,
  hoursBetweenIso,
  shiftIsoToCompanyDate,
  todayInCompanyTimeZone,
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

  it("reports the company day, not the UTC day, in the evening Pacific", () => {
    // 2026-11-03T04:30:00Z is 8:30 PM Pacific on Nov 2 (PST, UTC-8). A UTC
    // "today" (new Date().toISOString().slice(0,10)) would read 2026-11-03 and
    // flip the dashboard/command-center "today" tiles a day early. The company
    // day is still Nov 2.
    const eveningPacific = new Date("2026-11-03T04:30:00.000Z");
    expect(todayInCompanyTimeZone(eveningPacific, "America/Los_Angeles")).toBe("2026-11-02");
    expect(eveningPacific.toISOString().slice(0, 10)).toBe("2026-11-03");
  });

  it("agrees with the UTC day earlier in the Pacific afternoon", () => {
    // 2026-11-02T20:00:00Z is 12:00 PM Pacific on Nov 2 — same calendar day in
    // both zones, so the switch does not move same-day reads.
    const middayPacific = new Date("2026-11-02T20:00:00.000Z");
    expect(todayInCompanyTimeZone(middayPacific, "America/Los_Angeles")).toBe("2026-11-02");
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
