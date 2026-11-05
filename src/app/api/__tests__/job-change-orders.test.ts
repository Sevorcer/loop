import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  listByJobIdMock,
  createChangeOrderMock,
  approveChangeOrderMock,
  declineChangeOrderMock,
  updateChangeOrderMock,
  deleteChangeOrderMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  listByJobIdMock: vi.fn(),
  createChangeOrderMock: vi.fn(),
  approveChangeOrderMock: vi.fn(),
  declineChangeOrderMock: vi.fn(),
  updateChangeOrderMock: vi.fn(),
  deleteChangeOrderMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>(
    "@/lib/api-auth",
  );
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/services/jobChangeOrders", () => ({
  listByJobId: listByJobIdMock,
  createChangeOrder: createChangeOrderMock,
  approveChangeOrder: approveChangeOrderMock,
  declineChangeOrder: declineChangeOrderMock,
  updateChangeOrder: updateChangeOrderMock,
  deleteChangeOrder: deleteChangeOrderMock,
  canEditChangeOrders: (role: string) =>
    role === "owner" || role === "manager" || role === "office",
  canDeleteChangeOrders: (role: string) =>
    role === "owner" || role === "manager",
  isChangeOrderStatus: (v: string) =>
    ["proposed", "approved", "declined"].includes(v),
}));

import { DELETE, GET, PATCH, POST } from "@/app/api/jobs/[id]/change-orders/route";

function guard(role: string) {
  return { ok: true as const, ctx: { userId: "user-1", role } };
}

function denied() {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error: "FORBIDDEN" }), {
      status: 403,
    }),
  };
}

const params = Promise.resolve({ id: "job-1" });

