import { describe, expect, it } from "vitest";

import { isDateOnly, validateArrivalCreate, validateArrivalPatch } from "../utils/arrivalRules";

const ITEM = "31000000-0000-4000-8000-000000000001";
const JOB = "f3000000-0000-4000-8000-000000000001";

describe("arrival validation", () => {
  it("accepts a minimal arrival", () => {
    const result = validateArrivalCreate({ itemId: ITEM, qty: 6, etaDate: "2026-11-10" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        itemId: ITEM,
        locationId: null,
        qty: 6,
        etaDate: "2026-11-10",
        forJobId: null,
        supplierNote: null,
      });
    }
  });

  it("takes a typed quantity, a job and a note", () => {
    const result = validateArrivalCreate({ itemId: ITEM, qty: "2.5", etaDate: "2026-11-10", forJobId: JOB, supplierNote: "  Ferguson  " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.qty).toBe(2.5);
      expect(result.value.forJobId).toBe(JOB);
      expect(result.value.supplierNote).toBe("Ferguson");
    }
  });

  it("rejects bad items, quantities and dates", () => {
    expect(validateArrivalCreate({ itemId: "x", qty: 1, etaDate: "2026-11-10" }).ok).toBe(false);
    expect(validateArrivalCreate({ itemId: ITEM, qty: 0, etaDate: "2026-11-10" }).ok).toBe(false);
    expect(validateArrivalCreate({ itemId: ITEM, qty: 1.0001, etaDate: "2026-11-10" }).ok).toBe(false);
    expect(validateArrivalCreate({ itemId: ITEM, qty: 1, etaDate: "2026-02-30" }).ok).toBe(false);
    expect(validateArrivalCreate({ itemId: ITEM, qty: 1, etaDate: "11/10/2026" }).ok).toBe(false);
    expect(validateArrivalCreate({ itemId: ITEM, qty: 1, etaDate: "2026-11-10", forJobId: "nope" }).ok).toBe(false);
  });

  it("limits the note length", () => {
    expect(validateArrivalCreate({ itemId: ITEM, qty: 1, etaDate: "2026-11-10", supplierNote: "a".repeat(501) }).ok).toBe(false);
  });

  it("validates a patch and refuses an empty one", () => {
    expect(validateArrivalPatch({}).ok).toBe(false);
    const cancel = validateArrivalPatch({ cancel: true });
    expect(cancel.ok).toBe(true);
    const edit = validateArrivalPatch({ qty: 3, etaDate: "2026-11-12", forJobId: null });
    expect(edit.ok).toBe(true);
    if (edit.ok) expect(edit.value).toEqual({ qty: 3, etaDate: "2026-11-12", forJobId: null });
    expect(validateArrivalPatch({ qty: -1 }).ok).toBe(false);
  });

  it("checks real calendar dates", () => {
    expect(isDateOnly("2026-11-05")).toBe(true);
    expect(isDateOnly("2026-13-05")).toBe(false);
    expect(isDateOnly(20261105)).toBe(false);
  });
});
