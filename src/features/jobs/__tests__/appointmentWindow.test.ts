import { describe, expect, it } from "vitest";

import {
  DEFAULT_JOB_APPOINTMENT_WINDOW,
  parseJobAppointmentWindow,
} from "../utils/appointmentWindow";

describe("appointmentWindow", () => {
  it("defaults to Morning when no value is provided", () => {
    expect(parseJobAppointmentWindow(undefined)).toBe(DEFAULT_JOB_APPOINTMENT_WINDOW);
    expect(parseJobAppointmentWindow("")).toBe(DEFAULT_JOB_APPOINTMENT_WINDOW);
  });

  it("accepts valid appointment windows", () => {
    expect(parseJobAppointmentWindow("Morning")).toBe("Morning");
    expect(parseJobAppointmentWindow("Afternoon")).toBe("Afternoon");
  });

  it("throws for invalid appointment windows", () => {
    expect(() => parseJobAppointmentWindow("Evening")).toThrow(/invalid appointment window/i);
  });
});
