import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { reviewNameplatePhoto, updateInstalledSystem, getInstalledSystemById, tryAutoMatchManualsForSystem } = vi.hoisted(() => ({
  reviewNameplatePhoto: vi.fn(),
  updateInstalledSystem: vi.fn(),
  getInstalledSystemById: vi.fn(),
  tryAutoMatchManualsForSystem: vi.fn(),
}));

vi.mock("@/services/installedSystemNameplate", () => ({ reviewNameplatePhoto }));
vi.mock("@/services/installedSystems", () => ({ updateInstalledSystem }));
vi.mock("@/repositories/installedSystems", () => ({ getInstalledSystemById }));
vi.mock("@/services/manualAutoMatch", () => ({ tryAutoMatchManualsForSystem }));

import { POST } from "@/app/api/installed-systems/[id]/nameplate/route";

const SYSTEM_ID = "11111111-1111-4111-8111-111111111111";
const PHOTO_ID = "22222222-2222-4222-8222-222222222222";

function post(role: string | null, body: unknown) {
  return POST(
    new Request(`http://localhost/api/installed-systems/${SYSTEM_ID}/nameplate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(role ? { "x-loop-role": role } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: SYSTEM_ID }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tryAutoMatchManualsForSystem.mockResolvedValue(null);
  getInstalledSystemById.mockResolvedValue({
    ok: true,
    data: { id: SYSTEM_ID, modelNumber: "OLD-MODEL-1", serialNumbers: ["OLD-SERIAL-9", "EXTRA-2"] },
  });
  updateInstalledSystem.mockResolvedValue({
    id: SYSTEM_ID,
    modelNumber: "MXZ-3C24NAHZ2",
    serialNumbers: ["SN1234567", "EXTRA-2"],
  });
});

describe("POST /api/installed-systems/[id]/nameplate", () => {
  it("denies roles that cannot edit installed systems", async () => {
    for (const role of ["sales", "dispatch", "portal"]) {
      const response = await post(role, { photoId: PHOTO_ID });
      expect(response.status).toBe(403);
    }
    expect(reviewNameplatePhoto).not.toHaveBeenCalled();
    expect(updateInstalledSystem).not.toHaveBeenCalled();
  });

  it("returns a proposal and does not save it", async () => {
    reviewNameplatePhoto.mockResolvedValue({
      ok: true,
      review: {
        status: "proposed",
        modelNumber: "MXZ-3C24NAHZ2",
        serialNumber: "SN1234567",
        modelFromPhoto: true,
        serialFromPhoto: true,
        message: "Review the model and serial read from this photo. Nothing is saved until you confirm.",
      },
    });

    const response = await post("office", { photoId: PHOTO_ID });
    const body = await response.json() as { saved: boolean; review: { modelNumber: string; serialNumber: string } };

    expect(response.status).toBe(200);
    expect(body.saved).toBe(false);
    expect(body.review.modelNumber).toBe("MXZ-3C24NAHZ2");
    expect(body.review.serialNumber).toBe("SN1234567");
    expect(updateInstalledSystem).not.toHaveBeenCalled();
    expect(getInstalledSystemById).not.toHaveBeenCalled();
  });

  it("returns the unreadable message and leaves the system unsaved", async () => {
    reviewNameplatePhoto.mockResolvedValue({
      ok: true,
      review: {
        status: "unreadable",
        modelNumber: null,
        serialNumber: null,
        modelFromPhoto: false,
        serialFromPhoto: false,
        message: "This photo could not be read. Model and serial were left unchanged.",
      },
    });

    const response = await post("office", { photoId: PHOTO_ID });
    const body = await response.json() as { saved: boolean; review: { status: string; message: string } };

    expect(response.status).toBe(200);
    expect(body.saved).toBe(false);
    expect(body.review.status).toBe("unreadable");
    expect(body.review.message).toMatch(/left unchanged/i);
    expect(updateInstalledSystem).not.toHaveBeenCalled();
  });

  it("refuses to overwrite model and serial without confirm", async () => {
    const response = await post("office", {
      confirm: false,
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumber: "SN1234567",
    });
    const body = await response.json() as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/confirm/i);
    expect(updateInstalledSystem).not.toHaveBeenCalled();
    expect(reviewNameplatePhoto).not.toHaveBeenCalled();
  });

  it("saves only after confirm, keeping additional serials", async () => {
    const response = await post("manager", {
      confirm: true,
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumber: "SN1234567",
    });
    const body = await response.json() as { saved: boolean };

    expect(response.status).toBe(200);
    expect(body.saved).toBe(true);
    expect(updateInstalledSystem).toHaveBeenCalledWith(SYSTEM_ID, {
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumbers: ["SN1234567", "EXTRA-2"],
    });
  });

  it("does not clear an existing serial when the confirmation is blank", async () => {
    const response = await post("office", { confirm: true, modelNumber: "MXZ-3C24NAHZ2", serialNumber: "" });
    expect(response.status).toBe(400);
    expect(updateInstalledSystem).not.toHaveBeenCalled();
  });
});
