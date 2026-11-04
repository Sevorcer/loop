import { describe, expect, it } from "vitest";

import { detectMimeType, verifyMimeType } from "../mimeVerify";

const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]);
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
const GIF_HEADER = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46,
  0x00, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
]);

describe("detectMimeType", () => {
  it("detects JPEG from magic bytes", () => {
    expect(detectMimeType(JPEG_HEADER)).toBe("image/jpeg");
  });

  it("detects PNG from magic bytes", () => {
    expect(detectMimeType(PNG_HEADER)).toBe("image/png");
  });

  it("detects PDF from magic bytes", () => {
    expect(detectMimeType(PDF_HEADER)).toBe("application/pdf");
  });

  it("detects GIF from magic bytes", () => {
    expect(detectMimeType(GIF_HEADER)).toBe("image/gif");
  });

  it("detects WebP from magic bytes", () => {
    expect(detectMimeType(WEBP_HEADER)).toBe("image/webp");
  });

  it("returns null for unknown formats", () => {
    expect(detectMimeType(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(detectMimeType(new Uint8Array([]))).toBeNull();
  });
});

describe("verifyMimeType", () => {
  it("returns null when actual type matches claimed type", () => {
    expect(verifyMimeType(JPEG_HEADER, "image/jpeg")).toBeNull();
    expect(verifyMimeType(PNG_HEADER, "image/png")).toBeNull();
    expect(verifyMimeType(PDF_HEADER, "application/pdf")).toBeNull();
  });

  it("normalizes image/jpg to image/jpeg", () => {
    expect(verifyMimeType(JPEG_HEADER, "image/jpg")).toBeNull();
  });

  it("returns error when claimed type does not match actual content", () => {
    const error = verifyMimeType(JPEG_HEADER, "image/png");
    expect(error).not.toBeNull();
    expect(error).toContain("does not match");
  });

  it("returns error when PDF claims to be an image", () => {
    const error = verifyMimeType(PDF_HEADER, "image/jpeg");
    expect(error).not.toBeNull();
    expect(error).toContain("application/pdf");
  });

  it("allows unrecognized file types through", () => {
    expect(verifyMimeType(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]), "application/octet-stream")).toBeNull();
  });
});
