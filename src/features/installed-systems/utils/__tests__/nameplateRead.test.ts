import { describe, expect, it } from "vitest";

import {
  NAMEPLATE_CONFIRM_REQUIRED_MESSAGE,
  NAMEPLATE_UNREADABLE_MESSAGE,
  decideNameplateSave,
  extractionFromModelPayload,
  isNameplateSaveAttempt,
  mergeConfirmedSerial,
  reviewFromExtraction,
  validateNameplatePhoto,
} from "../nameplateRead";

const EXISTING_MODEL = "OLD-MODEL-1";
const EXISTING_SERIAL = "OLD-SERIAL-9";

describe("nameplate read proposal", () => {
  it("proposes model and serial from a successful read and does not describe them as saved", () => {
    const review = reviewFromExtraction({
      existingModel: EXISTING_MODEL,
      existingSerial: EXISTING_SERIAL,
      extraction: extractionFromModelPayload({
        readable: true,
        modelNumber: "MXZ-3C24NAHZ2",
        serialNumber: "SN1234567",
      }),
    });

    expect(review.status).toBe("proposed");
    expect(review.modelNumber).toBe("MXZ-3C24NAHZ2");
    expect(review.serialNumber).toBe("SN1234567");
    expect(review.modelFromPhoto).toBe(true);
    expect(review.serialFromPhoto).toBe(true);
    expect(review.message).toMatch(/nothing is saved until you confirm/i);
    expect(review).not.toHaveProperty("saved");
  });

  it("keeps the current serial in the draft when the photo only has a model", () => {
    const review = reviewFromExtraction({
      existingModel: EXISTING_MODEL,
      existingSerial: EXISTING_SERIAL,
      extraction: extractionFromModelPayload({
        readable: true,
        modelNumber: "MXZ-3C24NAHZ2",
        serialNumber: null,
      }),
    });

    expect(review.status).toBe("proposed");
    expect(review.modelNumber).toBe("MXZ-3C24NAHZ2");
    expect(review.serialNumber).toBe(EXISTING_SERIAL);
    expect(review.serialFromPhoto).toBe(false);
  });

  it("leaves fields unchanged when the photo cannot be read", () => {
    const review = reviewFromExtraction({
      existingModel: EXISTING_MODEL,
      existingSerial: EXISTING_SERIAL,
      extraction: extractionFromModelPayload({
        readable: false,
        modelNumber: "MXZ-3C24NAHZ2",
        serialNumber: "SN1234567",
      }),
    });

    expect(review.status).toBe("unreadable");
    expect(review.modelNumber).toBeNull();
    expect(review.serialNumber).toBeNull();
    expect(review.message).toBe(NAMEPLATE_UNREADABLE_MESSAGE);
  });

  it("drops a guessed sentence instead of treating it as a model", () => {
    const review = reviewFromExtraction({
      existingModel: EXISTING_MODEL,
      existingSerial: EXISTING_SERIAL,
      extraction: extractionFromModelPayload({
        readable: true,
        modelNumber: "could not tell",
        serialNumber: "also unclear",
      }),
    });

    expect(review.status).toBe("unreadable");
    expect(review.modelNumber).toBeNull();
  });
});

describe("nameplate confirmation", () => {
  it("refuses to build a save when confirm is missing or false", () => {
    expect(isNameplateSaveAttempt({ modelNumber: "MXZ-3C24NAHZ2", serialNumber: "SN1234567" })).toBe(true);
    expect(decideNameplateSave({ modelNumber: "MXZ-3C24NAHZ2", serialNumber: "SN1234567" })).toEqual({
      ok: false,
      message: NAMEPLATE_CONFIRM_REQUIRED_MESSAGE,
    });
    expect(decideNameplateSave({
      confirm: false,
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumber: "SN1234567",
    }).ok).toBe(false);
  });

  it("returns the confirmed values only when confirm is true and both fields are present", () => {
    expect(decideNameplateSave({
      confirm: true,
      modelNumber: " MXZ-3C24NAHZ2 ",
      serialNumber: " SN1234567 ",
    })).toEqual({
      ok: true,
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumber: "SN1234567",
    });
  });

  it("refuses an empty confirmation so an existing value cannot be cleared", () => {
    const decision = decideNameplateSave({ confirm: true, modelNumber: "MXZ-3C24NAHZ2", serialNumber: "  " });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.message).toMatch(/left unchanged/i);
  });

  it("replaces the primary serial and keeps any additional serials", () => {
    expect(mergeConfirmedSerial(["OLD-SERIAL-9", "EXTRA-2"], "SN1234567")).toEqual([
      "SN1234567",
      "EXTRA-2",
    ]);
  });

  it("does not treat a photo id by itself as a save", () => {
    expect(isNameplateSaveAttempt({ photoId: "11111111-1111-4111-8111-111111111111" })).toBe(false);
  });
});

describe("nameplate photo validation", () => {
  it("rejects a PDF because it is not a nameplate photo", () => {
    expect(validateNameplatePhoto({ mimeType: "application/pdf", sizeBytes: 1000 })).toMatch(/photo/i);
  });

  it("accepts a jpeg", () => {
    expect(validateNameplatePhoto({ mimeType: "image/jpeg", sizeBytes: 1000 })).toBeNull();
  });
});
