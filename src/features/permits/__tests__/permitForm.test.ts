import { describe, expect, it } from "vitest";

import {
  PERMIT_STATUS_OPTIONS,
  canEditPermits,
  emptyPermitFormValues,
  permitWriteBody,
  validatePermitCreate,
} from "../components/permitForm";

describe("permit create form", () => {
  it("allows the same roles that can edit permits", () => {
    expect(canEditPermits("owner")).toBe(true);
    expect(canEditPermits("manager")).toBe(true);
    expect(canEditPermits("office")).toBe(true);
    expect(canEditPermits("tech")).toBe(false);
    expect(canEditPermits("dispatch")).toBe(false);
    expect(canEditPermits("sales")).toBe(false);
    expect(canEditPermits("portal")).toBe(false);
    expect(canEditPermits(null)).toBe(false);
  });

  it("keeps status labels in Title Case", () => {
    expect(PERMIT_STATUS_OPTIONS.map((option) => option.label)).toEqual([
      "Applied",
      "Intake Scheduled",
      "Corrections Needed",
      "Resubmitted",
      "Waiting on City",
      "Issued",
    ]);
    for (const option of PERMIT_STATUS_OPTIONS) {
      expect(option.label).not.toBe(option.value);
      expect(option.label).not.toBe(option.label.toLowerCase());
    }
  });

  it("requires a job, jurisdiction, and permit type before create", () => {
    const values = emptyPermitFormValues();
    expect(validatePermitCreate({ jobId: null, values })).toBe("Select a job.");
    expect(validatePermitCreate({ jobId: "job-1", values })).toBe(
      "Jurisdiction is required.",
    );
    expect(
      validatePermitCreate({
        jobId: "job-1",
        values: { ...values, jurisdiction: "  Seattle  " },
      }),
    ).toBe("Permit type is required.");
    expect(
      validatePermitCreate({
        jobId: "job-1",
        values: { ...values, jurisdiction: "Seattle", permitType: "Mechanical" },
      }),
    ).toBeNull();
  });

  it("sends the same fields the edit flow saves, with blanks as null", () => {
    const body = permitWriteBody({
      ...emptyPermitFormValues(),
      jurisdiction: " Seattle ",
      permitType: " Mechanical ",
      permitNumber: "  ",
      status: "issued",
      appliedAt: "2026-11-06",
      notes: "  pulled today  ",
    });

    expect(body).toEqual({
      jurisdiction: "Seattle",
      permitType: "Mechanical",
      permitNumber: null,
      status: "issued",
      appliedAt: "2026-11-06",
      intakeAppointmentAt: null,
      issuedAt: null,
      correctionsNotes: null,
      notes: "pulled today",
    });
  });
});
