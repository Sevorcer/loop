import { describe, expect, it } from "vitest";

import {
  DEFAULT_JOB_APPOINTMENT_HOUR,
  parseJobAppointmentHour,
  isValidJobAppointmentHour,
  formatJobAppointmentHour,
  JOB_APPOINTMENT_HOURS,
} from "../utils/appointmentWindow";

describe("appointmentHour", () => {
  it("defaults to 9 when no value is provided", () => {
    expect(parseJobAppointmentHour(undefined)).toBe(DEFAULT_JOB_APPOINTMENT_HOUR);
    expect(parseJobAppointmentHour("")).toBe(DEFAULT_JOB_APPOINTMENT_HOUR);
    expect(parseJobAppointmentHour(null)).toBe(DEFAULT_JOB_APPOINTMENT_HOUR);
  });

  it("accepts all valid appointment hours 1-12", () => {
    for (const hour of JOB_APPOINTMENT_HOURS) {
      expect(parseJobAppointmentHour(hour)).toBe(hour);
    }
  });

  it("accepts numeric string values 1-12", () => {
    expect(parseJobAppointmentHour("9")).toBe(9);
    expect(parseJobAppointmentHour("1")).toBe(1);
    expect(parseJobAppointmentHour("12")).toBe(12);
  });

  it("throws for hour 0", () => {
    expect(() => parseJobAppointmentHour(0)).toThrow(/invalid appointment hour/i);
  });

  it("throws for hour 13", () => {
    expect(() => parseJobAppointmentHour(13)).toThrow(/invalid appointment hour/i);
  });

  it("throws for non-integer values", () => {
    expect(() => parseJobAppointmentHour(9.5)).toThrow(/invalid appointment hour/i);
  });

  it("throws for string values outside 1-12", () => {
    expect(() => parseJobAppointmentHour("0")).toThrow(/invalid appointment hour/i);
    expect(() => parseJobAppointmentHour("13")).toThrow(/invalid appointment hour/i);
  });

  it("throws for non-numeric strings", () => {
    expect(() => parseJobAppointmentHour("Morning")).toThrow(/invalid appointment hour/i);
    expect(() => parseJobAppointmentHour("Afternoon")).toThrow(/invalid appointment hour/i);
  });
});

describe("isValidJobAppointmentHour", () => {
  it("returns true for integers 1-12", () => {
    for (const hour of JOB_APPOINTMENT_HOURS) {
      expect(isValidJobAppointmentHour(hour)).toBe(true);
    }
  });

  it("returns false for 0 and 13", () => {
    expect(isValidJobAppointmentHour(0)).toBe(false);
    expect(isValidJobAppointmentHour(13)).toBe(false);
  });

  it("returns false for strings", () => {
    expect(isValidJobAppointmentHour("9")).toBe(false);
    expect(isValidJobAppointmentHour("Morning")).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isValidJobAppointmentHour(null)).toBe(false);
    expect(isValidJobAppointmentHour(undefined)).toBe(false);
  });
});

describe("formatJobAppointmentHour", () => {
  it("formats hours 1-11 as AM", () => {
    expect(formatJobAppointmentHour(1)).toBe("1:00 AM");
    expect(formatJobAppointmentHour(9)).toBe("9:00 AM");
    expect(formatJobAppointmentHour(11)).toBe("11:00 AM");
  });

  it("formats hour 12 as PM", () => {
    expect(formatJobAppointmentHour(12)).toBe("12:00 PM");
  });
});
