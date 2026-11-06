import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const {
  searchJobPhotosForNameplate,
  loadInstalledSystemsForJob,
  updateInstalledSystem,
  tryAutoMatchManualsForSystem,
  getJob,
} = vi.hoisted(() => ({
  searchJobPhotosForNameplate: vi.fn(),
  loadInstalledSystemsForJob: vi.fn(),
  updateInstalledSystem: vi.fn(),
  tryAutoMatchManualsForSystem: vi.fn(),
  getJob: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  const { hasPermission } = await import("@/services/authorization");
  const roles = new Set(["owner", "manager", "dispatch", "tech", "office", "sales", "portal"]);
  return {
    ...actual,
    requirePermission: async (request: Request, table: "jobs", action: "update") => {
      const role = request.headers.get("x-loop-role") ?? "";
      const userId = request.headers.get("x-test-user") ?? "";
      if (!roles.has(role)) {
        return { ok: false as const, response: actual.unauthorizedResponse() };
      }
      if (!hasPermission(role as "tech", table, action)) {
        return {
          ok: false as const,
          response: NextResponse.json({ error: "FORBIDDEN", message: "denied", code: 403 }, { status: 403 }),
        };
      }
      return { ok: true as const, ctx: { role, userId } };
    },
  };
});

vi.mock("@/services/jobNameplate", () => ({ searchJobPhotosForNameplate }));
vi.mock("@/repositories/installedSystems", () => ({ loadInstalledSystemsForJob }));
vi.mock("@/services/installedSystems", () => ({ updateInstalledSystem }));
vi.mock("@/services/manualAutoMatch", () => ({ tryAutoMatchManualsForSystem }));
vi.mock("@/services/jobs", () => ({ getJob }));

import { POST } from "@/app/api/jobs/[id]/nameplate/route";
import { NAMEPLATE_NO_NAMEPLATE_MESSAGE } from "@/features/installed-systems/utils/nameplateRead";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SYSTEM_ID = "33333333-3333-4333-8333-333333333333";

function post(role: string | null, body: unknown, userId = "") {
  return POST(
    new Request(`http://localhost/api/jobs/${JOB_ID}/nameplate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(role ? { "x-loop-role": role } : {}),
        ...(userId ? { "x-test-user": userId } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: JOB_ID }) },
  );
}

function system(id: string, serials = ["OLD-SERIAL-9", "EXTRA-2"]) {
  return {
    id,
    systemName: id === SYSTEM_ID ? "Heat pump" : "Air handler",
    modelNumber: "OLD-MODEL-1",
    serialNumbers: serials,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tryAutoMatchManualsForSystem.mockResolvedValue(null);
  getJob.mockResolvedValue({ id: JOB_ID, assignees: [{ id: "tech-1" }] });
  loadInstalledSystemsForJob.mockResolvedValue({ installedSystems: [system(SYSTEM_ID)], technicalProfiles: [] });
  updateInstalledSystem.mockImplementation(async (id: string, patch: { modelNumber: string; serialNumbers: string[] }) => ({
    id,
    ...patch,
  }));
  searchJobPhotosForNameplate.mockResolvedValue({
    status: "proposed",
    photoFileName: "IMG_100.HEIC",
    message: "Read from a job photo.",
    extraction: {
      status: "read",
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumber: "SN1234567",
      message: "Read from a job photo.",
    },
  });
});

describe("POST /api/jobs/[id]/nameplate", () => {
  it("follows job-photo access: techs and dispatch can search, sales and portal cannot", async () => {
    for (const role of ["sales", "portal"]) {
      const denied = await post(role, {});
      expect(denied.status).toBe(403);
    }

    const unassigned = await post("tech", {}, "someone-else");
    expect(unassigned.status).toBe(403);

    const assigned = await post("tech", {}, "tech-1");
    expect(assigned.status).toBe(200);

    const dispatch = await post("dispatch", {});
    expect(dispatch.status).toBe(200);

    expect(searchJobPhotosForNameplate).toHaveBeenCalledTimes(2);
    expect(updateInstalledSystem).not.toHaveBeenCalled();
  });

  it("returns a proposal from the job photos and does not save it", async () => {
    const response = await post("office", {});
    const body = await response.json() as {
      saved: boolean;
      review: { modelNumber: string; serialNumber: string };
      photoFileName: string;
    };

    expect(response.status).toBe(200);
    expect(body.saved).toBe(false);
    expect(body.review.modelNumber).toBe("MXZ-3C24NAHZ2");
    expect(body.review.serialNumber).toBe("SN1234567");
    expect(body.photoFileName).toBe("IMG_100.HEIC");
    expect(updateInstalledSystem).not.toHaveBeenCalled();
  });

  it("says no nameplate was found and leaves the system unsaved", async () => {
    searchJobPhotosForNameplate.mockResolvedValue({
      status: "unreadable",
      photoFileName: null,
      message: NAMEPLATE_NO_NAMEPLATE_MESSAGE,
      extraction: { status: "unreadable", modelNumber: null, serialNumber: null, message: NAMEPLATE_NO_NAMEPLATE_MESSAGE },
    });

    const response = await post("tech", {}, "tech-1");
    const body = await response.json() as { saved: boolean; review: { status: string; message: string; modelNumber: string | null } };

    expect(response.status).toBe(200);
    expect(body.saved).toBe(false);
    expect(body.review.status).toBe("unreadable");
    expect(body.review.modelNumber).toBeNull();
    expect(body.review.message).toMatch(/no nameplate was found/i);
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
    expect(searchJobPhotosForNameplate).not.toHaveBeenCalled();
  });

  it("saves onto the job's only installed system after confirm", async () => {
    const response = await post("tech", {
      confirm: true,
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumber: "SN1234567",
    }, "tech-1");
    const body = await response.json() as { saved: boolean };

    expect(response.status).toBe(200);
    expect(body.saved).toBe(true);
    expect(updateInstalledSystem).toHaveBeenCalledWith(SYSTEM_ID, {
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumbers: ["SN1234567", "EXTRA-2"],
    });
  });

  it("requires a choice when the job has more than one installed system", async () => {
    loadInstalledSystemsForJob.mockResolvedValue({
      installedSystems: [system(SYSTEM_ID), system(OTHER_SYSTEM_ID, ["AH-1"])],
      technicalProfiles: [],
    });

    const missing = await post("office", { confirm: true, modelNumber: "MXZ-3C24NAHZ2", serialNumber: "SN1234567" });
    expect(missing.status).toBe(400);
    expect(updateInstalledSystem).not.toHaveBeenCalled();

    const chosen = await post("office", {
      confirm: true,
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumber: "SN1234567",
      installedSystemId: OTHER_SYSTEM_ID,
    });
    expect(chosen.status).toBe(200);
    expect(updateInstalledSystem).toHaveBeenCalledWith(OTHER_SYSTEM_ID, {
      modelNumber: "MXZ-3C24NAHZ2",
      serialNumbers: ["SN1234567"],
    });
  });

  it("does not clear an existing serial when the confirmation is blank", async () => {
    const response = await post("office", { confirm: true, modelNumber: "MXZ-3C24NAHZ2", serialNumber: "" });
    expect(response.status).toBe(400);
    expect(updateInstalledSystem).not.toHaveBeenCalled();
  });
});