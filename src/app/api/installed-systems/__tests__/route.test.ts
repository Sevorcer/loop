import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getInstalledSystemsSnapshotMock,
  getInstalledSystemByIdMock,
  createInstalledSystemMock,
} = vi.hoisted(() => ({
  getInstalledSystemsSnapshotMock: vi.fn(),
  getInstalledSystemByIdMock: vi.fn(),
  createInstalledSystemMock: vi.fn(),
}));

vi.mock("@/services/installedSystems", () => ({
  getInstalledSystemsSnapshot: getInstalledSystemsSnapshotMock,
  createInstalledSystem: createInstalledSystemMock,
}));

vi.mock("@/repositories/installedSystems", () => ({
  getInstalledSystemById: getInstalledSystemByIdMock,
}));

import { GET as getInstalledSystems, POST as postInstalledSystem } from "@/app/api/installed-systems/route";
import { GET as getInstalledSystemById } from "@/app/api/installed-systems/[id]/route";

function validBody() {
  return {
    systemName: "Test Heat Pump",
    manufacturer: "Mitsubishi",
    modelNumber: "MXZ-3C24NAHZ2",
    serialNumbers: ["SN-001"],
    installDate: "2026-07-01",
    customerName: "ACME Corp",
    propertyName: "ACME HQ",
  };
}

describe("GET /api/installed-systems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInstalledSystemsSnapshotMock.mockResolvedValue({
      installedSystems: [],
      technicalProfiles: [],
    });
  });

  it("returns 401 when role is missing", async () => {
    const response = await getInstalledSystems(new Request("http://localhost/api/installed-systems"));
    const body = (await response.json()) as { error: string; code: number };

    expect(response.status).toBe(401);
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.code).toBe(401);
  });

  it("returns 403 for portal role deny-by-default", async () => {
    const response = await getInstalledSystems(
      new Request("http://localhost/api/installed-systems", {
        headers: { "x-loop-role": "portal" },
      }),
    );
    const body = (await response.json()) as { error: string; code: number };

    expect(response.status).toBe(403);
    expect(body.error).toBe("FORBIDDEN");
    expect(body.code).toBe(403);
  });

  it("returns 200 with snapshot payload for an allowed role", async () => {
    getInstalledSystemsSnapshotMock.mockResolvedValue({
      installedSystems: [{ id: "sys-1", systemName: "Heat Pump" }],
      technicalProfiles: [{ id: "tp-1", systemName: "Heat Pump" }],
    });

    const response = await getInstalledSystems(
      new Request("http://localhost/api/installed-systems", {
        headers: { "x-loop-role": "tech" },
      }),
    );
    const body = (await response.json()) as {
      installedSystems: Array<{ id: string }>;
      technicalProfiles: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.installedSystems).toHaveLength(1);
    expect(body.technicalProfiles).toHaveLength(1);
    expect(body.installedSystems[0].id).toBe("sys-1");
    expect(body.technicalProfiles[0].id).toBe("tp-1");
  });
});

describe("GET /api/installed-systems/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 envelope when installed system is missing", async () => {
    getInstalledSystemByIdMock.mockResolvedValue({ ok: true, data: null });

    const response = await getInstalledSystemById(
      new Request("http://localhost/api/installed-systems/sys-404", {
        headers: { "x-loop-role": "manager" },
      }),
      { params: Promise.resolve({ id: "sys-404" }) },
    );
    const body = (await response.json()) as { error: string; code: number };

    expect(response.status).toBe(404);
    expect(body.error).toBe("NOT_FOUND");
    expect(body.code).toBe(404);
  });

  it("maps repository unauthorized errors to 401 envelope", async () => {
    getInstalledSystemByIdMock.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "A valid session is required." },
    });

    const response = await getInstalledSystemById(
      new Request("http://localhost/api/installed-systems/sys-401", {
        headers: { "x-loop-role": "owner" },
      }),
      { params: Promise.resolve({ id: "sys-401" }) },
    );
    const body = (await response.json()) as { error: string; code: number };

    expect(response.status).toBe(401);
    expect(body.error).toBe("UNAUTHORIZED");
    expect(body.code).toBe(401);
  });

  it("returns 200 with installed system for a successful lookup", async () => {
    getInstalledSystemByIdMock.mockResolvedValue({
      ok: true,
      data: { id: "sys-200", systemName: "Furnace" },
    });

    const response = await getInstalledSystemById(
      new Request("http://localhost/api/installed-systems/sys-200", {
        headers: { "x-loop-role": "owner" },
      }),
      { params: Promise.resolve({ id: "sys-200" }) },
    );
    const body = (await response.json()) as { installedSystem: { id: string } };

    expect(response.status).toBe(200);
    expect(body.installedSystem.id).toBe("sys-200");
  });
});

// ─── POST /api/installed-systems — required field validation ──────────────────

describe("POST /api/installed-systems — required field validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createInstalledSystemMock.mockResolvedValue({ id: "new-sys", ...validBody() });
  });

  it("returns 400 when systemName is missing", async () => {
    const body = { ...validBody(), systemName: "" };
    const response = await postInstalledSystem(
      new Request("http://localhost/api/installed-systems", {
        method: "POST",
        headers: { "x-loop-role": "tech", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const json = (await response.json()) as { error: string; code: number };
    expect(response.status).toBe(400);
    expect(json.error).toBe("VALIDATION");
  });

  it("returns 400 when manufacturer is missing", async () => {
    const body = { ...validBody(), manufacturer: "" };
    const response = await postInstalledSystem(
      new Request("http://localhost/api/installed-systems", {
        method: "POST",
        headers: { "x-loop-role": "tech", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const json = (await response.json()) as { error: string; code: number };
    expect(response.status).toBe(400);
    expect(json.error).toBe("VALIDATION");
  });

  it("returns 400 when modelNumber is missing", async () => {
    const body = { ...validBody(), modelNumber: "" };
    const response = await postInstalledSystem(
      new Request("http://localhost/api/installed-systems", {
        method: "POST",
        headers: { "x-loop-role": "tech", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const json = (await response.json()) as { error: string; code: number };
    expect(response.status).toBe(400);
    expect(json.error).toBe("VALIDATION");
  });

  it("F8: accepts empty serialNumbers (serial is optional)", async () => {
    createInstalledSystemMock.mockResolvedValue({ id: "sys-new" });
    const body = { ...validBody(), serialNumbers: [] };
    const response = await postInstalledSystem(
      new Request("http://localhost/api/installed-systems", {
        method: "POST",
        headers: { "x-loop-role": "tech", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(201);
    expect(createInstalledSystemMock).toHaveBeenCalledWith(
      expect.objectContaining({ serialNumbers: [] }),
    );
  });

  it("returns 400 when installDate is missing", async () => {
    const body = { ...validBody(), installDate: "" };
    const response = await postInstalledSystem(
      new Request("http://localhost/api/installed-systems", {
        method: "POST",
        headers: { "x-loop-role": "tech", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const json = (await response.json()) as { error: string; code: number };
    expect(response.status).toBe(400);
    expect(json.error).toBe("VALIDATION");
  });

  it("returns 201 with a valid payload", async () => {
    const response = await postInstalledSystem(
      new Request("http://localhost/api/installed-systems", {
        method: "POST",
        headers: { "x-loop-role": "tech", "content-type": "application/json" },
        body: JSON.stringify(validBody()),
      }),
    );
    expect(response.status).toBe(201);
  });
});
