import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getInstalledSystemsSnapshotMock,
  getInstalledSystemsForJobSnapshotMock,
  getInstalledSystemByIdMock,
  createInstalledSystemMock,
} = vi.hoisted(() => ({
  getInstalledSystemsSnapshotMock: vi.fn(),
  getInstalledSystemsForJobSnapshotMock: vi.fn(),
  getInstalledSystemByIdMock: vi.fn(),
  createInstalledSystemMock: vi.fn(),
}));

vi.mock("@/services/installedSystems", () => ({
  getInstalledSystemsSnapshot: getInstalledSystemsSnapshotMock,
  getInstalledSystemsForJobSnapshot: getInstalledSystemsForJobSnapshotMock,
  createInstalledSystem: createInstalledSystemMock,
}));

vi.mock("@/repositories/installedSystems", () => ({
  getInstalledSystemById: getInstalledSystemByIdMock,
}));

// #8 Copilot manual auto-match runs after create; keep it inert here.
vi.mock("@/services/manualAutoMatch", () => ({
  tryAutoMatchManualsForSystem: vi.fn(async () => null),
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

describe("GET /api/installed-systems?jobId= (job-scoped, Bundle C perf)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the job's systems and never loads the org-wide snapshot", async () => {
    const jobId = "2f0c8f4e-5d0b-4f7e-9a51-0d6f3c2b1a90";
    getInstalledSystemsForJobSnapshotMock.mockResolvedValue({
      installedSystems: [{ id: "sys-9", systemName: "Furnace", jobId }],
      technicalProfiles: [],
    });

    const response = await getInstalledSystems(
      new Request(`http://localhost/api/installed-systems?jobId=${jobId}`, {
        headers: { "x-loop-role": "office" },
      }),
    );
    const body = (await response.json()) as { installedSystems: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(getInstalledSystemsForJobSnapshotMock).toHaveBeenCalledWith(jobId);
    expect(getInstalledSystemsSnapshotMock).not.toHaveBeenCalled();
    expect(body.installedSystems.map((system) => system.id)).toEqual(["sys-9"]);
  });

  it("rejects a jobId that is not a UUID (it is interpolated into a filter)", async () => {
    const response = await getInstalledSystems(
      new Request("http://localhost/api/installed-systems?jobId=abc),org_id.neq.x", {
        headers: { "x-loop-role": "office" },
      }),
    );

    expect(response.status).toBe(400);
    expect(getInstalledSystemsForJobSnapshotMock).not.toHaveBeenCalled();
    expect(getInstalledSystemsSnapshotMock).not.toHaveBeenCalled();
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

  it("field feedback: rejects empty serialNumbers (serial is required)", async () => {
    const body = { ...validBody(), serialNumbers: [] };
    const response = await postInstalledSystem(
      new Request("http://localhost/api/installed-systems", {
        method: "POST",
        headers: { "x-loop-role": "tech", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const json = (await response.json()) as { error: string; message: string };
    expect(response.status).toBe(400);
    expect(json.error).toBe("VALIDATION");
    expect(json.message).toMatch(/serial/i);
    expect(createInstalledSystemMock).not.toHaveBeenCalled();
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

// ─── POST /api/installed-systems — create-and-link from the job Systems tab ───
// The "Add System" dialog on a job reuses this exact create path, passing the
// job context so the new record is linked to the job via installed_systems.job_id.

describe("POST /api/installed-systems — create and link to job", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createInstalledSystemMock.mockResolvedValue({ id: "sys-linked", ...validBody() });
  });

  it("links the created system to the job (job_id) through the existing service", async () => {
    const body = {
      ...validBody(),
      jobId: "job-123",
      jobNumber: "J-1001",
      propertyId: "prop-9",
    };

    const response = await postInstalledSystem(
      new Request("http://localhost/api/installed-systems", {
        method: "POST",
        headers: { "x-loop-role": "owner", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    const json = (await response.json()) as { installedSystem: { id: string } };

    expect(response.status).toBe(201);
    expect(json.installedSystem.id).toBe("sys-linked");
    // jobId/jobNumber/propertyId flow straight into the create service, which
    // persists job_id — this is what clears the job's closeout "Installed
    // systems" gate once a system is linked.
    expect(createInstalledSystemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-123",
        jobNumber: "J-1001",
        propertyId: "prop-9",
      }),
    );
  });

  it("S2: never registers the warranty on create, even if the body tries", async () => {
    const body = {
      ...validBody(),
      jobId: "job-123",
      warrantyRegistered: true,
      warranty_registered: true,
      warrantyRegisteredBy: "tech-1",
    };

    const response = await postInstalledSystem(
      new Request("http://localhost/api/installed-systems", {
        method: "POST",
        headers: { "x-loop-role": "owner", "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

    expect(response.status).toBe(201);
    expect(createInstalledSystemMock).toHaveBeenCalledWith(
      expect.objectContaining({ warrantyRegistered: false }),
    );
  });
});
