/**
 * Phase 3 Task 1 — Job permits service tests.
 *
 * Covers: CRUD, void/un-void, status pipeline validation, and role-based
 * edit gating (techs read-only).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  listJobPermitsMock,
  getPermitByIdMock,
  createPermitMock,
  updatePermitMock,
  voidPermitMock,
  unvoidPermitMock,
  listActivePermitsMock,
} = vi.hoisted(() => ({
  listJobPermitsMock: vi.fn(),
  getPermitByIdMock: vi.fn(),
  createPermitMock: vi.fn(),
  updatePermitMock: vi.fn(),
  voidPermitMock: vi.fn(),
  unvoidPermitMock: vi.fn(),
  listActivePermitsMock: vi.fn(),
}));

vi.mock("@/repositories/jobPermits", () => ({
  listJobPermits: listJobPermitsMock,
  getPermitById: getPermitByIdMock,
  createPermit: createPermitMock,
  updatePermit: updatePermitMock,
  voidPermit: voidPermitMock,
  unvoidPermit: unvoidPermitMock,
  listActivePermits: listActivePermitsMock,
  isPermitStatus: (v: string) =>
    ["applied", "intake_scheduled", "corrections_needed", "resubmitted", "waiting_on_city", "issued"].includes(v),
}));

const {
  createJobPermit,
  updateJobPermit,
  voidJobPermit,
  unvoidJobPermit,
  listJobPermits,
  listActivePermits,
  canEditPermits,
  isPermitStatus,
} = await import("@/services/jobPermits");

const JOB_ID = "job-001";
const USER_ID = "user-001";

function makePermit(overrides: Partial<{
  id: string;
  status: string;
  voidedAt: string | null;
}> = {}) {
  return {
    id: overrides.id ?? "permit-001",
    orgId: "org-001",
    jobId: JOB_ID,
    jurisdiction: "Seattle",
    permitType: "Mechanical",
    permitNumber: null,
    status: overrides.status ?? "applied",
    appliedAt: "2026-11-01T10:00:00Z",
    intakeAppointmentAt: null,
    issuedAt: null,
    correctionsNotes: null,
    notes: null,
    voidedAt: overrides.voidedAt ?? null,
    voidedBy: null,
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-01T10:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

describe("listJobPermits", () => {
  it("returns permits from the repository", async () => {
    const permits = [makePermit()];
    listJobPermitsMock.mockResolvedValue(permits);

    const result = await listJobPermits(JOB_ID);
    expect(result).toEqual(permits);
    expect(listJobPermitsMock).toHaveBeenCalledWith(JOB_ID);
  });
});

describe("createJobPermit", () => {
  it("creates a permit with valid input", async () => {
    const permit = makePermit();
    createPermitMock.mockResolvedValue(permit);

    const result = await createJobPermit({
      jobId: JOB_ID,
      jurisdiction: "Seattle",
      permitType: "Mechanical",
    });

    expect(result).toEqual(permit);
    expect(createPermitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: JOB_ID,
        jurisdiction: "Seattle",
        permitType: "Mechanical",
      }),
    );
  });

  it("rejects empty jurisdiction", async () => {
    await expect(
      createJobPermit({ jobId: JOB_ID, jurisdiction: "", permitType: "Mechanical" }),
    ).rejects.toThrow("Jurisdiction is required.");
  });

  it("rejects empty permit type", async () => {
    await expect(
      createJobPermit({ jobId: JOB_ID, jurisdiction: "Seattle", permitType: "  " }),
    ).rejects.toThrow("Permit type is required.");
  });
});

describe("updateJobPermit", () => {
  it("updates permit fields", async () => {
    const updated = makePermit({ status: "issued" });
    updatePermitMock.mockResolvedValue(updated);

    const result = await updateJobPermit("permit-001", { status: "issued" });
    expect(result.status).toBe("issued");
  });

  it("rejects invalid status", async () => {
    await expect(
      updateJobPermit("permit-001", { status: "bogus" as never }),
    ).rejects.toThrow("Invalid permit status");
  });
});

// ---------------------------------------------------------------------------
// Void / Un-void
// ---------------------------------------------------------------------------

describe("voidJobPermit", () => {
  it("voids an active permit", async () => {
    getPermitByIdMock.mockResolvedValue(makePermit());
    const voided = makePermit({ voidedAt: "2026-11-04T10:00:00Z" });
    voidPermitMock.mockResolvedValue(voided);

    const result = await voidJobPermit("permit-001", USER_ID);
    expect(result.voidedAt).toBeTruthy();
    expect(voidPermitMock).toHaveBeenCalledWith("permit-001", USER_ID);
  });

  it("rejects voiding an already-voided permit", async () => {
    getPermitByIdMock.mockResolvedValue(
      makePermit({ voidedAt: "2026-11-04T10:00:00Z" }),
    );

    await expect(voidJobPermit("permit-001", USER_ID)).rejects.toThrow(
      "Permit is already voided.",
    );
  });
});

describe("unvoidJobPermit", () => {
  it("restores a voided permit", async () => {
    getPermitByIdMock.mockResolvedValue(
      makePermit({ voidedAt: "2026-11-04T10:00:00Z" }),
    );
    const restored = makePermit();
    unvoidPermitMock.mockResolvedValue(restored);

    const result = await unvoidJobPermit("permit-001");
    expect(result.voidedAt).toBeNull();
  });

  it("rejects un-voiding a non-voided permit", async () => {
    getPermitByIdMock.mockResolvedValue(makePermit());

    await expect(unvoidJobPermit("permit-001")).rejects.toThrow(
      "Permit is not voided.",
    );
  });
});

// ---------------------------------------------------------------------------
// Status pipeline
// ---------------------------------------------------------------------------

describe("isPermitStatus", () => {
  it.each([
    "applied",
    "intake_scheduled",
    "corrections_needed",
    "resubmitted",
    "waiting_on_city",
    "issued",
  ])("accepts valid status: %s", (status) => {
    expect(isPermitStatus(status)).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(isPermitStatus("bogus")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Role gating
// ---------------------------------------------------------------------------

describe("canEditPermits", () => {
  it.each(["owner", "manager", "office"])("allows %s to edit", (role) => {
    expect(canEditPermits(role)).toBe(true);
  });

  it.each(["tech", "dispatch", "sales", "portal"])("denies %s from editing", (role) => {
    expect(canEditPermits(role)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Active permits (office views)
// ---------------------------------------------------------------------------

describe("listActivePermits", () => {
  it("returns only non-voided permits", async () => {
    const active = [makePermit()];
    listActivePermitsMock.mockResolvedValue(active);

    const result = await listActivePermits();
    expect(result).toEqual(active);
    expect(listActivePermitsMock).toHaveBeenCalled();
  });
});
