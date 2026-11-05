import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  getJobMaterialsMock,
  addJobMaterialMock,
  updateJobMaterialMock,
  removeJobMaterialMock,
  getJobTechnicalDataMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getJobMaterialsMock: vi.fn(),
  addJobMaterialMock: vi.fn(),
  updateJobMaterialMock: vi.fn(),
  removeJobMaterialMock: vi.fn(),
  getJobTechnicalDataMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/services/jobMaterials", () => ({
  getJobMaterials: getJobMaterialsMock,
  addJobMaterial: addJobMaterialMock,
  updateJobMaterial: updateJobMaterialMock,
  removeJobMaterial: removeJobMaterialMock,
  getJobTechnicalData: getJobTechnicalDataMock,
}));

import { GET, POST } from "@/app/api/jobs/[id]/materials/route";
import { DELETE, PATCH } from "@/app/api/jobs/[id]/materials/[lineId]/route";
import { GET as GET_TECH } from "@/app/api/jobs/[id]/technical-data/route";

const JOB = "11111111-1111-4111-8111-111111111111";
const LINE = "22222222-2222-4222-8222-222222222222";

function allow(role: string) {
  return { ok: true as const, ctx: { userId: "user-1", role } };
}

function deny(status: 401 | 403) {
  return {
    ok: false as const,
    response: NextResponse.json(
      { error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", message: "no", code: status },
      { status },
    ),
  };
}

const jobParams = (id = JOB) => ({ params: Promise.resolve({ id }) });
const lineParams = (id = JOB, lineId = LINE) => ({ params: Promise.resolve({ id, lineId }) });

function jsonRequest(method: string, body: unknown, raw?: string) {
  return new Request(`http://localhost/api/jobs/${JOB}/materials`, {
    method,
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

const sampleLine = {
  id: LINE,
  jobId: JOB,
  name: "Condensate pump",
  quantity: 1,
  unit: "ea",
  partNumber: null,
  notes: "",
  state: "needed",
  sortOrder: 0,
};

const OFFICE_ROLES = ["owner", "manager", "dispatch", "office", "sales"] as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/jobs/[id]/materials", () => {
  it("passes through an unauthenticated rejection", async () => {
    requirePermissionMock.mockResolvedValue(deny(401));
    const res = await GET(new Request("http://localhost"), jobParams());
    expect(res.status).toBe(401);
    expect(getJobMaterialsMock).not.toHaveBeenCalled();
  });

  it("rejects portal (jobs/select guard denies)", async () => {
    requirePermissionMock.mockResolvedValue(deny(403));
    const res = await GET(new Request("http://localhost"), jobParams());
    expect(res.status).toBe(403);
    expect(getJobMaterialsMock).not.toHaveBeenCalled();
  });

  it("rejects portal even if the guard let it through", async () => {
    requirePermissionMock.mockResolvedValue(allow("portal"));
    const res = await GET(new Request("http://localhost"), jobParams());
    expect(res.status).toBe(403);
    expect(getJobMaterialsMock).not.toHaveBeenCalled();
  });

  it("400s on a non-uuid job id before touching the database", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    const res = await GET(new Request("http://localhost"), jobParams("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(getJobMaterialsMock).not.toHaveBeenCalled();
  });

  it("lets a tech read (row scope is RLS)", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    getJobMaterialsMock.mockResolvedValue([sampleLine]);
    const res = await GET(new Request("http://localhost"), jobParams());
    expect(res.status).toBe(200);
    expect((await res.json()).materials).toHaveLength(1);
    expect(getJobMaterialsMock).toHaveBeenCalledWith(JOB);
  });

  it("maps a service failure to 500", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    getJobMaterialsMock.mockRejectedValue(new Error("boom"));
    const res = await GET(new Request("http://localhost"), jobParams());
    expect(res.status).toBe(500);
  });
});

describe("POST /api/jobs/[id]/materials", () => {
  it("rejects a tech with 403", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    const res = await POST(jsonRequest("POST", { name: "Pump" }), jobParams());
    expect(res.status).toBe(403);
    expect(addJobMaterialMock).not.toHaveBeenCalled();
  });

  it("passes through a 401", async () => {
    requirePermissionMock.mockResolvedValue(deny(401));
    const res = await POST(jsonRequest("POST", { name: "Pump" }), jobParams());
    expect(res.status).toBe(401);
    expect(addJobMaterialMock).not.toHaveBeenCalled();
  });

  it.each(OFFICE_ROLES)("lets %s add a line (201)", async (role) => {
    requirePermissionMock.mockResolvedValue(allow(role));
    addJobMaterialMock.mockResolvedValue(sampleLine);
    const res = await POST(
      jsonRequest("POST", { name: "  Pump ", quantity: "2", unit: "", partNumber: "" }),
      jobParams(),
    );
    expect(res.status).toBe(201);
    expect(addJobMaterialMock).toHaveBeenCalledWith(JOB, {
      name: "Pump",
      quantity: 2,
      unit: "ea",
      partNumber: null,
      notes: "",
      state: "needed",
    });
  });

  it("400s on invalid JSON, a non-object body, and a missing name", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    expect((await POST(jsonRequest("POST", null, "{bad"), jobParams())).status).toBe(400);
    expect((await POST(jsonRequest("POST", [1, 2]), jobParams())).status).toBe(400);
    expect((await POST(jsonRequest("POST", { quantity: 1 }), jobParams())).status).toBe(400);
    expect((await POST(jsonRequest("POST", { name: "x", quantity: 0 }), jobParams())).status).toBe(400);
    expect((await POST(jsonRequest("POST", { name: "x", state: "lost" }), jobParams())).status).toBe(400);
    expect(addJobMaterialMock).not.toHaveBeenCalled();
  });

  it("maps an RLS denial from the database to 403", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    addJobMaterialMock.mockRejectedValue(
      new Error('new row violates row-level security policy for table "job_material_lines" — permission denied'),
    );
    const res = await POST(jsonRequest("POST", { name: "Pump" }), jobParams());
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/jobs/[id]/materials/[lineId]", () => {
  it("lets a tech move state and change quantity", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    updateJobMaterialMock.mockResolvedValue({ ...sampleLine, state: "on_truck", quantity: 2 });
    const res = await PATCH(jsonRequest("PATCH", { state: "on_truck", quantity: 2 }), lineParams());
    expect(res.status).toBe(200);
    expect(updateJobMaterialMock).toHaveBeenCalledWith(JOB, LINE, { state: "on_truck", quantity: 2 });
  });

  it.each([["name"], ["notes"], ["unit"], ["partNumber"]])(
    "rejects a tech changing %s with 403",
    async (field) => {
      requirePermissionMock.mockResolvedValue(allow("tech"));
      const res = await PATCH(jsonRequest("PATCH", { state: "used", [field]: "x" }), lineParams());
      expect(res.status).toBe(403);
      expect(updateJobMaterialMock).not.toHaveBeenCalled();
    },
  );

  it("rejects portal with 403", async () => {
    requirePermissionMock.mockResolvedValue(allow("portal"));
    const res = await PATCH(jsonRequest("PATCH", { state: "used" }), lineParams());
    expect(res.status).toBe(403);
    expect(updateJobMaterialMock).not.toHaveBeenCalled();
  });

  it("passes through a guard denial", async () => {
    requirePermissionMock.mockResolvedValue(deny(403));
    const res = await PATCH(jsonRequest("PATCH", { state: "used" }), lineParams());
    expect(res.status).toBe(403);
    expect(updateJobMaterialMock).not.toHaveBeenCalled();
  });

  it("lets office edit any field", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    updateJobMaterialMock.mockResolvedValue(sampleLine);
    const res = await PATCH(
      jsonRequest("PATCH", { name: "Pump 2", notes: "bring two", partNumber: "CP-1" }),
      lineParams(),
    );
    expect(res.status).toBe(200);
    expect(updateJobMaterialMock).toHaveBeenCalledWith(JOB, LINE, {
      name: "Pump 2",
      notes: "bring two",
      partNumber: "CP-1",
    });
  });

  it("400s on bad ids, unknown fields, empty patch and a bad state", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    expect((await PATCH(jsonRequest("PATCH", { state: "used" }), lineParams("x"))).status).toBe(400);
    expect((await PATCH(jsonRequest("PATCH", { state: "used" }), lineParams(JOB, "y"))).status).toBe(400);
    expect((await PATCH(jsonRequest("PATCH", { jobId: JOB }), lineParams())).status).toBe(400);
    expect((await PATCH(jsonRequest("PATCH", {}), lineParams())).status).toBe(400);
    expect((await PATCH(jsonRequest("PATCH", { state: "gone" }), lineParams())).status).toBe(400);
    expect(updateJobMaterialMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the line is not visible (RLS / wrong job)", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    updateJobMaterialMock.mockRejectedValue(
      Object.assign(new Error("Material line not found."), { status: 404 }),
    );
    const res = await PATCH(jsonRequest("PATCH", { state: "used" }), lineParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when the database tech guard fires", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    updateJobMaterialMock.mockRejectedValue(
      Object.assign(new Error("Technicians can only change a material's state and quantity"), {
        status: 403,
        code: "FORBIDDEN",
      }),
    );
    const res = await PATCH(jsonRequest("PATCH", { state: "used" }), lineParams());
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/jobs/[id]/materials/[lineId]", () => {
  it("rejects a tech with 403", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), lineParams());
    expect(res.status).toBe(403);
    expect(removeJobMaterialMock).not.toHaveBeenCalled();
  });

  it("rejects portal with 403", async () => {
    requirePermissionMock.mockResolvedValue(allow("portal"));
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), lineParams());
    expect(res.status).toBe(403);
    expect(removeJobMaterialMock).not.toHaveBeenCalled();
  });

  it.each(OFFICE_ROLES)("lets %s delete", async (role) => {
    requirePermissionMock.mockResolvedValue(allow(role));
    removeJobMaterialMock.mockResolvedValue(undefined);
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), lineParams());
    expect(res.status).toBe(200);
    expect(removeJobMaterialMock).toHaveBeenCalledWith(JOB, LINE);
  });

  it("400s on a bad line id", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    const res = await DELETE(new Request("http://localhost", { method: "DELETE" }), lineParams(JOB, "nope"));
    expect(res.status).toBe(400);
    expect(removeJobMaterialMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/jobs/[id]/technical-data", () => {
  it("passes through a guard denial", async () => {
    requirePermissionMock.mockResolvedValue(deny(401));
    const res = await GET_TECH(new Request("http://localhost"), jobParams());
    expect(res.status).toBe(401);
    expect(getJobTechnicalDataMock).not.toHaveBeenCalled();
  });

  it("rejects portal with 403", async () => {
    requirePermissionMock.mockResolvedValue(allow("portal"));
    const res = await GET_TECH(new Request("http://localhost"), jobParams());
    expect(res.status).toBe(403);
    expect(getJobTechnicalDataMock).not.toHaveBeenCalled();
  });

  it("400s on a bad id", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    const res = await GET_TECH(new Request("http://localhost"), jobParams("abc"));
    expect(res.status).toBe(400);
    expect(getJobTechnicalDataMock).not.toHaveBeenCalled();
  });

  it("404s when the job is missing or not assigned to the tech", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    getJobTechnicalDataMock.mockResolvedValue(null);
    const res = await GET_TECH(new Request("http://localhost"), jobParams());
    expect(res.status).toBe(404);
  });

  it("returns the technical data", async () => {
    requirePermissionMock.mockResolvedValue(allow("dispatch"));
    getJobTechnicalDataMock.mockResolvedValue({ jobId: JOB, propertyId: null, systems: [], gaps: [] });
    const res = await GET_TECH(new Request("http://localhost"), jobParams());
    expect(res.status).toBe(200);
    expect((await res.json()).technicalData.jobId).toBe(JOB);
  });
});
