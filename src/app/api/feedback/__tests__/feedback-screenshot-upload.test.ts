/**
 * P1 regression lock — feedback screenshot upload path (#308)
 *
 * Verifies that the POST /api/feedback route, when given a multipart form with
 * a screenshot file, uploads it to the feedback-screenshots bucket and stores
 * the resulting screenshotUrl on the created report without a storage error.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  requirePermissionMock,
  uploadFileMock,
  createFeedbackReportMock,
  logWriteFailureMock,
} = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  uploadFileMock: vi.fn(),
  createFeedbackReportMock: vi.fn(),
  logWriteFailureMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-auth")>("@/lib/api-auth");
  return { ...actual, requirePermission: requirePermissionMock };
});

vi.mock("@/lib/api/routeErrors", () => ({
  readJsonObject: vi.fn(),
  invalidJsonResponse: vi.fn(() =>
    new Response(JSON.stringify({ error: "INVALID_PAYLOAD", code: 400 }), { status: 400 }),
  ),
  mapRouteError: vi.fn((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }),
  createApiErrorResponse: vi.fn((code: string, message: string, status: number) =>
    new Response(JSON.stringify({ error: code, message }), { status }),
  ),
}));

vi.mock("@/repositories/storage", () => ({
  uploadFile: uploadFileMock,
}));

vi.mock("@/services/feedbackReports", () => ({
  createFeedbackReport: createFeedbackReportMock,
  listFeedbackReports: vi.fn(),
  updateFeedbackReport: vi.fn(),
  getFeedbackReportById: vi.fn(),
  deleteFeedbackReport: vi.fn(),
}));

vi.mock("@/lib/observability/writes", () => ({
  logWriteFailure: logWriteFailureMock,
}));

function authorizedResult(role = "tech") {
  return {
    ok: true as const,
    ctx: { role, userId: "user-001" },
  };
}

function makeMultipartRequest(
  file: File,
  fields: Record<string, string> = {},
): Request {
  const form = new FormData();
  form.set("severity", fields.severity ?? "P1");
  form.set("intendedAction", fields.intendedAction ?? "Submit feedback");
  form.set("actualResult", fields.actualResult ?? "Error shown");
  form.set("routePath", fields.routePath ?? "/dispatch");
  form.set("screenshot", file);

  return new Request("http://localhost/api/feedback", {
    method: "POST",
    body: form,
  });
}

const mockReport = {
  id: "fb-screenshot-001",
  orgId: "org-001",
  createdAt: "2026-08-01T00:00:00Z",
  createdByUserId: "user-001",
  createdByRole: "tech",
  severity: "P1",
  intendedAction: "Submit feedback",
  actualResult: "Error shown",
  routePath: "/dispatch",
  contextJobId: null,
  contextCustomerId: null,
  contextPropertyId: null,
  screenshotUrl: "/api/feedback/screenshots/feedback%2Ftest-screenshot.png",
  status: "new",
  triageNotes: null,
};

describe("POST /api/feedback — screenshot upload (P1 regression lock #308)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uploads a screenshot to the feedback-screenshots bucket and stores the URL", async () => {
    requirePermissionMock.mockResolvedValueOnce(authorizedResult("tech"));

    uploadFileMock.mockResolvedValueOnce({
      id: "storage-001",
      storagePath: "feedback/test-screenshot.png",
      bucket: "feedback-screenshots",
      fileName: "screenshot.png",
      mimeType: "image/png",
    });

    createFeedbackReportMock.mockResolvedValueOnce(mockReport);

    const file = new File(
      [new Uint8Array(100)],
      "screenshot.png",
      { type: "image/png" },
    );

    const { POST } = await import("../../route");
    const res = await POST(makeMultipartRequest(file));

    expect(res.status).toBe(201);

    expect(uploadFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "feedback-screenshots",
        mimeType: "image/png",
        visibility: "internal",
        uploadedBy: "user-001",
      }),
    );

    expect(createFeedbackReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        screenshotUrl: expect.stringContaining("/api/feedback/screenshots/"),
      }),
      expect.objectContaining({
        userId: "user-001",
        role: "tech",
      }),
    );

    const body = await res.json() as { report: { id: string; screenshotUrl: string | null } };
    expect(body.report.id).toBe("fb-screenshot-001");
    expect(body.report.screenshotUrl).toBeTruthy();
  });

  it("succeeds without a screenshot (no storage call)", async () => {
    requirePermissionMock.mockResolvedValueOnce(authorizedResult("tech"));
    createFeedbackReportMock.mockResolvedValueOnce({
      ...mockReport,
      screenshotUrl: null,
    });

    const { POST } = await import("../../route");
    const res = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          severity: "P1",
          intendedAction: "Submit feedback",
          actualResult: "Error shown",
          routePath: "/dispatch",
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid screenshot type", async () => {
    requirePermissionMock.mockResolvedValueOnce(authorizedResult("tech"));

    const file = new File(
      [new Uint8Array(100)],
      "payload.pdf",
      { type: "application/pdf" },
    );

    const { POST } = await import("../../route");
    const res = await POST(makeMultipartRequest(file));

    expect(res.status).toBe(400);
    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(createFeedbackReportMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized screenshot (>10 MB)", async () => {
    requirePermissionMock.mockResolvedValueOnce(authorizedResult("tech"));

    const largeBuffer = new Uint8Array(11 * 1024 * 1024);
    const file = new File(
      [largeBuffer],
      "huge.png",
      { type: "image/png" },
    );

    const { POST } = await import("../../route");
    const res = await POST(makeMultipartRequest(file));

    expect(res.status).toBe(400);
    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(createFeedbackReportMock).not.toHaveBeenCalled();
  });

  it("propagates a storage upload failure as a 500", async () => {
    requirePermissionMock.mockResolvedValueOnce(authorizedResult("tech"));

    uploadFileMock.mockRejectedValueOnce(
      new Error("Storage upload failed after 3 attempts: bucket policy denied"),
    );

    const file = new File(
      [new Uint8Array(100)],
      "screenshot.png",
      { type: "image/png" },
    );

    const { POST } = await import("../../route");
    const res = await POST(makeMultipartRequest(file));

    expect(res.status).toBe(500);
    expect(createFeedbackReportMock).not.toHaveBeenCalled();
  });
});
