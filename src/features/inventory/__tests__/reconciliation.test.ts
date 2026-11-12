import { describe, expect, it } from "vitest";

import type { ReconcileLineRow } from "../types/reconciliation";
import {
  canOverrideMaterials,
  defaultInput,
  materialsBlocksCompletion,
  needsReason,
  normalizeOverrideReason,
  residualQty,
  toRpcLines,
  validateReconcileInput,
} from "../utils/reconciliation";

const row = (over: Partial<ReconcileLineRow> = {}): ReconcileLineRow => ({
  lineId: "l1",
  name: "Whip",
  unit: "ea",
  itemId: "i1",
  itemKind: "consumable",
  planned: 3,
  pulled: 3,
  isOptional: false,
  reconciled: false,
  usedQty: null,
  returnedQty: null,
  recoveredQty: null,
  varianceReason: null,
  ...over,
});

describe("residualQty", () => {
  it("is what is left after used and returned", () => {
    expect(residualQty(3, 2, 1)).toBe(0);
    expect(residualQty(3, 1, 0)).toBe(2);
    expect(residualQty(0, 1, 0)).toBe(-1);
    expect(residualQty(0.3, 0.1, 0.2)).toBe(0);
  });
});

describe("defaultInput", () => {
  it("assumes everything pulled was used, or the plan when nothing was pulled", () => {
    expect(defaultInput(row()).used).toBe(3);
    expect(defaultInput(row({ pulled: 0, planned: 4 })).used).toBe(4);
    expect(defaultInput(row({ pulled: 0, planned: 4, isOptional: true })).used).toBe(0);
  });
});

describe("needsReason", () => {
  it("only when a pulled line does not add up", () => {
    expect(needsReason(row(), { lineId: "l1", used: 2, returned: 1, recovered: null, reason: null })).toBe(false);
    expect(needsReason(row(), { lineId: "l1", used: 1, returned: 0, recovered: null, reason: null })).toBe(true);
  });
  it("does not need one for a line used without being pulled (bought on the way)", () => {
    expect(needsReason(row({ pulled: 0 }), { lineId: "l1", used: 2, returned: 0, recovered: null, reason: null })).toBe(false);
  });
});

describe("validateReconcileInput", () => {
  const ok = { lineId: "l1", used: 2, returned: 1, recovered: null, reason: null };

  it("accepts numbers that add up", () => {
    const result = validateReconcileInput([row()], [ok]);
    expect(result.ok).toBe(true);
  });
  it("asks for a reason when they do not", () => {
    const result = validateReconcileInput([row()], [{ ...ok, returned: 0 }]);
    expect(result).toEqual({ ok: false, message: "Say why for Whip: 1 ea left unaccounted for." });
  });
  it("accepts the reason and trims it", () => {
    const result = validateReconcileInput([row()], [{ ...ok, returned: 0, reason: "  Damaged  " }]);
    expect(result.ok && result.value[0].reason).toBe("Damaged");
  });
  it("requires every non-optional line and skips optional ones", () => {
    const rows = [row(), row({ lineId: "l2", name: "Pad" }), row({ lineId: "l3", name: "Extra", isOptional: true })];
    expect(validateReconcileInput(rows, [ok]).ok).toBe(false);
    expect(validateReconcileInput(rows, [ok, { ...ok, lineId: "l2" }]).ok).toBe(true);
  });
  it("rejects negative or non-finite quantities", () => {
    expect(validateReconcileInput([row()], [{ ...ok, used: -1 }]).ok).toBe(false);
    expect(validateReconcileInput([row()], [{ ...ok, used: Number.NaN }]).ok).toBe(false);
  });
  it("ignores lines already reconciled", () => {
    expect(validateReconcileInput([row({ reconciled: true })], []).ok).toBe(false);
    expect(validateReconcileInput([row({ reconciled: true }), row({ lineId: "l2" })], [{ ...ok, lineId: "l2" }]).ok).toBe(true);
  });
});

