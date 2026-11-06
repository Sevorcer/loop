import { describe, expect, it } from "vitest";

import {
  KIT_MAX_LINES,
  normalizeKitHeader,
  normalizeKitLines,
  normalizeSettingsPatch,
  sameKitLines,
  validateKitName,
} from "../utils/kitRules";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("validateKitName", () => {
  it("trims and accepts a normal name", () => {
    expect(validateKitName("  Gas furnace swap ")).toEqual({ ok: true, value: "Gas furnace swap" });
  });

  it("rejects blank, non-text and over-long names", () => {
    expect(validateKitName("   ").ok).toBe(false);
    expect(validateKitName(undefined).ok).toBe(false);
    expect(validateKitName("x".repeat(121)).ok).toBe(false);
  });
});

describe("normalizeKitHeader", () => {
  it("only returns keys that were sent", () => {
    expect(normalizeKitHeader({ status: "archived" })).toEqual({ ok: true, value: { status: "archived" } });
  });

  it("turns blank description/category into null so they clear", () => {
    expect(normalizeKitHeader({ description: "  ", category: "" })).toEqual({
      ok: true,
      value: { description: null, category: null },
    });
  });

  it("rejects a bad status and non-text fields", () => {
    expect(normalizeKitHeader({ status: "deleted" }).ok).toBe(false);
    expect(normalizeKitHeader({ description: 5 }).ok).toBe(false);
    expect(normalizeKitHeader({ name: "" }).ok).toBe(false);
  });
});

describe("normalizeKitLines", () => {
  it("accepts a valid list and fills defaults", () => {
    const result = normalizeKitLines([{ catalogItemId: A, quantity: 2 }, { catalogItemId: B, quantity: 0.5, isOptional: true, notes: " n " }]);
    expect(result).toEqual({
      ok: true,
      value: [
        { catalogItemId: A, quantity: 2, isOptional: false, notes: null },
        { catalogItemId: B, quantity: 0.5, isOptional: true, notes: "n" },
      ],
    });
  });

  it("rejects non-lists, bad rows and free-text items", () => {
    expect(normalizeKitLines("nope").ok).toBe(false);
    expect(normalizeKitLines([null]).ok).toBe(false);
    expect(normalizeKitLines([{ name: "Pipe dope", quantity: 1 }]).ok).toBe(false);
    expect(normalizeKitLines([{ catalogItemId: "not-a-uuid", quantity: 1 }]).ok).toBe(false);
  });

  it("rejects zero, negative, huge, non-numeric and over-precise quantities", () => {
    for (const quantity of [0, -1, 1_000_000, "2", Number.NaN, 1.0005]) {
      expect(normalizeKitLines([{ catalogItemId: A, quantity }]).ok).toBe(false);
    }
  });

  it("rejects the same item twice, even with different letter case", () => {
    const result = normalizeKitLines([{ catalogItemId: A, quantity: 1 }, { catalogItemId: A.toUpperCase(), quantity: 2 }]);
    expect(result.ok).toBe(false);
  });

  it("rejects non-boolean optional flags and non-text notes", () => {
    expect(normalizeKitLines([{ catalogItemId: A, quantity: 1, isOptional: "yes" }]).ok).toBe(false);
    expect(normalizeKitLines([{ catalogItemId: A, quantity: 1, notes: 4 }]).ok).toBe(false);
  });

  it("caps the number of lines", () => {
    const many = Array.from({ length: KIT_MAX_LINES + 1 }, (_, i) => ({
      catalogItemId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      quantity: 1,
    }));
    expect(normalizeKitLines(many).ok).toBe(false);
  });

  it("accepts an empty list (a kit with no lines yet)", () => {
    expect(normalizeKitLines([])).toEqual({ ok: true, value: [] });
  });
});

describe("sameKitLines", () => {
  const base = [
    { catalogItemId: A, quantity: 2, isOptional: false, notes: null },
    { catalogItemId: B, quantity: 1, isOptional: true, notes: "x" },
  ];

  it("ignores order", () => {
    expect(sameKitLines(base, [base[1], base[0]])).toBe(true);
  });

  it("detects quantity, optional, notes, add and remove changes", () => {
    expect(sameKitLines(base, [{ ...base[0], quantity: 3 }, base[1]])).toBe(false);
    expect(sameKitLines(base, [base[0], { ...base[1], isOptional: false }])).toBe(false);
    expect(sameKitLines(base, [base[0], { ...base[1], notes: "y" }])).toBe(false);
    expect(sameKitLines(base, [base[0]])).toBe(false);
  });

  it("treats blank notes and null notes as equal", () => {
    expect(sameKitLines([{ catalogItemId: A, quantity: 1, notes: " " }], [{ catalogItemId: A, quantity: 1, notes: null }])).toBe(true);
  });
});

describe("normalizeSettingsPatch", () => {
  it("accepts whole numbers in range", () => {
    expect(normalizeSettingsPatch({ readinessLeadDays: 5, arrivalBufferDays: 0 })).toEqual({
      ok: true,
      value: { readinessLeadDays: 5, arrivalBufferDays: 0 },
    });
  });

  it("rejects out-of-range, fractional and non-numeric values", () => {
    expect(normalizeSettingsPatch({ readinessLeadDays: 31 }).ok).toBe(false);
    expect(normalizeSettingsPatch({ readinessLeadDays: -1 }).ok).toBe(false);
    expect(normalizeSettingsPatch({ arrivalBufferDays: 1.5 }).ok).toBe(false);
    expect(normalizeSettingsPatch({ arrivalBufferDays: "2" }).ok).toBe(false);
  });

  it("refuses to change the closeout enforcement stage in this PR", () => {
    expect(normalizeSettingsPatch({ closeoutEnforcement: "hard" }).ok).toBe(false);
  });

  it("rejects an empty patch", () => {
    expect(normalizeSettingsPatch({}).ok).toBe(false);
  });
});
