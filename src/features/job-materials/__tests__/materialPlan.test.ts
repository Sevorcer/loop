import { describe, expect, it } from "vitest";

import type { JobMaterialLine } from "../types/jobMaterials";
import type { KitSnapshot, MaterialLineEvent, SourceLineItem } from "../types/materialPlan";
import {
  MaterialPlanValidationError,
  adjustmentNeedsReason,
  buildCatalogMatchIndex,
  buildPlanCandidates,
  canConfirmMaterialPlan,
  canEditMaterialPlan,
  canResolveNeedsSku,
  countNeedsSku,
  describeMaterialEvent,
  isNeedsSku,
  matchCatalogItem,
  normalizeMaterialText,
  parseAdjustmentPatch,
  parseKitRequests,
  parseMultiplier,
  parseReason,
  planOriginFor,
  requireReasonFor,
  toGenerateRpcLines,
  toRefreshRpcLines,
} from "../utils/materialPlan";

const LINESET = { id: "i-lineset", name: "Copper line set 3/8 x 3/4", sku: "LS-38-34", unit: "ea" };
const PAD = { id: "i-pad", name: "Condenser pad", sku: null, unit: "ea" };
const TAPE = { id: "i-tape", name: "Electrical tape", sku: "TAPE-1", unit: "roll" };

const index = buildCatalogMatchIndex(
  [LINESET, PAD, TAPE],
  [{ alias: normalizeMaterialText("  Line Set   (Copper) "), catalogItemId: LINESET.id }],
);

function source(over: Partial<SourceLineItem> & { id: string; name: string }): SourceLineItem {
  return { table: "estimate", kind: "product", qty: 1, sortOrder: 0, ...over };
}

function kit(over: Partial<KitSnapshot> = {}): KitSnapshot {
  return {
    kitId: "kit-1",
    version: 2,
    multiplier: 1,
    lines: [
      { catalogItemId: PAD.id, name: PAD.name, unit: "ea", quantity: 1, isOptional: false },
      { catalogItemId: TAPE.id, name: TAPE.name, unit: "roll", quantity: 3, isOptional: true },
    ],
    ...over,
  };
}

describe("normalizeMaterialText", () => {
  it("lowercases, trims and collapses whitespace like the database CHECK", () => {
    expect(normalizeMaterialText("  Line   Set\t(Copper) ")).toBe("line set (copper)");
    expect(normalizeMaterialText("   ")).toBe("");
  });
});

describe("matchCatalogItem", () => {
  it("matches an alias first, then SKU, then exact name", () => {
    expect(matchCatalogItem("line set (copper)", index)).toMatchObject({ via: "alias", item: { id: LINESET.id } });
    expect(matchCatalogItem("tape-1", index)).toMatchObject({ via: "sku", item: { id: TAPE.id } });
    expect(matchCatalogItem("CONDENSER   PAD", index)).toMatchObject({ via: "name", item: { id: PAD.id } });
  });

  it("does not guess: partial text and blank text are unmatched", () => {
    expect(matchCatalogItem("copper line set", index)).toBeNull();
    expect(matchCatalogItem("   ", index)).toBeNull();
  });

  it("leaves duplicate catalog names for a human", () => {
    const dup = buildCatalogMatchIndex(
      [
        { id: "a", name: "Wire nuts", sku: null, unit: "bag" },
        { id: "b", name: "wire nuts", sku: null, unit: "bag" },
      ],
      [],
    );
    expect(matchCatalogItem("Wire nuts", dup)).toBeNull();
  });

  it("ignores aliases that point at items that are not in the index", () => {
    const stale = buildCatalogMatchIndex([PAD], [{ alias: "mystery", catalogItemId: "gone" }]);
    expect(matchCatalogItem("mystery", stale)).toBeNull();
  });
});

