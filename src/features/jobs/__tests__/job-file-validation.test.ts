import { describe, expect, it } from "vitest";

import {
  validateJobFile,
  formatFileSize,
  ALLOWED_JOB_FILE_MIME_TYPES,
  MAX_JOB_FILE_SIZE_BYTES,
} from "@/lib/fileValidation";

// ─── validateJobFile ──────────────────────────────────────────────────────────

describe("validateJobFile", () => {
  it("accepts JPEG images", () => {
    expect(validateJobFile({ mimeType: "image/jpeg", sizeBytes: 1024 })).toBeNull();
  });

  it("accepts PNG images", () => {
    expect(validateJobFile({ mimeType: "image/png", sizeBytes: 1024 })).toBeNull();
  });

  it("accepts WebP images", () => {
    expect(validateJobFile({ mimeType: "image/webp", sizeBytes: 1024 })).toBeNull();
  });

  it("accepts HEIC images", () => {
    expect(validateJobFile({ mimeType: "image/heic", sizeBytes: 1024 })).toBeNull();
  });

  it("accepts HEIF images", () => {
    expect(validateJobFile({ mimeType: "image/heif", sizeBytes: 1024 })).toBeNull();
  });

  it("accepts PDF documents", () => {
    expect(validateJobFile({ mimeType: "application/pdf", sizeBytes: 512 * 1024 })).toBeNull();
  });

  it("rejects disallowed MIME type", () => {
    const result = validateJobFile({ mimeType: "video/mp4", sizeBytes: 1024 });
    expect(result).not.toBeNull();
    expect(result).toContain("video/mp4");
  });

  it("rejects application/octet-stream (unknown binary)", () => {
    const result = validateJobFile({ mimeType: "application/octet-stream", sizeBytes: 1024 });
    expect(result).not.toBeNull();
  });

  it("rejects a file that exceeds the maximum size", () => {
    const oversizedBytes = MAX_JOB_FILE_SIZE_BYTES + 1;
    const result = validateJobFile({ mimeType: "image/jpeg", sizeBytes: oversizedBytes });
    expect(result).not.toBeNull();
    expect(result).toContain("too large");
  });

  it("accepts a file exactly at the size limit", () => {
    expect(
      validateJobFile({ mimeType: "image/jpeg", sizeBytes: MAX_JOB_FILE_SIZE_BYTES }),
    ).toBeNull();
  });

  it("is case-insensitive for MIME type", () => {
    expect(validateJobFile({ mimeType: "IMAGE/JPEG", sizeBytes: 1024 })).toBeNull();
  });
});

// ─── formatFileSize ───────────────────────────────────────────────────────────

describe("formatFileSize", () => {
  it("formats bytes below 1 KB", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats bytes in kilobytes range", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats bytes in megabytes range", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats exactly 1 KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });
});

// ─── ALLOWED_JOB_FILE_MIME_TYPES set ─────────────────────────────────────────

describe("ALLOWED_JOB_FILE_MIME_TYPES", () => {
  it("contains all expected image types", () => {
    for (const type of ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]) {
      expect(ALLOWED_JOB_FILE_MIME_TYPES.has(type)).toBe(true);
    }
  });

  it("contains PDF", () => {
    expect(ALLOWED_JOB_FILE_MIME_TYPES.has("application/pdf")).toBe(true);
  });

  it("does not contain arbitrary types", () => {
    expect(ALLOWED_JOB_FILE_MIME_TYPES.has("text/html")).toBe(false);
    expect(ALLOWED_JOB_FILE_MIME_TYPES.has("application/zip")).toBe(false);
  });
});
