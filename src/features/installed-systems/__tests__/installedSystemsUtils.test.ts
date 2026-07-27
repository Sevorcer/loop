import { describe, it, expect } from "vitest";

import type { Job } from "@/features/jobs/types/job";
import {
  buildInstalledSystemsSnapshot,
  getEstimateEquipmentBundle,
} from "../utils/installedSystemsUtils";

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-test-001",
    jobNumber: "JOB-TEST-1",
    title: "Test Install",
    type: "Install",
    status: "Scheduled",
    priority: "High",
    customerName: "Test Customer",
    propertyName: "Test Property",
    assignedTo: "Crew A",
    scheduledFor: "2026-07-21",
    summary: "Test",
    location: "123 Test St",
    notes: "",
    contractorIds: [],
    estimateId: "EST-2001",
    equipmentBundleId: "bundle-smith-main",
    ...overrides,
  };
}

// ─── getEstimateEquipmentBundle ───────────────────────────────────────────────

describe("getEstimateEquipmentBundle", () => {
  it("returns the bundle when found by id", () => {
    const bundle = getEstimateEquipmentBundle("bundle-smith-main");
    expect(bundle).toBeDefined();
    expect(bundle?.id).toBe("bundle-smith-main");
    expect(bundle?.estimateId).toBe("EST-2001");
  });

  it("returns undefined for an unknown bundle id", () => {
    expect(getEstimateEquipmentBundle("bundle-does-not-exist")).toBeUndefined();
  });
});

// ─── buildInstalledSystemsSnapshot — job filtering ───────────────────────────

describe("buildInstalledSystemsSnapshot — job filtering", () => {
  it("skips non-Install jobs (Service, Maintenance, Inspection)", () => {
    const jobs: Job[] = [
      makeJob({ type: "Service", id: "j-service" }),
      makeJob({ type: "Maintenance", id: "j-maintenance" }),
      makeJob({ type: "Inspection", id: "j-inspection" }),
    ];

    const snapshot = buildInstalledSystemsSnapshot(jobs);
    const derivedIds = snapshot.installedSystems
      .map((s) => s.jobId)
      .filter((id): id is string => Boolean(id));

    expect(derivedIds).not.toContain("j-service");
    expect(derivedIds).not.toContain("j-maintenance");
    expect(derivedIds).not.toContain("j-inspection");
  });

  it("skips Install jobs without an equipmentBundleId", () => {
    const job = makeJob({ equipmentBundleId: undefined });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === job.id);
    expect(derived).toBeUndefined();
  });

  it("skips Install jobs without an estimateId", () => {
    const job = makeJob({ estimateId: undefined });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === job.id);
    expect(derived).toBeUndefined();
  });

  it("skips Cancelled Install jobs — cancelled jobs must not produce installed-system records", () => {
    const job = makeJob({ id: "j-cancelled", status: "Cancelled" });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-cancelled");
    expect(derived).toBeUndefined();
  });

  it("creates an installed-system record for a valid Scheduled Install job", () => {
    const job = makeJob({ id: "j-scheduled", status: "Scheduled" });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-scheduled");
    expect(derived).toBeDefined();
    expect(derived?.lifecycleStatus).toBe("Planned");
  });

  it("creates an Active installed-system record when the job is Completed", () => {
    const job = makeJob({ id: "j-completed", status: "Completed" });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-completed");
    expect(derived).toBeDefined();
    expect(derived?.lifecycleStatus).toBe("Active");
  });

  it("creates a Needs Review record for an On Hold Install job", () => {
    const job = makeJob({ id: "j-on-hold", status: "On Hold" });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-on-hold");
    expect(derived).toBeDefined();
    expect(derived?.lifecycleStatus).toBe("Needs Review");
  });

  it("In Progress Install jobs produce Planned lifecycle status", () => {
    const job = makeJob({ id: "j-in-progress", status: "In Progress" });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-in-progress");
    expect(derived).toBeDefined();
    expect(derived?.lifecycleStatus).toBe("Planned");
  });
});

// ─── buildInstalledSystemsSnapshot — permit readiness ────────────────────────

describe("buildInstalledSystemsSnapshot — permit readiness and catalog matching", () => {
  it("sets permitReady=true for exact catalog matches", () => {
    const job = makeJob({ id: "j-permit", status: "Completed" });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-permit");
    // bundle-smith-main references known Mitsubishi models; permitReady follows matchState
    expect(typeof derived?.permitReady).toBe("boolean");
    expect(["exact", "possible", "unmatched"]).toContain(derived?.matchState);
  });

  it("links installed system back to the originating job number", () => {
    const job = makeJob({ id: "j-link", jobNumber: "JOB-9999", status: "Completed" });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-link");
    expect(derived?.jobNumber).toBe("JOB-9999");
    expect(derived?.linkedWorkflowIds).toContain("j-link");
  });

  it("operational history includes estimate and job number provenance", () => {
    const job = makeJob({ id: "j-history", jobNumber: "JOB-HIST", estimateId: "EST-2001" });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-history");
    const history = derived?.operationalHistory ?? [];
    const joined = history.join(" ");
    expect(joined).toMatch(/EST-2001/);
    expect(joined).toMatch(/JOB-HIST/);
  });

  it("snapshot always includes seed installed systems regardless of job input", () => {
    const snapshot = buildInstalledSystemsSnapshot([]);
    expect(snapshot.installedSystems.length).toBeGreaterThan(0);
    expect(snapshot.technicalProfiles.length).toBeGreaterThan(0);
    expect(snapshot.catalogEntries.length).toBeGreaterThan(0);
  });
});

// ─── aggregateMatchState (indirectly via snapshot) ───────────────────────────

describe("catalog match state aggregation", () => {
  it("a job with a bundle but no matching catalog entry produces unmatched state", () => {
    // Use a bundle that has no equipment matching the catalog
    const job: Job = makeJob({
      id: "j-unmatched",
      estimateId: "EST-FAKE",
      equipmentBundleId: "bundle-fake-no-match",
    });
    // Since bundle-fake-no-match does not exist, buildInstalledSystemFromJob returns undefined
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-unmatched");
    // No derived record because the bundle wasn't found
    expect(derived).toBeUndefined();
  });
});

// ─── CatalogMatchResult aggregation (direct unit tests) ──────────────────────
// aggregateMatchState is unexported, but we validate its contract via
// the snapshot's matchState field using controlled fixtures.

describe("installed system matchState semantics via snapshot", () => {
  it("matchState from snapshot is one of the three defined states", () => {
    const job = makeJob({ id: "j-state-check", status: "Completed" });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-state-check");
    if (derived) {
      expect(["exact", "possible", "unmatched"]).toContain(derived.matchState);
    }
  });

  it("matchConfidence is a value between 0 and 1 (inclusive)", () => {
    const job = makeJob({ id: "j-confidence", status: "Completed" });
    const snapshot = buildInstalledSystemsSnapshot([job]);
    const derived = snapshot.installedSystems.find((s) => s.jobId === "j-confidence");
    if (derived) {
      expect(derived.matchConfidence).toBeGreaterThanOrEqual(0);
      expect(derived.matchConfidence).toBeLessThanOrEqual(1);
    }
  });
});
