import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  getJobMock,
  listJobFilesMock,
  recordJobFileUploadMock,
  uploadStorageFileMock,
  withPhotoPreviewUrlsMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getJobMock: vi.fn(),
  listJobFilesMock: vi.fn(),
  recordJobFileUploadMock: vi.fn(),
  uploadStorageFileMock: vi.fn(),
  withPhotoPreviewUrlsMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/lib/api/routeErrors", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/routeErrors")>("@/lib/api/routeErrors");
  return {
    ...actual,
    mapRouteError: vi.fn((error: unknown) =>
      new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
    ),
  };
});

vi.mock("@/lib/fileValidation", () => ({
  validateJobFile: vi.fn(() => null),
}));

vi.mock("@/lib/observability/writes", () => ({
  logWriteFailure: vi.fn(),
}));

vi.mock("@/services/jobs", () => ({
  getJob: getJobMock,
  listJobFiles: listJobFilesMock,
  recordJobFileUpload: recordJobFileUploadMock,
}));

vi.mock("@/services/storage", () => ({
  uploadStorageFile: uploadStorageFileMock,
  withPhotoPreviewUrls: withPhotoPreviewUrlsMock,
}));

import { POST } from "@/app/api/jobs/[id]/files/route";

function guard(role: string, userId = "user-1") {
  return { ok: true as const, ctx: { userId, role } };
}

const params = Promise.resolve({ id: "job-1" });

function makeUploadRequest() {
  const formData = new FormData();
  formData.append("file", new File(["test"], "photo.jpg", { type: "image/jpeg" }));
  return new Request("http://localhost/api/jobs/job-1/files", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/jobs/[id]/files — upload authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadStorageFileMock.mockResolvedValue({
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
    });
    recordJobFileUploadMock.mockResolvedValue(undefined);
  });

  it("returns 403 when a tech is not assigned to the job", async () => {
    requirePermissionMock.mockResolvedValue(guard("tech", "user-99"));
    getJobMock.mockResolvedValue({
      id: "job-1",
      assignees: [{ id: "user-1", name: "Alice" }],
    });

    const response = await POST(makeUploadRequest(), { params });

    expect(response.status).toBe(403);
    expect(uploadStorageFileMock).not.toHaveBeenCalled();
  });

  it("allows an assigned tech to upload", async () => {
    requirePermissionMock.mockResolvedValue(guard("tech", "user-1"));
    getJobMock.mockResolvedValue({
      id: "job-1",
      assignees: [{ id: "user-1", name: "Alice" }],
    });

    const response = await POST(makeUploadRequest(), { params });

    expect(response.status).toBe(201);
    expect(uploadStorageFileMock).toHaveBeenCalled();
  });

  it("allows office role regardless of assignment", async () => {
    requirePermissionMock.mockResolvedValue(guard("office", "user-50"));
    // getJob should NOT be called for non-tech roles
    getJobMock.mockResolvedValue(null);

    const response = await POST(makeUploadRequest(), { params });

    expect(response.status).toBe(201);
    expect(getJobMock).not.toHaveBeenCalled();
  });

  it("returns 404 when tech tries to upload to a non-existent job", async () => {
    requirePermissionMock.mockResolvedValue(guard("tech", "user-1"));
    getJobMock.mockResolvedValue(null);

    const response = await POST(makeUploadRequest(), { params });

    expect(response.status).toBe(404);
    expect(uploadStorageFileMock).not.toHaveBeenCalled();
  });
});
