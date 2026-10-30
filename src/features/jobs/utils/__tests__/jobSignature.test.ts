import { describe, expect, it } from "vitest";

import {
  canCaptureSignature,
  formatSignatureCaption,
  formatSignatureWhen,
  signatureCaptureError,
} from "../jobSignature";

describe("signature capture", () => {
  it("lets a technician or the office capture a signature", () => {
    expect(canCaptureSignature("tech")).toBe(true);
    expect(canCaptureSignature("office")).toBe(true);
    expect(canCaptureSignature("owner")).toBe(true);
    expect(canCaptureSignature("manager")).toBe(true);
  });

  it("keeps dispatch, sales, and portal from capturing a signature", () => {
    expect(canCaptureSignature("dispatch")).toBe(false);
    expect(canCaptureSignature("sales")).toBe(false);
    expect(canCaptureSignature("portal")).toBe(false);
    expect(canCaptureSignature(null)).toBe(false);
  });

  it("names every missing piece instead of a vague failure", () => {
    expect(signatureCaptureError({ signerName: "  ", hasInk: false })).toBe(
      "Add the customer's name and a signature in the box before saving.",
    );
    expect(signatureCaptureError({ signerName: "Ada Lovelace", hasInk: false })).toBe(
      "Add a signature in the box before saving.",
    );
    expect(signatureCaptureError({ signerName: "", hasInk: true })).toBe(
      "Add the customer's name before saving.",
    );
  });

  it("accepts a named signature", () => {
    expect(signatureCaptureError({ signerName: "Ada Lovelace", hasInk: true })).toBeNull();
  });

  it("describes who signed and when, in the company timezone", () => {
    const when = formatSignatureWhen("2026-10-30T20:15:00.000Z", "America/Los_Angeles");
    expect(when).toBe("Oct 30, 2026, 1:15 PM");
    expect(
      formatSignatureCaption({
        signerName: "Ada Lovelace",
        capturedByName: "Antonio",
        capturedAt: "2026-10-30T20:15:00.000Z",
        timeZone: "America/Los_Angeles",
      }),
    ).toBe("Ada Lovelace signed Oct 30, 2026, 1:15 PM. Captured by Antonio.");
  });
});