describe("buildPlanCandidates", () => {
  it("turns product lines into candidates and counts services as not materials", () => {
    const result = buildPlanCandidates({
      sourceLines: [
        source({ id: "e1", name: "Condenser pad", qty: 1, sortOrder: 2 }),
        source({ id: "e2", name: "Install labor", kind: "service", sortOrder: 1 }),
        source({ id: "e3", name: "Misc flare fittings", qty: 4, sortOrder: 3 }),
        source({ id: "e4", name: "Permit fee", kind: "other_charge", sortOrder: 4 }),
      ],
      kits: [],
      index,
    });
    expect(result.nonProductSkipped).toBe(2);
    expect(result.candidates.map((c) => c.name)).toEqual(["Condenser pad", "Misc flare fittings"]);
    const [pad, flare] = result.candidates;
    expect(pad).toMatchObject({ catalogItemId: PAD.id, source: "estimate", estimateLineItemId: "e1", jobLineItemId: null });
    expect(flare).toMatchObject({ catalogItemId: null, unit: "ea", quantity: 4 });
  });

  it("records job line item ids separately from estimate line item ids", () => {
    const { candidates } = buildPlanCandidates({
      sourceLines: [source({ id: "j1", name: "Condenser pad", table: "job" })],
      kits: [],
      index,
    });
    expect(candidates[0]).toMatchObject({ jobLineItemId: "j1", estimateLineItemId: null });
  });

  it("drops unusable quantities and blank names but reports them", () => {
    const result = buildPlanCandidates({
      sourceLines: [
        source({ id: "a", name: "Condenser pad", qty: 0 }),
        source({ id: "b", name: "  ", qty: 2 }),
        source({ id: "c", name: "Condenser pad", qty: Number.NaN }),
        source({ id: "d", name: "Tape thing", qty: 1_000_000 }),
      ],
      kits: [],
      index,
    });
    expect(result.candidates).toEqual([]);
    expect(result.invalidSkipped).toBe(4);
  });

  it("rounds quantities to three decimals", () => {
    const { candidates } = buildPlanCandidates({
      sourceLines: [source({ id: "a", name: "Refrigerant mystery", qty: 1.23456 })],
      kits: [],
      index,
    });
    expect(candidates[0].quantity).toBe(1.235);
  });

  it("adds a kit's lines scaled by its multiplier", () => {
    const { candidates } = buildPlanCandidates({ sourceLines: [], kits: [kit({ multiplier: 2 })], index });
    expect(candidates).toHaveLength(2);
    expect(candidates[1]).toMatchObject({
      catalogItemId: TAPE.id, quantity: 6, kitQuantity: 6, source: "kit", kitId: "kit-1", kitVersion: 2, isOptional: true,
    });
  });

  it("merges the same item from estimate and kit into one line; estimate quantity wins (D7)", () => {
    const { candidates } = buildPlanCandidates({
      sourceLines: [source({ id: "e1", name: "Condenser pad", qty: 2 })],
      kits: [kit()],
      index,
    });
    const pads = candidates.filter((c) => c.catalogItemId === PAD.id);
    expect(pads).toHaveLength(1);
    expect(pads[0]).toMatchObject({ source: "estimate", quantity: 2, kitQuantity: 1, kitId: "kit-1", kitVersion: 2 });
    expect(candidates.find((c) => c.catalogItemId === TAPE.id)).toMatchObject({ source: "kit", quantity: 3 });
  });

  it("adds up two estimate lines that resolve to the same catalog item", () => {
    const { candidates } = buildPlanCandidates({
      sourceLines: [
        source({ id: "e1", name: "Condenser pad", qty: 1, sortOrder: 1 }),
        source({ id: "e2", name: "condenser PAD", qty: 2, sortOrder: 2 }),
      ],
      kits: [],
      index,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ quantity: 3, estimateLineItemId: "e1" });
  });

  it("adds up the same item across two kits", () => {
    const { candidates } = buildPlanCandidates({
      sourceLines: [],
      kits: [kit(), kit({ kitId: "kit-2", version: 1 })],
      index,
    });
    expect(candidates).toHaveLength(2);
    expect(candidates.find((c) => c.catalogItemId === PAD.id)).toMatchObject({ quantity: 2, kitQuantity: 2, kitId: "kit-1" });
  });

  it("keeps unmatched estimate lines as separate free-text lines (never merged or dropped)", () => {
    const { candidates } = buildPlanCandidates({
      sourceLines: [
        source({ id: "e1", name: "Mystery widget", qty: 1 }),
        source({ id: "e2", name: "Mystery widget", qty: 1 }),
      ],
      kits: [],
      index,
    });
    expect(candidates).toHaveLength(2);
    expect(candidates.every((c) => c.catalogItemId === null)).toBe(true);
  });
});

