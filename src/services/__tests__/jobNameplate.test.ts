import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listJobFiles, downloadStorageObjectBytes, extractNameplateFromImage, isNameplateVisionConfigured } = vi.hoisted(() => ({
  listJobFiles: vi.fn(),
  downloadStorageObjectBytes: vi.fn(),
  extractNameplateFromImage: vi.fn(),
  isNameplateVisionConfigured: vi.fn(),
}));

vi.mock("@/services/jobs", () => ({ listJobFiles }));
vi.mock("@/repositories/storage", () => ({ downloadStorageObjectBytes }));
vi.mock("@/services/nameplateVision", () => ({ extractNameplateFromImage, isNameplateVisionConfigured }));

import { NAMEPLATE_NO_NAMEPLATE_MESSAGE, NAMEPLATE_NO_PHOTOS_MESSAGE, NAMEPLATE_UNCONFIGURED_MESSAGE } from "@/features/installed-systems/utils/nameplateRead";
import { searchJobPhotosForNameplate } from "@/services/jobNameplate";

function photo(id: string, fileName: string, mimeType: string) {
  return { id, fileName, mimeType, sizeBytes: 1000 };
}

beforeEach(() => {
  vi.clearAllMocks();
  isNameplateVisionConfigured.mockReturnValue(true);
  downloadStorageObjectBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
});

describe("searchJobPhotosForNameplate", () => {
  it("proposes model and serial from the first nameplate and stops searching", async () => {
    listJobFiles.mockResolvedValue([
      photo("site", "site.jpg", "image/jpeg"),
      photo("plate", "IMG_100.HEIC", "application/octet-stream"),
      photo("later", "later.jpg", "image/jpeg"),
    ]);
    extractNameplateFromImage
      .mockResolvedValueOnce({ status: "unreadable", modelNumber: null, serialNumber: null, message: "no" })
      .mockResolvedValueOnce({
        status: "read",
        modelNumber: "MXZ-3C24NAHZ2",
        serialNumber: "SN1234567",
        message: "Read from a job photo.",
      });

    const result = await searchJobPhotosForNameplate("job-1", "tech");

    expect(result.status).toBe("proposed");
    expect(result.photoFileName).toBe("IMG_100.HEIC");
    expect(result.extraction.modelNumber).toBe("MXZ-3C24NAHZ2");
    expect(result.extraction.serialNumber).toBe("SN1234567");
    expect(extractNameplateFromImage).toHaveBeenCalledTimes(2);
    expect(extractNameplateFromImage).toHaveBeenNthCalledWith(2, expect.any(Uint8Array), "image/heic");
    expect(downloadStorageObjectBytes).not.toHaveBeenCalledWith("later");
  });

  it("says no nameplate was found and does not invent values", async () => {
    listJobFiles.mockResolvedValue([photo("site", "site.jpg", "image/jpeg")]);
    extractNameplateFromImage.mockResolvedValue({
      status: "unreadable",
      modelNumber: null,
      serialNumber: null,
      message: "no",
    });

    const result = await searchJobPhotosForNameplate("job-1", "office");

    expect(result.status).toBe("unreadable");
    expect(result.extraction.modelNumber).toBeNull();
    expect(result.extraction.serialNumber).toBeNull();
    expect(result.message).toBe(NAMEPLATE_NO_NAMEPLATE_MESSAGE);
  });

  it("does not download photos when nameplate reading is not configured", async () => {
    isNameplateVisionConfigured.mockReturnValue(false);
    listJobFiles.mockResolvedValue([photo("site", "site.jpg", "image/jpeg")]);

    const result = await searchJobPhotosForNameplate("job-1", "tech");

    expect(result.message).toBe(NAMEPLATE_UNCONFIGURED_MESSAGE);
    expect(downloadStorageObjectBytes).not.toHaveBeenCalled();
    expect(extractNameplateFromImage).not.toHaveBeenCalled();
  });

  it("says the job has no photos when only documents were uploaded", async () => {
    listJobFiles.mockResolvedValue([photo("doc", "permit.pdf", "application/pdf")]);

    const result = await searchJobPhotosForNameplate("job-1", "tech");

    expect(result.message).toBe(NAMEPLATE_NO_PHOTOS_MESSAGE);
    expect(extractNameplateFromImage).not.toHaveBeenCalled();
  });
});
