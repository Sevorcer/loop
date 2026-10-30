import { describe, expect, it } from "vitest";

import { isJobPhotoMime, jobPhotoPreviews } from "../jobPhotoPreviews";

describe("job photo previews", () => {
  it("recognizes image uploads", () => {
    expect(isJobPhotoMime("image/jpeg")).toBe(true);
    expect(isJobPhotoMime("IMAGE/PNG")).toBe(true);
    expect(isJobPhotoMime("application/pdf")).toBe(false);
  });

  it("keeps only images that have a signed preview", () => {
    const files = [
      { id: "1", mimeType: "image/jpeg", previewUrl: "https://example.test/a.jpg" },
      { id: "2", mimeType: "image/png", previewUrl: null },
      { id: "3", mimeType: "application/pdf", previewUrl: "https://example.test/a.pdf" },
    ];

    expect(jobPhotoPreviews(files).map((file) => file.id)).toEqual(["1"]);
  });
});