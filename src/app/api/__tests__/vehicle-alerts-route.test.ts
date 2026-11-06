import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  listVehicleAlertsMock,
  createVehicleAlertMock,
  updateVehicleAlertStatusMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  listVehicleAlertsMock: vi.fn(),
  createVehicleAlertMock: vi.fn(),
  updateVehicleAlertStatusMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/services/vehicleAlerts", async () => {
  const actual = await vi.importActual<typeof import("@/services/vehicleAlerts")>(
    "@/services/vehicleAlerts",
  );
  return {
    ...actual,
    listVehicleAlerts: listVehicleAlertsMock,
    createVehicleAlert: createVehicleAlertMock,
    updateVehicleAlertStatus: updateVehicleAlertStatusMock,
  };
});

import { GET, POST } from "@/app/api/vehicle-alerts/route";
import { PATCH } from "@/app/api/vehicle-alerts/[id]/route";

function allow(role: string, userId = "user-1") {
  return { ok: true as const, ctx: { userId, role } };
}

function deny(status: 401 | 403) {
  return {
    ok: false as const,
    response: NextResponse.json(
      {
        error: status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
        message: status === 401 ? "A valid session is required." : "Forbidden.",
        code: status,
      },
      { status },
    ),
  };
}

const sampleAlert = {
  id: "va-1",
  vehicleId: "veh-1",
  vehicleName: "Van 1",
  title: "Oil change",
  description: "Due soon",
  priority: "Medium" as const,
  status: "New" as const,
  reportedBy: "Collin",
  reportedAt: "2026-11-04",
};

describe("GET /api/vehicle-alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    requirePermissionMock.mockResolvedValue(deny(401));
    const res = await GET(new Request("http://localhost/api/vehicle-alerts"));
    expect(res.status).toBe(401);
    expect(listVehicleAlertsMock).not.toHaveBeenCalled();
  });

  it("rejects portal role", async () => {
    requirePermissionMock.mockResolvedValue(deny(403));
    const res = await GET(new Request("http://localhost/api/vehicle-alerts"));
    expect(res.status).toBe(403);
    expect(listVehicleAlertsMock).not.toHaveBeenCalled();
  });

  it("lists alerts for an allowed staff role", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    listVehicleAlertsMock.mockResolvedValue([sampleAlert]);
    const res = await GET(new Request("http://localhost/api/vehicle-alerts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts).toHaveLength(1);
    expect(listVehicleAlertsMock).toHaveBeenCalled();
  });
});

describe("POST /api/vehicle-alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    requirePermissionMock.mockResolvedValue(deny(401));
    const res = await POST(
      new Request("http://localhost/api/vehicle-alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleId: "veh-1",
          title: "Tire",
          description: "Flat",
          priority: "High",
        }),
      }),
    );
    expect(res.status).toBe(401);
    expect(createVehicleAlertMock).not.toHaveBeenCalled();
  });

  it("rejects portal role", async () => {
    requirePermissionMock.mockResolvedValue(deny(403));
    const res = await POST(
      new Request("http://localhost/api/vehicle-alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleId: "veh-1",
          title: "Tire",
          description: "Flat",
          priority: "High",
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(createVehicleAlertMock).not.toHaveBeenCalled();
  });

  it("creates with reportedByUserId from session, ignoring body.reportedBy", async () => {
    requirePermissionMock.mockResolvedValue(allow("office", "user-42"));
    createVehicleAlertMock.mockResolvedValue(sampleAlert);

    const res = await POST(
      new Request("http://localhost/api/vehicle-alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleId: "veh-1",
          title: "Tire",
          description: "Flat",
          priority: "High",
          reportedBy: "Should Be Ignored",
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(createVehicleAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: "veh-1",
        title: "Tire",
        description: "Flat",
        priority: "High",
        reportedByUserId: "user-42",
      }),
      expect.anything(),
    );
    const arg = createVehicleAlertMock.mock.calls[0][0];
    expect(arg).not.toHaveProperty("reportedBy");
  });

  it("passes the picked vehicleId through to the service", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech", "user-42"));
    createVehicleAlertMock.mockResolvedValue(sampleAlert);

    const res = await POST(
      new Request("http://localhost/api/vehicle-alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleId: "veh-1",
          title: "Tire",
          description: "Flat",
          priority: "High",
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(createVehicleAlertMock).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleId: "veh-1", reportedByUserId: "user-42" }),
      expect.anything(),
    );
  });

  it("passes an empty vehicleId (never free text) when none is sent", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech", "user-42"));
    createVehicleAlertMock.mockResolvedValue(sampleAlert);
    await POST(
      new Request("http://localhost/api/vehicle-alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vehicleName: "Van 1", title: "Tire", description: "Flat", priority: "High" }),
      }),
    );
    const arg = createVehicleAlertMock.mock.calls[0][0];
    expect(arg.vehicleId).toBe("");
    expect(arg).not.toHaveProperty("vehicleName");
  });

  it("rejects invalid priority", async () => {
    requirePermissionMock.mockResolvedValue(allow("tech"));
    const res = await POST(
      new Request("http://localhost/api/vehicle-alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleId: "veh-1",
          title: "Tire",
          description: "Flat",
          priority: "Urgent",
        }),
      }),
    );
    expect(res.status).toBe(400);
    expect(createVehicleAlertMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/vehicle-alerts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated callers", async () => {
    requirePermissionMock.mockResolvedValue(deny(401));
    const res = await PATCH(
      new Request("http://localhost/api/vehicle-alerts/va-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "Acknowledged" }),
      }),
      { params: Promise.resolve({ id: "va-1" }) },
    );
    expect(res.status).toBe(401);
    expect(updateVehicleAlertStatusMock).not.toHaveBeenCalled();
  });

  it("rejects tech role (cannot update status)", async () => {
    requirePermissionMock.mockResolvedValue(deny(403));
    const res = await PATCH(
      new Request("http://localhost/api/vehicle-alerts/va-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "Acknowledged" }),
      }),
      { params: Promise.resolve({ id: "va-1" }) },
    );
    expect(res.status).toBe(403);
    expect(updateVehicleAlertStatusMock).not.toHaveBeenCalled();
  });

  it("updates status for office role", async () => {
    requirePermissionMock.mockResolvedValue(allow("office"));
    updateVehicleAlertStatusMock.mockResolvedValue({
      ...sampleAlert,
      status: "Acknowledged",
    });
    const res = await PATCH(
      new Request("http://localhost/api/vehicle-alerts/va-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "Acknowledged" }),
      }),
      { params: Promise.resolve({ id: "va-1" }) },
    );
    expect(res.status).toBe(200);
    expect(updateVehicleAlertStatusMock).toHaveBeenCalledWith(
      "va-1",
      "Acknowledged",
      expect.anything(),
    );
  });
});