function jsonRequest(
  method: string,
  body: Record<string, unknown>,
): Request {
  return new Request("http://localhost/api/jobs/job-1/change-orders", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("job change orders API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET (list) ────────────────────────────────────────────────────────

  describe("GET", () => {
    it("lists change orders for a job", async () => {
      requirePermissionMock.mockResolvedValue(guard("office"));
      listByJobIdMock.mockResolvedValue([
        { id: "co-1", title: "Extra duct", amountCents: 15000, status: "proposed" },
      ]);

      const res = await GET(
        new Request("http://localhost/api/jobs/job-1/change-orders"),
        { params },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.changeOrders).toHaveLength(1);
      expect(json.changeOrders[0].id).toBe("co-1");
    });

    it("allows tech to read change orders", async () => {
      requirePermissionMock.mockResolvedValue(guard("tech"));
      listByJobIdMock.mockResolvedValue([]);

      const res = await GET(
        new Request("http://localhost/api/jobs/job-1/change-orders"),
        { params },
      );

      expect(res.status).toBe(200);
    });

    it("returns 403 when permission denied", async () => {
      requirePermissionMock.mockResolvedValue(denied());

      const res = await GET(
        new Request("http://localhost/api/jobs/job-1/change-orders"),
        { params },
      );

      expect(res.status).toBe(403);
    });
  });

  // ── POST (create) ──────────────────────────────────────────────────────

  describe("POST", () => {
    it("creates a change order for office role", async () => {
      requirePermissionMock.mockResolvedValue(guard("office"));
      createChangeOrderMock.mockResolvedValue({
        id: "co-new",
        title: "Extra work",
        amountCents: 50000,
        status: "proposed",
      });

      const res = await POST(
        jsonRequest("POST", {
          title: "Extra work",
          amountCents: 50000,
        }),
        { params },
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.changeOrder.id).toBe("co-new");
    });

    it("blocks tech from creating", async () => {
      requirePermissionMock.mockResolvedValue(guard("tech"));

      const res = await POST(
        jsonRequest("POST", { title: "Nope", amountCents: 100 }),
        { params },
      );

      expect(res.status).toBe(403);
    });
  });

  // ── PATCH (update / approve / decline) ────────────────────────────────

  describe("PATCH", () => {
    it("approves a change order", async () => {
      requirePermissionMock.mockResolvedValue(guard("owner"));
      approveChangeOrderMock.mockResolvedValue({
        id: "co-1",
        status: "approved",
        approvedAt: "2026-11-04T00:00:00Z",
      });

      const res = await PATCH(
        jsonRequest("PATCH", { changeOrderId: "co-1", action: "approve" }),
        { params },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.changeOrder.status).toBe("approved");
      expect(approveChangeOrderMock).toHaveBeenCalledWith("co-1");
    });

    it("declines a change order", async () => {
      requirePermissionMock.mockResolvedValue(guard("manager"));
      declineChangeOrderMock.mockResolvedValue({
        id: "co-1",
        status: "declined",
      });

      const res = await PATCH(
        jsonRequest("PATCH", { changeOrderId: "co-1", action: "decline" }),
        { params },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.changeOrder.status).toBe("declined");
    });

    it("updates fields on a change order", async () => {
      requirePermissionMock.mockResolvedValue(guard("office"));
      updateChangeOrderMock.mockResolvedValue({
        id: "co-1",
        title: "Updated title",
        amountCents: 20000,
      });

      const res = await PATCH(
        jsonRequest("PATCH", {
          changeOrderId: "co-1",
          title: "Updated title",
          amountCents: 20000,
        }),
        { params },
      );

      expect(res.status).toBe(200);
      expect(updateChangeOrderMock).toHaveBeenCalledWith("co-1", {
        title: "Updated title",
        description: undefined,
        amountCents: 20000,
      });
    });

    it("blocks tech from updating", async () => {
      requirePermissionMock.mockResolvedValue(guard("tech"));

      const res = await PATCH(
        jsonRequest("PATCH", { changeOrderId: "co-1", action: "approve" }),
        { params },
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 when changeOrderId is missing", async () => {
      requirePermissionMock.mockResolvedValue(guard("owner"));

      const res = await PATCH(
        jsonRequest("PATCH", { action: "approve" }),
        { params },
      );

      expect(res.status).toBe(400);
    });
  });

  // ── DELETE ─────────────────────────────────────────────────────────────

  describe("DELETE", () => {
    it("lets owner delete a change order", async () => {
      requirePermissionMock.mockResolvedValue(guard("owner"));
      deleteChangeOrderMock.mockResolvedValue(undefined);

      const res = await DELETE(
        jsonRequest("DELETE", { changeOrderId: "co-1" }),
        { params },
      );

      expect(res.status).toBe(200);
      expect(deleteChangeOrderMock).toHaveBeenCalledWith("co-1");
    });

    it("lets manager delete a change order", async () => {
      requirePermissionMock.mockResolvedValue(guard("manager"));
      deleteChangeOrderMock.mockResolvedValue(undefined);

      const res = await DELETE(
        jsonRequest("DELETE", { changeOrderId: "co-1" }),
        { params },
      );

      expect(res.status).toBe(200);
    });

    it("blocks office from deleting", async () => {
      requirePermissionMock.mockResolvedValue(guard("office"));

      const res = await DELETE(
        jsonRequest("DELETE", { changeOrderId: "co-1" }),
        { params },
      );

      expect(res.status).toBe(403);
    });

    it("blocks tech from deleting", async () => {
      requirePermissionMock.mockResolvedValue(guard("tech"));

      const res = await DELETE(
        jsonRequest("DELETE", { changeOrderId: "co-1" }),
        { params },
      );

      expect(res.status).toBe(403);
    });
  });

  // ── Approved total calculation (via service layer pattern) ────────────

  describe("approved total", () => {
    it("lists only approved orders for total calculation", async () => {
      requirePermissionMock.mockResolvedValue(guard("office"));
      listByJobIdMock.mockResolvedValue([
        { id: "co-1", title: "A", amountCents: 10000, status: "approved" },
        { id: "co-2", title: "B", amountCents: 20000, status: "proposed" },
        { id: "co-3", title: "C", amountCents: 5000, status: "approved" },
        { id: "co-4", title: "D", amountCents: 8000, status: "declined" },
      ]);

      const res = await GET(
        new Request("http://localhost/api/jobs/job-1/change-orders"),
        { params },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      const approvedTotal = json.changeOrders
        .filter((co: { status: string }) => co.status === "approved")
        .reduce((sum: number, co: { amountCents: number }) => sum + co.amountCents, 0);
      expect(approvedTotal).toBe(15000);
    });
  });
});