describe("planOriginFor / RPC shaping", () => {
  it("names where a generation run came from", () => {
    const { candidates: both } = buildPlanCandidates({
      sourceLines: [source({ id: "e1", name: "Mystery" })],
      kits: [kit()],
      index,
    });
    expect(planOriginFor(both)).toBe("mixed");
    expect(planOriginFor(both.filter((c) => c.source === "estimate"))).toBe("estimate");
    expect(planOriginFor(both.filter((c) => c.source === "kit"))).toBe("kit");
    expect(planOriginFor([])).toBe("manual");
  });

  it("sends snake_case lines to generate_material_plan", () => {
    const { candidates } = buildPlanCandidates({
      sourceLines: [source({ id: "e1", name: "Condenser pad", qty: 2 })],
      kits: [],
      index,
    });
    expect(toGenerateRpcLines(candidates)[0]).toEqual({
      name: "Condenser pad",
      quantity: 2,
      unit: "ea",
      catalog_item_id: PAD.id,
      part_number: null,
      source: "estimate",
      job_line_item_id: null,
      estimate_line_item_id: "e1",
      kit_id: null,
      kit_version: null,
      kit_quantity: null,
      is_optional: false,
    });
  });

  it("scales a kit for refresh and drops lines that scale to nothing usable", () => {
    const rpc = toRefreshRpcLines(kit({ multiplier: 2 }));
    expect(rpc).toEqual([
      { catalog_item_id: PAD.id, name: PAD.name, unit: "ea", quantity: 2, is_optional: false },
      { catalog_item_id: TAPE.id, name: TAPE.name, unit: "roll", quantity: 6, is_optional: true },
    ]);
    expect(toRefreshRpcLines(kit({ multiplier: 1_000_000 }))).toEqual([]);
  });
});

describe("needs SKU", () => {
  const base = { planId: "p1", catalogItemId: null, nonStockReason: null } as const;
  it("is a plan line with no catalog item and no not-stock decision", () => {
    expect(isNeedsSku(base)).toBe(true);
    expect(isNeedsSku({ ...base, catalogItemId: "i1" })).toBe(false);
    expect(isNeedsSku({ ...base, nonStockReason: "Bought on site" })).toBe(false);
    expect(isNeedsSku({ ...base, planId: null })).toBe(false);
  });

  it("counts them", () => {
    const lines = [base, { ...base, catalogItemId: "i1" }, base] as unknown as JobMaterialLine[];
    expect(countNeedsSku(lines)).toBe(2);
  });
});

describe("adjustments", () => {
  it("requires a reason for quantity, name and unit changes only", () => {
    expect(adjustmentNeedsReason({ quantity: 3 })).toBe(true);
    expect(adjustmentNeedsReason({ name: "x" })).toBe(true);
    expect(adjustmentNeedsReason({ unit: "ft" })).toBe(true);
    expect(adjustmentNeedsReason({ notes: "x" })).toBe(false);
    expect(adjustmentNeedsReason({ isOptional: true })).toBe(false);
  });

  it("rejects a missing or tiny reason when one is required", () => {
    expect(() => requireReasonFor({ quantity: 3 }, null)).toThrow(MaterialPlanValidationError);
    expect(() => requireReasonFor({ quantity: 3 }, "x")).toThrow(/why/i);
    expect(requireReasonFor({ quantity: 3 }, "Longer run")).toBe("Longer run");
    expect(requireReasonFor({ notes: "n" }, null)).toBeNull();
  });

  it("normalizes reasons", () => {
    expect(parseReason("  Longer   run ")).toBe("Longer run");
    expect(parseReason("   ")).toBeNull();
    expect(parseReason(undefined)).toBeNull();
    expect(() => parseReason(5)).toThrow(MaterialPlanValidationError);
    expect(() => parseReason("x".repeat(501))).toThrow(/500/);
  });

  it("validates patches", () => {
    expect(parseAdjustmentPatch({ quantity: 2.0004 })).toEqual({ quantity: 2 });
    expect(parseAdjustmentPatch({ name: "  Pad  ", unit: " ft " })).toEqual({ name: "Pad", unit: "ft" });
    expect(() => parseAdjustmentPatch({})).toThrow(/nothing/i);
    expect(() => parseAdjustmentPatch({ quantity: 0 })).toThrow(MaterialPlanValidationError);
    expect(() => parseAdjustmentPatch({ quantity: "3" })).toThrow(MaterialPlanValidationError);
    expect(() => parseAdjustmentPatch({ quantity: 100001 })).toThrow(MaterialPlanValidationError);
    expect(() => parseAdjustmentPatch({ name: "" })).toThrow(MaterialPlanValidationError);
    expect(() => parseAdjustmentPatch({ unit: "x".repeat(21) })).toThrow(MaterialPlanValidationError);
    expect(() => parseAdjustmentPatch({ isOptional: "yes" })).toThrow(MaterialPlanValidationError);
  });
});

