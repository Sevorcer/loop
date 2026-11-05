/**
 * GC Portal — Issue/Request Submission Tests (Task 4)
 *
 * Tests:
 * - Valid submission creates a record (201)
 * - Invalid token is rejected (404)
 * - Rate limit triggers after threshold
 * - Submission is stamped with the correct job from the token
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  resolveShareTokenMock,
  adminInsertMock,
} = vi.hoisted(() => ({
  resolveShareTokenMock: vi.fn(),
  adminInsertMock: vi.fn(),
}));

vi.mock("@/services/jobShareLinks", () => ({
  resolveShareToken: resolveShareTokenMock,
}));

// Mock the rate limiter to control rate limit behavior
const rateLimitCheckMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/security/rateLimit", () => ({
  createRateLimiter: () => ({
    check: rateLimitCheckMock,
    reset: vi.fn(),
  }),
}));

// Mock admin client
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: () => ({
      insert: (data: Record<string, unknown>) => {
        adminInsertMock(data);
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { id: "sub-001", created_at: "2026-11-04T00:00:00Z" },
                error: null,
              }),
          }),
        };
      },
    }),
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_TOKEN = "d".repeat(64);
const INVALID_TOKEN = "e".repeat(64);
const JOB_ID = "job-submit-001";
const ORG_ID = "org-001";
const LINK_ID = "link-001";

function postRequest(token: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/portal/${token}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/portal/[token]/submit — issue submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitCheckMock.mockReturnValue(null); // Not rate-limited by default
  });

  it("creates a submission for a valid token (201)", async () => {
    resolveShareTokenMock.mockResolvedValue({
      id: LINK_ID,
      orgId: ORG_ID,
      jobId: JOB_ID,
    });

    const { POST } = await import("@/app/api/portal/[token]/submit/route");
    const res = await POST(
      postRequest(VALID_TOKEN, {
        name: "Jordan Lee",
        company: "Lee Builders",
        contact: "jordan@builder.com",
        message: "The ductwork in unit 3B needs adjustment.",
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) },
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.submission.id).toBe("sub-001");

    // Verify the insert was called with the correct job from the token
    expect(adminInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: ORG_ID,
        job_id: JOB_ID,
        share_link_id: LINK_ID,
        name: "Jordan Lee",
        contact: "jordan@builder.com",
        message: "The ductwork in unit 3B needs adjustment.",
        submitter_company: "Lee Builders",
      }),
    );
  });

  it("rejects an invalid token (404)", async () => {
    resolveShareTokenMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/portal/[token]/submit/route");
    const res = await POST(
      postRequest(INVALID_TOKEN, {
        name: "Test",
        company: "Test Co",
        message: "Test message",
      }),
      { params: Promise.resolve({ token: INVALID_TOKEN }) },
    );

    expect(res.status).toBe(404);
  });

  it("enforces rate limit per token", async () => {
    resolveShareTokenMock.mockResolvedValue({
      id: LINK_ID,
      orgId: ORG_ID,
      jobId: JOB_ID,
    });

    // Simulate rate limit exceeded
    const { NextResponse } = await import("next/server");
    rateLimitCheckMock.mockReturnValue(
      NextResponse.json(
        { error: "TOO_MANY_REQUESTS", message: "Rate limit exceeded." },
        { status: 429 },
      ),
    );

    const { POST } = await import("@/app/api/portal/[token]/submit/route");
    const res = await POST(
      postRequest(VALID_TOKEN, {
        name: "Spammer",
        company: "Spam Inc",
        message: "spam",
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) },
    );

    expect(res.status).toBe(429);
  });

  it("stamps submission with the job from the token, not from request body", async () => {
    resolveShareTokenMock.mockResolvedValue({
      id: LINK_ID,
      orgId: ORG_ID,
      jobId: JOB_ID,
    });

    const { POST } = await import("@/app/api/portal/[token]/submit/route");
    await POST(
      postRequest(VALID_TOKEN, {
        name: "Test Builder",
        company: "Builder Co",
        message: "Issue with HVAC unit",
        // A malicious client might try to specify a different job:
        jobId: "different-job-id",
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) },
    );

    // Verify the insert uses the token's job, not the body's
    expect(adminInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        job_id: JOB_ID, // From token resolution, not from request body
      }),
    );
  });

  it("rejects submission with missing name", async () => {
    resolveShareTokenMock.mockResolvedValue({
      id: LINK_ID,
      orgId: ORG_ID,
      jobId: JOB_ID,
    });

    const { POST } = await import("@/app/api/portal/[token]/submit/route");
    const res = await POST(
      postRequest(VALID_TOKEN, {
        name: "",
        company: "Some Co",
        message: "Some message",
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) },
    );

    expect(res.status).toBe(400);
  });

  it("rejects submission with missing message", async () => {
    resolveShareTokenMock.mockResolvedValue({
      id: LINK_ID,
      orgId: ORG_ID,
      jobId: JOB_ID,
    });

    const { POST } = await import("@/app/api/portal/[token]/submit/route");
    const res = await POST(
      postRequest(VALID_TOKEN, {
        name: "Test",
        company: "Test Co",
        message: "",
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) },
    );

    expect(res.status).toBe(400);
  });

  it("rejects submission with missing company", async () => {
    resolveShareTokenMock.mockResolvedValue({
      id: LINK_ID,
      orgId: ORG_ID,
      jobId: JOB_ID,
    });

    const { POST } = await import("@/app/api/portal/[token]/submit/route");
    const res = await POST(
      postRequest(VALID_TOKEN, {
        name: "Test",
        company: "",
        message: "Some message",
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) },
    );

    expect(res.status).toBe(400);
  });
});
