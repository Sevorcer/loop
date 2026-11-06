import { describe, expect, it } from "vitest";

import {
  NAMEPLATE_CHOOSE_SYSTEM_MESSAGE,
  NAMEPLATE_CONFIRM_REQUIRED_MESSAGE,
  NAMEPLATE_NO_NAMEPLATE_MESSAGE,
  NAMEPLATE_NO_SYSTEM_MESSAGE,
  NAMEPLATE_UNREADABLE_MESSAGE,
  chooseNameplateHit,
  decideNameplateSave,
  extractionFromModelPayload,
  isNameplateCandidate,
  isNameplateSaveAttempt,
  mergeConfirmedSerial,
  resolveNameplateSystem,
  reviewFromExtraction,
  type NameplateExtraction,
} from "../nameplateRead";

const EXISTING_MODEL = "OLD-MODEL-1";
const EXISTING_SERIAL = "OLD-SERIAL-9";

function extraction(partial: Partial<NameplateExtraction> & { status: NameplateExtraction["status"] }): NameplateExtraction {
  return {
    modelNumber: null,
    serialNumber: null,
    message: "",
    ...partial,
  };
}

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

  it("prefers a job photo that has both model and serial", () => {
    const chosen = chooseNameplateHit([
      {
        fileId: "site",
        fileName: "site.jpg",
        extraction: extraction({ status: "read", modelNumber: "ONLY-1" }),
      },
      {
        fileId: "plate",
        fileName: "plate.heic",
        extraction: extraction({ status: "read", modelNumber: "MXZ-3C24NAHZ2", serialNumber: "SN1234567" }),
      },
    ]);

    expect(chosen?.fileId).toBe("plate");
  });

  it("says no nameplate was found when every photo is unreadable", () => {
    expect(chooseNameplateHit([
      { fileId: "a", fileName: "a.jpg", extraction: extraction({ status: "unreadable", message: NAMEPLATE_NO_NAMEPLATE_MESSAGE }) },
    ])).toBeNull();
  });

  it("treats an iPhone HEIC file as a photo even with a generic type", () => {
    expect(isNameplateCandidate({ mimeType: "application/octet-stream", fileName: "IMG_2043.HEIC" })).toBe(true);
    expect(isNameplateCandidate({ mimeType: "application/pdf", fileName: "manual.pdf" })).toBe(false);
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

  it("uses the only installed system on the job", () => {
    expect(resolveNameplateSystem([{ id: "sys-1" }], undefined)).toEqual({ ok: true, id: "sys-1" });
  });

  it("requires a choice when the job has more than one system", () => {
    const decision = resolveNameplateSystem([{ id: "sys-1" }, { id: "sys-2" }], undefined);
    expect(decision).toEqual({ ok: false, message: NAMEPLATE_CHOOSE_SYSTEM_MESSAGE });
    expect(resolveNameplateSystem([{ id: "sys-1" }, { id: "sys-2" }], "sys-2")).toEqual({ ok: true, id: "sys-2" });
  });

  it("refuses a system that is not on the job and a job with no system", () => {
    expect(resolveNameplateSystem([], "sys-1")).toEqual({ ok: false, message: NAMEPLATE_NO_SYSTEM_MESSAGE });
    expect(resolveNameplateSystem([{ id: "sys-1" }], "other").ok).toBe(false);
  });

  it("does not treat a search by itself as a save", () => {
    expect(isNameplateSaveAttempt({})).toBe(false);
  });
});