describe("toRpcLines", () => {
  it("sends only what was entered", () => {
    expect(toRpcLines([{ lineId: "l1", used: 2, returned: 1, recovered: null, reason: null }])).toEqual([
      { line_id: "l1", used: 2, returned: 1 },
    ]);
    expect(toRpcLines([{ lineId: "l1", used: 8, returned: 1, recovered: 0.5, reason: "Left in line set" }])).toEqual([
      { line_id: "l1", used: 8, returned: 1, recovered: 0.5, reason: "Left in line set" },
    ]);
  });
});

describe("cylinders", () => {
  const refrigerant = row({ itemKind: "refrigerant", unit: "lb", planned: 5, pulled: 5 });

  it("sends the cylinder only when one is named", () => {
    expect(
      toRpcLines([{ lineId: "l1", used: 4, returned: 1, recovered: null, reason: null, cylinderUnitId: "u1" }]),
    ).toEqual([{ line_id: "l1", used: 4, returned: 1, cylinder_unit_id: "u1" }]);
    expect(
      toRpcLines([{ lineId: "l1", used: 4, returned: 1, recovered: null, reason: null, cylinderUnitId: null }]),
    ).toEqual([{ line_id: "l1", used: 4, returned: 1 }]);
  });

  it("keeps the cylinder on a refrigerant line", () => {
    const result = validateReconcileInput(
      [refrigerant],
      [{ lineId: "l1", used: 4, returned: 1, recovered: null, reason: null, cylinderUnitId: "u1" }],
    );
    expect(result.ok && result.value[0].cylinderUnitId).toBe("u1");
  });

  it("treats a missing cylinder as none", () => {
    const result = validateReconcileInput(
      [refrigerant],
      [{ lineId: "l1", used: 4, returned: 1, recovered: null, reason: null }],
    );
    expect(result.ok && result.value[0].cylinderUnitId).toBeNull();
  });

  it("refuses a cylinder on a line that is not refrigerant", () => {
    const result = validateReconcileInput(
      [row()],
      [{ lineId: "l1", used: 3, returned: 0, recovered: null, reason: null, cylinderUnitId: "u1" }],
    );
    expect(result).toEqual({ ok: false, message: "Whip is not refrigerant, so it cannot name a cylinder." });
  });
});

describe("staged enforcement", () => {
  const state = (over: Partial<{ required: boolean; reconciled: boolean; enforcement: "warn" | "soft" | "hard" }> = {}) => ({
    required: true,
    reconciled: false,
    enforcement: "warn" as const,
    ...over,
  });

  it("warn never blocks", () => {
    expect(materialsBlocksCompletion(state())).toBe(false);
  });
  it("soft and hard block an unreconciled job that needs it", () => {
    expect(materialsBlocksCompletion(state({ enforcement: "soft" }))).toBe(true);
    expect(materialsBlocksCompletion(state({ enforcement: "hard" }))).toBe(true);
  });
  it("never blocks a job that does not need it or is already reconciled or overridden", () => {
    expect(materialsBlocksCompletion(state({ enforcement: "hard", required: false }))).toBe(false);
    expect(materialsBlocksCompletion(state({ enforcement: "hard", reconciled: true }))).toBe(false);
  });
  it("only office roles can override, and only at soft", () => {
    expect(canOverrideMaterials("soft", "owner")).toBe(true);
    expect(canOverrideMaterials("soft", "manager")).toBe(true);
    expect(canOverrideMaterials("soft", "office")).toBe(true);
    expect(canOverrideMaterials("soft", "tech")).toBe(false);
    expect(canOverrideMaterials("soft", "dispatch")).toBe(false);
    expect(canOverrideMaterials("hard", "owner")).toBe(false);
    expect(canOverrideMaterials("warn", "owner")).toBe(false);
    expect(canOverrideMaterials("soft", undefined)).toBe(false);
  });
});

describe("normalizeOverrideReason", () => {
  it("needs a non-blank reason within the limit", () => {
    expect(normalizeOverrideReason("  Customer cancelled the install  ")).toEqual({ ok: true, reason: "Customer cancelled the install" });
    expect(normalizeOverrideReason("   ").ok).toBe(false);
    expect(normalizeOverrideReason(undefined).ok).toBe(false);
    expect(normalizeOverrideReason("x".repeat(1001)).ok).toBe(false);
  });
});
