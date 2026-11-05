import { describe, expect, it } from "vitest";

import {
  JobMaterialValidationError,
  canManageJobMaterials,
  canUpdateJobMaterialProgress,
  canViewJobMaterials,
  formatMaterialQuantity,
  materialReadinessFromSummary,
  nextJobMaterialState,
  parseJobMaterialCreate,
  parseJobMaterialPatch,
  summarizeJobMaterials,
} from "../utils/jobMaterials";

describe("job materials access", () => {
  it("matches the RLS role split", () => {
    for (const role of ["owner", "manager", "dispatch", "office", "sales"]) {
      expect(canManageJobMaterials(role)).toBe(true);
      expect(canUpdateJobMaterialProgress(role)).toBe(true);
    }
    expect(canManageJobMaterials("tech")).toBe(false);
    expect(canUpdateJobMaterialProgress("tech")).toBe(true);
    expect(canViewJobMaterials("tech")).toBe(true);
    for (const role of ["portal", null, undefined, ""]) {
      expect(canViewJobMaterials(role)).toBe(false);
      expect(canUpdateJobMaterialProgress(role)).toBe(false);
      expect(canManageJobMaterials(role)).toBe(false);
    }
  });
});

describe("parseJobMaterialCreate", () => {
  it("applies defaults and trims", () => {
    expect(parseJobMaterialCreate({ name: "  Line set 3/8 " })).toEqual({
      name: "Line set 3/8",
      quantity: 1,
      unit: "ea",
      partNumber: null,
      notes: "",
      state: "needed",
    });
  });

  it("rounds quantity to the column's 3 decimals", () => {
    expect(parseJobMaterialCreate({ name: "Wire", quantity: 12.34567, unit: "ft" }).quantity).toBe(12.346);
  });

  it.each([
    [{}],
    [{ name: "   " }],
    [{ name: "x".repeat(201) }],
    [{ name: "ok", quantity: -1 }],
    [{ name: "ok", quantity: "abc" }],
    [{ name: "ok", quantity: 100001 }],
    [{ name: "ok", unit: "x".repeat(21) }],
    [{ name: "ok", partNumber: 12 }],
    [{ name: "ok", notes: { a: 1 } }],
    [{ name: "ok", state: "lost" }],
  ])("rejects %j", (body) => {
    expect(() => parseJobMaterialCreate(body as Record<string, unknown>)).toThrow(
      JobMaterialValidationError,
    );
  });
});

describe("parseJobMaterialPatch", () => {
  it("only returns the fields sent", () => {
    expect(parseJobMaterialPatch({ state: "on_truck" })).toEqual({ state: "on_truck" });
    expect(parseJobMaterialPatch({ partNumber: "" })).toEqual({ partNumber: null });
  });

  it("rejects unknown fields and empty patches", () => {
    expect(() => parseJobMaterialPatch({ job_id: "x" })).toThrow(/Unknown field/);
    expect(() => parseJobMaterialPatch({})).toThrow(/Nothing to update/);
  });
});

describe("summary + readiness", () => {
  it("counts states", () => {
    expect(
      summarizeJobMaterials([
        { state: "needed" },
        { state: "on_truck" },
        { state: "on_truck" },
        { state: "used" },
      ]),
    ).toEqual({ total: 4, needed: 1, onTruck: 2, used: 1 });
  });

  it("maps to the Dispatch chip", () => {
    expect(materialReadinessFromSummary({ total: 0, needed: 0, onTruck: 0, used: 0 }).state).toBe(
      "attention_needed",
    );
    expect(materialReadinessFromSummary({ total: 3, needed: 1, onTruck: 2, used: 0 })).toEqual({
      state: "not_satisfied",
      reason: "1 of 3 still needed",
    });
    expect(materialReadinessFromSummary({ total: 2, needed: 0, onTruck: 1, used: 1 }).state).toBe(
      "satisfied",
    );
    expect(materialReadinessFromSummary({ total: 2, needed: 0, onTruck: 0, used: 2 }).reason).toBe(
      "All materials used",
    );
  });

  it("advances and formats", () => {
    expect(nextJobMaterialState("needed")).toBe("on_truck");
    expect(nextJobMaterialState("on_truck")).toBe("used");
    expect(nextJobMaterialState("used")).toBe("used");
    expect(formatMaterialQuantity(2, "ea")).toBe("2 ea");
    expect(formatMaterialQuantity(12.5, "ft")).toBe("12.5 ft");
  });
});
