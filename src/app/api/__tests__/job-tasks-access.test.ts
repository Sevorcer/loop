import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requirePermissionMock, createJobTaskMock, setJobTaskDoneMock, deleteJobTaskMock } =
  vi.hoisted(() => ({
    requirePermissionMock: vi.fn(),
    createJobTaskMock: vi.fn(),
    setJobTaskDoneMock: vi.fn(),
    deleteJobTaskMock: vi.fn(),
  }));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/services/jobTasks", () => ({
  applyInstallChecklistTemplate: vi.fn(),
  createJobTask: createJobTaskMock,
  deleteJobTask: deleteJobTaskMock,
  listJobTasks: vi.fn(),
  renameJobTask: vi.fn(),
  setJobTaskDone: setJobTaskDoneMock,
}));

import { DELETE, PATCH, POST } from "@/app/api/jobs/[id]/tasks/route";

function guard(role: string) {
  return { ok: true as const, ctx: { userId: "user-1", role } };
}

function denied() {
  return {
    ok: false as const,
    response: new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 }),
  };
}

const params = Promise.resolve({ id: "job-1" });

describe("job checklist route access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets a technician check an item off", async () => {
    requirePermissionMock.mockResolvedValue(guard("tech"));
    setJobTaskDoneMock.mockResolvedValue({ id: "task-1", isDone: true });

    const response = await PATCH(
      new Request("http://localhost/api/jobs/job-1/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: "task-1", isDone: true }),
      }),
      { params },
    );

    expect(response.status).toBe(200);
    expect(setJobTaskDoneMock).toHaveBeenCalledWith("task-1", true);
  });

  it("refuses a technician adding or removing an item", async () => {
    requirePermissionMock.mockResolvedValue(guard("tech"));

    const add = await POST(
      new Request("http://localhost/api/jobs/job-1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Load lineset", section: "field" }),
      }),
      { params },
    );
    const remove = await DELETE(
      new Request("http://localhost/api/jobs/job-1/tasks", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: "task-1" }),
      }),
      { params },
    );

    expect(add.status).toBe(403);
    expect(remove.status).toBe(403);
    expect(createJobTaskMock).not.toHaveBeenCalled();
    expect(deleteJobTaskMock).not.toHaveBeenCalled();
  });

  it("lets office staff add an item and keeps sales from writing", async () => {
    requirePermissionMock.mockResolvedValue(guard("office"));
    createJobTaskMock.mockResolvedValue({ id: "task-2" });

    const add = await POST(
      new Request("http://localhost/api/jobs/job-1/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: "Pull permit", section: "office" }),
      }),
      { params },
    );

    expect(add.status).toBe(200);
    expect(createJobTaskMock).toHaveBeenCalledWith("job-1", "Pull permit", "office");

    requirePermissionMock.mockResolvedValue(guard("sales"));
    const sales = await PATCH(
      new Request("http://localhost/api/jobs/job-1/tasks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: "task-1", isDone: true }),
      }),
      { params },
    );

    expect(sales.status).toBe(403);
    expect(setJobTaskDoneMock).not.toHaveBeenCalled();
  });

  it("returns the permission response when the caller is not signed in", async () => {
    requirePermissionMock.mockResolvedValue(denied());

    const response = await POST(
      new Request("http://localhost/api/jobs/job-1/tasks", {
        method: "POST",
        body: JSON.stringify({ label: "Pull permit" }),
      }),
      { params },
    );

    expect(response.status).toBe(403);
    expect(createJobTaskMock).not.toHaveBeenCalled();
  });
});
