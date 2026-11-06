import { describe, expect, it } from "vitest";

import { validateMaterialEvent } from "../utils/materialEventRules";

const LINE = "d4000000-0000-4000-8000-000000000001";
const ITEM = "34000000-0000-4000-8000-000000000001";

describe("validateMaterialEvent", () => {
  it("accepts a typed event that points at a line", () => {
    const result = validateMaterialEvent({ eventType: "missing_part", lineId: LINE, qty: "2", note: "  not on the pallet " });
    expect(result).toEqual({
      ok: true,
      value: { eventType: "missing_part", lineId: LINE, itemId: null, qty: 2, note: "not on the pallet" },
    });
  });

  it("accepts Bought on the way with only an item", () => {
    const result = validateMaterialEvent({ eventType: "supply_house_run", itemId: ITEM, qty: 1 });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown type, a bad id, and an event with nothing to point at", () => {
    expect(validateMaterialEvent({ eventType: "oops", lineId: LINE }).ok).toBe(false);
    expect(validateMaterialEvent({ eventType: "wrong_part", lineId: "nope" }).ok).toBe(false);
    expect(validateMaterialEvent({ eventType: "wrong_part" }).ok).toBe(false);
  });

  it("rejects bad quantities and over-long notes", () => {
    expect(validateMaterialEvent({ eventType: "missing_part", lineId: LINE, qty: 0 }).ok).toBe(false);
    expect(validateMaterialEvent({ eventType: "missing_part", lineId: LINE, qty: 1.2345 }).ok).toBe(false);
    expect(validateMaterialEvent({ eventType: "kit_feedback", note: "x".repeat(1001) }).ok).toBe(false);
  });
});
