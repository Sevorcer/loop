/**
 * Phase 3 Task 2 — Job inspections + corrections service tests.
 *
 * Covers: CRUD for inspections and corrections, re-inspection linking,
 * rescheduled_by_city result, corrections lifecycle, role gating.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  listJobInspectionsMock,
  getInspectionByIdMock,
  createInspectionMock,
  updateInspectionMock,
  listAllInspectionsMock,
  listCorrectionsMock,
  createCorrectionMock,
  updateCorrectionCompleteMock,
  deleteCorrectionMock,
} = vi.hoisted(() => ({
  listJobInspectionsMock: vi.fn(),
  getInspectionByIdMock: vi.fn(),
  createInspectionMock: vi.fn(),
  updateInspectionMock: vi.fn(),
  listAllInspectionsMock: vi.fn(),
  listCorrectionsMock: vi.fn(),
  createCorrectionMock: vi.fn(),
  updateCorrectionCompleteMock: vi.fn(),
  deleteCorrectionMock: vi.fn(),
}));

vi.mock("@/repositories/jobInspections", () => ({
  listJobInspections: listJobInspectionsMock,
  getInspectionById: getInspectionByIdMock,
  createInspection: createInspectionMock,
  updateInspection: updateInspectionMock,
  listAllInspections: listAllInspectionsMock,
  listCorrections: listCorrectionsMock,
  createCorrection: createCorrectionMock,
  updateCorrectionComplete: updateCorrectionCompleteMock,
  deleteCorrection: deleteCorrectionMock,
  isInspectionType: (v: string) => ["rough_in", "cover", "final", "other"].includes(v),
  isInspectionBookedBy: (v: string) => ["office", "gc_or_super", "customer"].includes(v),
  isInspectionResult: (v: string) =>
    ["scheduled", "passed", "failed", "partial", "rescheduled_by_city"].includes(v),
}));

const {
  createJobInspection,
  updateJobInspection,
  listJobInspections,
  listAllInspections,
  addCorrection,
  toggleCorrectionComplete,
  removeCorrection,
  listInspectionCorrections,
  canEditInspections,
} = await import("@/services/jobInspections");

const JOB_ID = "job-001";

function makeInspection(overrides: Partial<{
  id: string;
  result: string;
  parentInspectionId: string | null;
  rescheduledDate: string | null;
}> = {}) {
  return {
    id: overrides.id ?? "insp-001",
    orgId: "org-001",
    jobId: JOB_ID,
    permitId: null,
    inspectionType: "rough_in",
    scheduledDate: "2026-11-10",
    scheduledWindow: "AM",
    bookedBy: "office",
    inspectorName: null,
    result: overrides.result ?? "scheduled",
    resultDate: null,
    rescheduledDate: overrides.rescheduledDate ?? null,
    parentInspectionId: overrides.parentInspectionId ?? null,
    notes: null,
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-01T10:00:00Z",
  };
}

function makeCorrection(overrides: Partial<{
  id: string;
  isComplete: boolean;
  completedAt: string | null;
}> = {}) {
  return {
    id: overrides.id ?? "corr-001",
    orgId: "org-001",
    inspectionId: "insp-001",
    description: "Fix duct sealing",
    isComplete: overrides.isComplete ?? false,
    completedAt: overrides.completedAt ?? null,
    createdAt: "2026-11-10T14:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// CRUD — inspections
// ---------------------------------------------------------------------------

describe("listJobInspections", () => {
  it("returns inspections from the repository", async () => {
    const inspections = [makeInspection()];
    listJobInspectionsMock.mockResolvedValue(inspections);

    const result = await listJobInspections(JOB_ID);
    expect(result).toEqual(inspections);
    expect(listJobInspectionsMock).toHaveBeenCalledWith(JOB_ID);
  });
});

describe("createJobInspection", () => {
  it("creates an inspection with valid input", async () => {
    const insp = makeInspection();
    createInspectionMock.mockResolvedValue(insp);

    const result = await createJobInspection({
      jobId: JOB_ID,
      inspectionType: "rough_in",
      bookedBy: "office",
    });

    expect(result).toEqual(insp);
  });

  it("rejects invalid inspection type", async () => {
    await expect(
      createJobInspection({
        jobId: JOB_ID,
        inspectionType: "bogus" as never,
        bookedBy: "office",
      }),
    ).rejects.toThrow("Invalid inspection type");
  });

  it("rejects invalid booked_by", async () => {
    await expect(
      createJobInspection({
        jobId: JOB_ID,
        inspectionType: "rough_in",
        bookedBy: "nobody" as never,
      }),
    ).rejects.toThrow("Invalid booked_by");
  });
});

describe("updateJobInspection", () => {
  it("updates inspection result", async () => {
    const updated = makeInspection({ result: "passed" });
    updateInspectionMock.mockResolvedValue(updated);

    const result = await updateJobInspection("insp-001", { result: "passed" });
    expect(result.result).toBe("passed");
  });

  it("rejects invalid result", async () => {
    await expect(
      updateJobInspection("insp-001", { result: "bogus" as never }),
    ).rejects.toThrow("Invalid inspection result");
  });
});

// ---------------------------------------------------------------------------
// Re-inspection linking
// ---------------------------------------------------------------------------

describe("re-inspection linking", () => {
  it("creates a re-inspection linked to the parent", async () => {
    const reInspection = makeInspection({
      id: "insp-002",
      parentInspectionId: "insp-001",
    });
    createInspectionMock.mockResolvedValue(reInspection);

    const result = await createJobInspection({
      jobId: JOB_ID,
      inspectionType: "rough_in",
      bookedBy: "office",
      parentInspectionId: "insp-001",
    });

    expect(result.parentInspectionId).toBe("insp-001");
  });
});

// ---------------------------------------------------------------------------
// Rescheduled by city
// ---------------------------------------------------------------------------

describe("rescheduled_by_city result", () => {
  it("records rescheduled_by_city with new date", async () => {
    const rescheduled = makeInspection({
      result: "rescheduled_by_city",
      rescheduledDate: "2026-11-15",
    });
    updateInspectionMock.mockResolvedValue(rescheduled);

    const result = await updateJobInspection("insp-001", {
      result: "rescheduled_by_city",
      rescheduledDate: "2026-11-15",
    });

    expect(result.result).toBe("rescheduled_by_city");
    expect(result.rescheduledDate).toBe("2026-11-15");
  });
});

// ---------------------------------------------------------------------------
// Corrections lifecycle
// ---------------------------------------------------------------------------

describe("corrections", () => {
  it("lists corrections for an inspection", async () => {
    const corrections = [makeCorrection()];
    listCorrectionsMock.mockResolvedValue(corrections);

    const result = await listInspectionCorrections("insp-001");
    expect(result).toEqual(corrections);
  });

  it("adds a correction", async () => {
    const correction = makeCorrection();
    createCorrectionMock.mockResolvedValue(correction);

    const result = await addCorrection("insp-001", "Fix duct sealing");
    expect(result.description).toBe("Fix duct sealing");
  });

  it("rejects empty correction description", async () => {
    await expect(addCorrection("insp-001", "  ")).rejects.toThrow(
      "Correction description is required.",
    );
  });

  it("toggles correction complete", async () => {
    const completed = makeCorrection({
      isComplete: true,
      completedAt: "2026-11-11T10:00:00Z",
    });
    updateCorrectionCompleteMock.mockResolvedValue(completed);

    const result = await toggleCorrectionComplete("corr-001", true);
    expect(result.isComplete).toBe(true);
    expect(result.completedAt).toBeTruthy();
  });

  it("removes a correction", async () => {
    deleteCorrectionMock.mockResolvedValue(undefined);

    await removeCorrection("corr-001");
    expect(deleteCorrectionMock).toHaveBeenCalledWith("corr-001");
  });
});

// ---------------------------------------------------------------------------
// Role gating
// ---------------------------------------------------------------------------

describe("canEditInspections", () => {
  it.each(["owner", "manager", "office"])("allows %s to edit", (role) => {
    expect(canEditInspections(role)).toBe(true);
  });

  it.each(["tech", "dispatch", "sales", "portal"])("denies %s from editing", (role) => {
    expect(canEditInspections(role)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Office views
// ---------------------------------------------------------------------------

describe("listAllInspections", () => {
  it("returns all inspections", async () => {
    const all = [makeInspection()];
    listAllInspectionsMock.mockResolvedValue(all);

    const result = await listAllInspections();
    expect(result).toEqual(all);
  });
});
