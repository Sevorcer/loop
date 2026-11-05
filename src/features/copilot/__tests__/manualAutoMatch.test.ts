import { describe, expect, it } from "vitest";

import type { ManualMatch } from "@/features/manuals/types/manuals";

import { autoLinkThreshold, planManualAutoMatch } from "../manualAutoMatch";

const match = (manualId: string, kind: ManualMatch["kind"], confidence: number): ManualMatch => ({
  manualId, kind, confidence, level: confidence >= 0.9 ? "high" : confidence >= 0.6 ? "medium" : "low", reason: `reason ${manualId}`,
});

describe("Copilot manual auto-match plan", () => {
  it("auto-links exact model matches at/above the threshold with a reason", () => {
    const plan = planManualAutoMatch([match("a", "model_exact", 0.97), match("b", "model_family", 0.75), match("c", "manufacturer", 0.4)], {
      manualName: (id) => (id === "a" ? "MSZ-GL09NA_Installation_Manual.pdf" : undefined),
    });
    expect(plan.items).toEqual([
      { manual_id: "a", status: "auto_linked", match_kind: "model_exact", confidence: 0.97, reason: "reason a" },
      { manual_id: "b", status: "suggested", match_kind: "model_family", confidence: 0.75, reason: "reason b" },
    ]);
    expect(plan.summary).toMatchObject({ action: "linked", manualId: "a" });
    expect(plan.summary.reason).toContain("MSZ-GL09NA_Installation_Manual.pdf automatically (97%)");
  });

  it("suggests when the best model match is under the threshold", () => {
    const plan = planManualAutoMatch([match("b", "model_family", 0.75)]);
    expect(plan.summary).toMatchObject({ action: "suggested", manualId: "b" });
    expect(plan.summary.reason).toContain("for office review");
  });

  it("never stores brand-only guides and explains why nothing was linked", () => {
    const plan = planManualAutoMatch([match("c", "manufacturer", 0.45), match("d", "manufacturer", 0.4)]);
    expect(plan.items).toEqual([]);
    expect(plan.summary).toMatchObject({ action: "none" });
    expect(plan.summary.reason).toContain("2 brand guides");
    expect(planManualAutoMatch([]).summary.reason).toContain("No manual in Drive matches");
  });

  it("a stricter threshold turns auto-links into suggestions; it can never go below 0.90", () => {
    expect(planManualAutoMatch([match("a", "model_exact", 0.97)], { threshold: 0.99 }).items[0].status).toBe("suggested");
    expect(planManualAutoMatch([match("b", "model_family", 0.85)], { threshold: 0.5 }).items[0].status).toBe("suggested");
    expect(autoLinkThreshold({})).toBe(0.9);
    expect(autoLinkThreshold({ COPILOT_MANUAL_AUTOLINK_THRESHOLD: "0.5" })).toBe(0.9);
    expect(autoLinkThreshold({ COPILOT_MANUAL_AUTOLINK_THRESHOLD: "0.95" })).toBe(0.95);
    expect(autoLinkThreshold({ COPILOT_MANUAL_AUTOLINK_THRESHOLD: "7" })).toBe(1);
    expect(autoLinkThreshold({ COPILOT_MANUAL_AUTOLINK_THRESHOLD: "abc" })).toBe(0.9);
  });

  it("stores at most 5 per system", () => {
    const many = Array.from({ length: 8 }, (_, i) => match(`m${i}`, "model_family", 0.7 + i * 0.01));
    expect(planManualAutoMatch(many).items).toHaveLength(5);
  });
});
