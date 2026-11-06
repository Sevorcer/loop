import { describe, expect, it, vi } from "vitest";

import {
  createPendingUpload,
  formatPendingUploadError,
  uploadFailureMessage,
} from "../jobFileUploadQueue";

describe("uploadFailureMessage", () => {
  it("prefers the API message field over a generic error code", () => {
    expect(
      uploadFailureMessage({
        error: "VALIDATION_ERROR",
        message: "HEIC files over 20 MB are not allowed.",
      }),
    ).toBe("HEIC files over 20 MB are not allowed.");
  });

  it("falls back to a named HTTP failure when the body is empty", () => {
    expect(uploadFailureMessage(null, "Upload failed (HTTP 500).")).toBe(
      "Upload failed (HTTP 500).",
    );
  });

  it("uses a non-generic error code when no message is present", () => {
    expect(uploadFailureMessage({ error: "You are not assigned to this job." })).toBe(
      "You are not assigned to this job.",
    );
  });
});

describe("formatPendingUploadError", () => {
  it("keeps the file name with the reason", () => {
    expect(formatPendingUploadError("IMG_8373.jpeg", "Storage upload failed after 3 attempts: ...")).toBe(
      "IMG_8373.jpeg: Storage upload failed after 3 attempts: ...",
    );
  });
});

describe("createPendingUpload", () => {
  it("starts queued with an image preview URL", () => {
    const createObjectURL = vi.fn(() => "blob:preview");
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    const file = new File([new Uint8Array([1, 2, 3])], "shot.jpg", { type: "image/jpeg" });
    const pending = createPendingUpload(file, "pending-1");

    expect(pending.status).toBe("queued");
    expect(pending.error).toBeNull();
    expect(pending.previewUrl).toBe("blob:preview");
    expect(createObjectURL).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it("skips preview URLs for non-images", () => {
    const file = new File([new Uint8Array([1])], "spec.pdf", { type: "application/pdf" });
    const pending = createPendingUpload(file, "pending-2");
    expect(pending.previewUrl).toBeNull();
  });
});
