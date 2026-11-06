import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getInstalledSystemById,
  getStorageObjectById,
  downloadStorageObjectBytes,
  extractNameplateFromImage,
  isNameplateVisionConfigured,
} = vi.hoisted(() => ({
  getInstalledSystemById: vi.fn(),
  getStorageObjectById: vi.fn(),
  downloadStorageObjectBytes: vi.fn(),
  extractNameplateFromImage: vi.fn(),
  isNameplateVisionConfigured: vi.fn(),
}));

vi.mock("@/repositories/installedSystems", () => ({ getInstalledSystemById }));
vi.mock("@/repositories/storage", () => ({ getStorageObjectById, downloadStorageObjectBytes }));
vi.mock("@/services/nameplateVision", () => ({ extractNameplateFromImage, isNameplateVisionConfigured }));

import { NAMEPLATE_UNCONFIGURED_MESSAGE } from "@/features/installed-systems/utils/nameplateRead";
import { reviewNameplatePhoto } from "@/services/installedSystemNameplate";

const SYSTEM_ID = "11111111-1111-4111-8111-111111111111";
const PHOTO_ID = "22222222-2222-4222-8222-222222222222";

function system() {
  return {
    ok: true as const,
    data: { modelNumber: "OLD-MODEL-1", serialNumbers: ["OLD-SERIAL-9", "EXTRA-2"] },
  };
}

function photo(overrides: Record<string, unknown> = {}) {
  return {
    id: PHOTO_ID,
    installedSystemId: SYSTEM_ID,
    bucket: "installed-system-photos",
    mimeType: "image/jpeg",
    sizeBytes: 1200,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getInstalledSystemById.mockResolvedValue(system());
  getStorageObjectById.mockResolvedValue(photo());
  downloadStorageObjectBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
  isNameplateVisionConfigured.mockReturnValue(true);
});

describe("reviewNameplatePhoto", () => {
  it("proposes model and serial from the photo and does not write them", async () => {
    extractNameplateFromImage.mockResolvedValue({
      status: "read",
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumber: "SN1234567",
      message: "Read from the nameplate photo.",
    });

    const result = await reviewNameplatePhoto(SYSTEM_ID, PHOTO_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.status).toBe("proposed");
      expect(result.review.modelNumber).toBe("MXZ-3C24NAHZ2");
      expect(result.review.serialNumber).toBe("SN1234567");
    }
    expect(extractNameplateFromImage).toHaveBeenCalledOnce();
  });

  it("returns an unreadable review and skips the download when reading is not configured", async () => {
    isNameplateVisionConfigured.mockReturnValue(false);

    const result = await reviewNameplatePhoto(SYSTEM_ID, PHOTO_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.status).toBe("unreadable");
      expect(result.review.modelNumber).toBeNull();
      expect(result.review.serialNumber).toBeNull();
      expect(result.review.message).toBe(NAMEPLATE_UNCONFIGURED_MESSAGE);
    }
    expect(downloadStorageObjectBytes).not.toHaveBeenCalled();
    expect(extractNameplateFromImage).not.toHaveBeenCalled();
  });

  it("says the photo could not be read when the reader finds nothing", async () => {
    extractNameplateFromImage.mockResolvedValue({
      status: "unreadable",
      modelNumber: null,
      serialNumber: null,
      message: "This photo could not be read. Model and serial were left unchanged.",
    });

    const result = await reviewNameplatePhoto(SYSTEM_ID, PHOTO_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.status).toBe("unreadable");
      expect(result.review.message).toMatch(/left unchanged/i);
    }
  });

  it("does not read a photo that is not on this installed system", async () => {
    getStorageObjectById.mockResolvedValue(photo({ installedSystemId: "33333333-3333-4333-8333-333333333333" }));

    const result = await reviewNameplatePhoto(SYSTEM_ID, PHOTO_ID);

    expect(result).toEqual({ ok: false, status: 404, message: "That photo is not on this installed system." });
    expect(extractNameplateFromImage).not.toHaveBeenCalled();
    expect(downloadStorageObjectBytes).not.toHaveBeenCalled();
  });
});
