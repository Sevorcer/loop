import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  getJobMock,
  recordJobFileUploadMock,
  createJobFileSignedUploadMock,
  completeJobFileSignedUploadMock,
  validateJobFileMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  getJobMock: vi.fn(),
  recordJobFileUploadMock: vi.fn(),
  createJobFileSignedUploadMock: vi.fn(),
  completeJobFileSignedUploadMock: vi.fn(),
  validateJobFileMock: vi.fn(() => null),
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

vi.mock("@/lib/fileValidation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fileValidation")>("@/lib/fileValidation");
  return { ...actual, validateJobFile: validateJobFileMock };
});

vi.mock("@/lib/observability/writes", () => ({
  logWriteFailure: vi.fn(),
}));

vi.mock("@/services/jobs", () => ({
  getJob: getJobMock,
  recordJobFileUpload: recordJobFileUploadMock,
}));

vi.mock("@/services/storage", () => ({
  createJobFileSignedUpload: createJobFileSignedUploadMock,
  completeJobFileSignedUpload: completeJobFileSignedUploadMock,
}));

import { POST as signPOST } from "@/app/api/jobs/[id]/files/sign/route";
import { POST as completePOST } from "@/app/api/jobs/[id]/files/complete/route";

function guard(role: string, userId = "user-1") {
  return { ok: true as const, ctx: { userId, role } };
}

const params = Promise.resolve({ id: "job-1" });

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const signBody = { fileName: "IMG_2001.jpeg", mimeType: "image/jpeg", sizeBytes: 8_400_000 };
const completeBody = {
  storagePath: "jobs/job-1/uuid-IMG_2001.jpeg",
  fileName: "IMG_2001.jpeg",
  mimeType: "image/jpeg",
  sizeBytes: 8_400_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  validateJobFileMock.mockReturnValue(null);
  getJobMock.mockResolvedValue({ id: "job-1", assignees: [{ id: "user-1" }] });
  createJobFileSignedUploadMock.mockResolvedValue({ signedUrl: "https://storage.example/signed" });
  completeJobFileSignedUploadMock.mockResolvedValue({
    id: "file-1",
    fileName: "IMG_2001.jpeg",
    mimeType: "image/jpeg",
  });
  recordJobFileUploadMock.mockResolvedValue(true);
});

describe("POST /api/jobs/[id]/files/sign — direct upload step 1", () => {
  it("returns 403 when a tech is not assigned to the job", async () => {
    requirePermissionMock.mockResolvedValue(guard("tech"));
    getJobMock.mockResolvedValue({ id: "job-1", assignees: [{ id: "someone-else" }] });

    const res = await signPOST(jsonRequest("http://localhost/api/jobs/job-1/files/sign", signBody), { params });
    expect(res.status).toBe(403);
    expect(createJobFileSignedUploadMock).not.toHaveBeenCalled();
  });

  it("issues a signed URL under the job's prefix for an assigned tech", async () => {
    requirePermissionMock.mockResolvedValue(guard("tech"));

    const res = await signPOST(jsonRequest("http://localhost/api/jobs/job-1/files/sign", signBody), { params });
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { signedUrl: string; storagePath: string };
    expect(payload.signedUrl).toBe("https://storage.example/signed");
    expect(payload.storagePath.startsWith("jobs/job-1/")).toBe(true);
    expect(payload.storagePath.endsWith("IMG_2001.jpeg")).toBe(true);
  });

  it("allows office regardless of assignment", async () => {
    requirePermissionMock.mockResolvedValue(guard("office"));

    const res = await signPOST(jsonRequest("http://localhost/api/jobs/job-1/files/sign", signBody), { params });
    expect(res.status).toBe(200);
    expect(getJobMock).not.toHaveBeenCalled();
  });

  it("rejects a file that fails validation (e.g. over the size ceiling)", async () => {
    requirePermissionMock.mockResolvedValue(guard("office"));
    validateJobFileMock.mockReturnValue("File is too large.");

    const res = await signPOST(jsonRequest("http://localhost/api/jobs/job-1/files/sign", signBody), { params });
    expect(res.status).toBe(400);
    expect(createJobFileSignedUploadMock).not.toHaveBeenCalled();
  });

  it("rejects a body without a file name", async () => {
    requirePermissionMock.mockResolvedValue(guard("office"));

    const res = await signPOST(
      jsonRequest("http://localhost/api/jobs/job-1/files/sign", { mimeType: "image/jpeg", sizeBytes: 10 }),
      { params },
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/jobs/[id]/files/complete — direct upload step 2", () => {
  it("returns 403 when a tech is not assigned to the job", async () => {
    requirePermissionMock.mockResolvedValue(guard("tech"));
    getJobMock.mockResolvedValue({ id: "job-1", assignees: [] });

    const res = await completePOST(jsonRequest("http://localhost/api/jobs/job-1/files/complete", completeBody), { params });
    expect(res.status).toBe(403);
    expect(completeJobFileSignedUploadMock).not.toHaveBeenCalled();
  });

  it("refuses a storagePath that belongs to a different job", async () => {
    requirePermissionMock.mockResolvedValue(guard("office"));

    const res = await completePOST(
      jsonRequest("http://localhost/api/jobs/job-1/files/complete", {
        ...completeBody,
        storagePath: "jobs/job-2/uuid-IMG_2001.jpeg",
      }),
      { params },
    );
    expect(res.status).toBe(400);
    expect(completeJobFileSignedUploadMock).not.toHaveBeenCalled();
  });

  it("records the upload and returns 201 on the happy path", async () => {
    requirePermissionMock.mockResolvedValue(guard("tech"));

    const res = await completePOST(jsonRequest("http://localhost/api/jobs/job-1/files/complete", completeBody), { params });
    expect(res.status).toBe(201);
    expect(completeJobFileSignedUploadMock).toHaveBeenCalledWith(
      "tech",
      expect.objectContaining({ jobId: "job-1", storagePath: completeBody.storagePath, sizeBytes: 8_400_000 }),
    );
    expect(recordJobFileUploadMock).toHaveBeenCalledWith(
      "job-1",
      "IMG_2001.jpeg",
      "image/jpeg",
      expect.objectContaining({ actorId: "user-1", role: "tech" }),
    );
  });
});