describe("roles", () => {
  it("mirrors the RLS role sets", () => {
    for (const role of ["owner", "manager", "dispatch", "office", "sales"]) expect(canEditMaterialPlan(role)).toBe(true);
    for (const role of ["tech", "portal", null, undefined]) expect(canEditMaterialPlan(role)).toBe(false);
    for (const role of ["owner", "manager", "dispatch", "office"]) expect(canConfirmMaterialPlan(role)).toBe(true);
    for (const role of ["sales", "tech", null]) expect(canConfirmMaterialPlan(role)).toBe(false);
    for (const role of ["owner", "manager", "office"]) expect(canResolveNeedsSku(role)).toBe(true);
    for (const role of ["dispatch", "sales", "tech"]) expect(canResolveNeedsSku(role)).toBe(false);
  });
});

describe("describeMaterialEvent", () => {
  const event = (over: Partial<MaterialLineEvent>): MaterialLineEvent => ({
    id: "e", lineId: "l", lineName: "Pad", eventType: "created", origin: "user",
    fromQty: null, toQty: null, reason: null, actorId: null, createdAt: "t", ...over,
  });
  it("words each event for the history drawer", () => {
    expect(describeMaterialEvent(event({ eventType: "created", origin: "generation" }))).toBe("Added by plan generation");
    expect(describeMaterialEvent(event({ eventType: "created" }))).toBe("Added");
    expect(describeMaterialEvent(event({ eventType: "qty_changed", fromQty: 2, toQty: 3 }))).toBe("Quantity 2 → 3");
    expect(describeMaterialEvent(event({ eventType: "sku_linked" }))).toBe("Linked to a catalog item");
    expect(describeMaterialEvent(event({ eventType: "removed" }))).toBe("Removed");
  });
});

describe("kit requests", () => {
  const KIT_A = "11111111-1111-4111-8111-111111111111";
  const KIT_B = "22222222-2222-4222-8222-222222222222";

  it("defaults the multiplier to 1 and rounds to three decimals", () => {
    expect(parseKitRequests([{ kitId: KIT_A }])).toEqual([{ kitId: KIT_A, multiplier: 1 }]);
    expect(parseKitRequests([{ kitId: KIT_A, multiplier: 2.00049 }])[0].multiplier).toBe(2);
    expect(parseMultiplier(undefined)).toBe(1);
  });

  it("treats a missing list as no kits", () => {
    expect(parseKitRequests(undefined)).toEqual([]);
    expect(parseKitRequests(null)).toEqual([]);
  });

  it("rejects bad shapes, duplicates and silly multipliers", () => {
    expect(() => parseKitRequests("kit")).toThrow(MaterialPlanValidationError);
    expect(() => parseKitRequests(["kit"])).toThrow(MaterialPlanValidationError);
    expect(() => parseKitRequests([{ kitId: "nope" }])).toThrow(MaterialPlanValidationError);
    expect(() => parseKitRequests([{ kitId: KIT_A }, { kitId: KIT_A.toUpperCase() }])).toThrow(/once/);
    expect(() => parseKitRequests([{ kitId: KIT_A, multiplier: 0 }])).toThrow(MaterialPlanValidationError);
    expect(() => parseKitRequests([{ kitId: KIT_A, multiplier: 1001 }])).toThrow(MaterialPlanValidationError);
    expect(() => parseKitRequests([{ kitId: KIT_A, multiplier: "2" }])).toThrow(MaterialPlanValidationError);
    expect(() => parseKitRequests(Array.from({ length: 11 }, (_, i) => ({ kitId: `${i}`.padStart(8, "0") + KIT_B.slice(8) })))).toThrow(/at most 10/);
    expect(parseKitRequests([{ kitId: KIT_A }, { kitId: KIT_B, multiplier: 3 }])).toHaveLength(2);
  });
});
