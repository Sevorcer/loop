import { describe, expect, it } from "vitest";

import type { DispatchPlan, DispatchSnapshot } from "../types/dispatch";
import { applyPrepReadiness } from "../utils/prepReadiness";

const red = { state: "not_satisfied" as const, reason: "" };
const green = { state: "satisfied" as const, reason: "" };

function plan(id: string, jobId: string): DispatchPlan {
  return {
    id,
    jobId,
    jobNumber: id,
    customerName: "",
    propertyName: "",
    jobType: "Install",
    dispatchStatus: "scheduled",
    dispatchability: {
      isDispatchable: false,
      materialReadiness: red,
      technicalReadiness: red,
      customerReadiness: green,
      crewReadiness: green,
    },
    targetDate: "2026-11-05",
    estimatedDurationHours: 4,
    priority: "normal",
    constraints: [],
    createdAt: "",
    updatedAt: "",
  } as unknown as DispatchPlan;
}

function snapshot(plans: DispatchPlan[]): DispatchSnapshot {
  return { dispatchPlans: plans } as unknown as DispatchSnapshot;
}

describe("applyPrepReadiness", () => {
  it("replaces the never-written chips with real data and recomputes dispatchability", () => {
    const result = applyPrepReadiness(snapshot([plan("p1", "j1"), plan("p2", "j2"), plan("p3", "j3")]), {
      materialSummaries: {
        j1: { total: 2, needed: 0, onTruck: 2, used: 0 },
        j2: { total: 0, needed: 0, onTruck: 0, used: 0 },
        j3: { total: 3, needed: 1, onTruck: 2, used: 0 },
      },
      jobPropertyIds: { j1: "prop-1", j2: "prop-2", j3: null },
      systemCounts: { "prop-1": { systems: 2, withProfile: 1 }, "prop-2": { systems: 0, withProfile: 0 } },
    });
    const [p1, p2, p3] = result.dispatchPlans;
    expect(p1.dispatchability.materialReadiness.state).toBe("satisfied");
    expect(p1.dispatchability.technicalReadiness.state).toBe("satisfied");
    expect(p1.dispatchability.isDispatchable).toBe(true);
    expect(p2.dispatchability.materialReadiness.state).toBe("attention_needed");
    expect(p2.dispatchability.technicalReadiness.reason).toBe("No equipment on file");
    expect(p3.dispatchability.materialReadiness.state).toBe("not_satisfied");
    expect(p3.dispatchability.technicalReadiness.state).toBe("attention_needed");
    expect(p3.dispatchStatus).toBe("scheduled");
  });

  it("leaves chips alone when a source is unavailable", () => {
    const result = applyPrepReadiness(snapshot([plan("p1", "j1")]), {
      materialSummaries: {},
      jobPropertyIds: {},
      systemCounts: {},
    });
    expect(result.dispatchPlans[0].dispatchability.materialReadiness).toBe(red);
    expect(result.dispatchPlans[0].dispatchability.technicalReadiness).toBe(red);
  });
});
