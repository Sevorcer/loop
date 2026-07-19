import { describe, it, expect } from "vitest";

import type { Job } from "../types/job";
import {
  validateAssignment,
  applyAssignment,
  removeAssignment,
} from "../utils/assignmentUtils";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseJob: Job = {
  id: "job-001",
  jobNumber: "JOB-1001",
  title: "Test Job",
  type: "Install",
  status: "Scheduled",
  priority: "High",
  customerName: "Test Customer",
  propertyName: "Test Property",
  assignedTo: "Marcus Rivera",
  scheduledFor: "2026-07-21",
  summary: "Test summary",
  location: "123 Test St",
  notes: "",
  contractorIds: [],
};

// ─── validateAssignment ───────────────────────────────────────────────────────

describe("validateAssignment", () => {
  it("returns valid for a fresh assignment", () => {
    const result = validateAssignment(baseJob, "contractor-001");
    expect(result.valid).toBe(true);
  });

  it("returns error when contractorId is empty", () => {
    const result = validateAssignment(baseJob, "");
    expect(result.valid).toBe(false);
    expect("error" in result && result.error).toMatch(/required/i);
  });

  it("returns duplicate error when contractor is already assigned", () => {
    const jobWithContractor: Job = {
      ...baseJob,
      contractorIds: ["contractor-001"],
    };
    const result = validateAssignment(jobWithContractor, "contractor-001");
    expect(result.valid).toBe(false);
    expect("error" in result && result.error).toMatch(/already assigned/i);
  });

  it("allows assigning a different contractor when one is already assigned", () => {
    const jobWithContractor: Job = {
      ...baseJob,
      contractorIds: ["contractor-001"],
    };
    const result = validateAssignment(jobWithContractor, "contractor-002");
    expect(result.valid).toBe(true);
  });

  it("handles job with undefined contractorIds gracefully", () => {
    const jobNoIds: Job = { ...baseJob, contractorIds: undefined };
    const result = validateAssignment(jobNoIds, "contractor-001");
    expect(result.valid).toBe(true);
  });
});

// ─── applyAssignment ──────────────────────────────────────────────────────────

describe("applyAssignment", () => {
  it("adds contractorId to an empty list", () => {
    const updated = applyAssignment(baseJob, "contractor-001");
    expect(updated.contractorIds).toEqual(["contractor-001"]);
  });

  it("appends to an existing list", () => {
    const job: Job = { ...baseJob, contractorIds: ["contractor-001"] };
    const updated = applyAssignment(job, "contractor-002");
    expect(updated.contractorIds).toEqual(["contractor-001", "contractor-002"]);
  });

  it("does not mutate the original job", () => {
    applyAssignment(baseJob, "contractor-001");
    expect(baseJob.contractorIds).toEqual([]);
  });
});

// ─── removeAssignment ─────────────────────────────────────────────────────────

describe("removeAssignment", () => {
  it("removes the specified contractor", () => {
    const job: Job = {
      ...baseJob,
      contractorIds: ["contractor-001", "contractor-002"],
    };
    const updated = removeAssignment(job, "contractor-001");
    expect(updated.contractorIds).toEqual(["contractor-002"]);
  });

  it("is a no-op if the contractor is not assigned", () => {
    const job: Job = { ...baseJob, contractorIds: ["contractor-001"] };
    const updated = removeAssignment(job, "contractor-999");
    expect(updated.contractorIds).toEqual(["contractor-001"]);
  });

  it("handles undefined contractorIds gracefully", () => {
    const job: Job = { ...baseJob, contractorIds: undefined };
    const updated = removeAssignment(job, "contractor-001");
    expect(updated.contractorIds).toEqual([]);
  });
});
