import type { JobMaterialLine } from "../types/jobMaterials";
import { isUuid } from "./jobMaterials";
import type {
  CatalogMatchIndex,
  CatalogMatchItem,
  CatalogMatchVia,
  KitSnapshot,
  MaterialLineEvent,
  PlanCandidateLine,
  SourceLineItem,
} from "../types/materialPlan";

// ------------------------------------------------------------------
// Access — mirrors RLS in 20261126100000_material_plans.sql.
// ------------------------------------------------------------------

const PLAN_EDIT_ROLES = new Set(["owner", "manager", "dispatch", "office", "sales"]);
const PLAN_CONFIRM_ROLES = new Set(["owner", "manager", "dispatch", "office"]);
const ALIAS_WRITE_ROLES = new Set(["owner", "manager", "office"]);

/** Generate, attach kits, adjust lines, remove lines. */
export function canEditMaterialPlan(role: string | null | undefined): boolean {
  return PLAN_EDIT_ROLES.has(role ?? "");
}

/** Confirm / reopen a plan. */
export function canConfirmMaterialPlan(role: string | null | undefined): boolean {
  return PLAN_CONFIRM_ROLES.has(role ?? "");
}

/** Link needs-SKU lines (writes an alias) and work the needs-SKU queue. */
export function canResolveNeedsSku(role: string | null | undefined): boolean {
  return ALIAS_WRITE_ROLES.has(role ?? "");
}

// ------------------------------------------------------------------
// Text matching
// ------------------------------------------------------------------

const MAX_NAME = 200;
const MAX_QTY = 100000;

/** Lowercase, trim, collapse whitespace — must equal the DB CHECK on catalog_item_aliases.alias. */
export function normalizeMaterialText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildCatalogMatchIndex(
  items: ReadonlyArray<CatalogMatchItem>,
  aliases: ReadonlyArray<{ alias: string; catalogItemId: string }>,
): CatalogMatchIndex {
  const byName: CatalogMatchIndex["byName"] = new Map();
  const bySku: CatalogMatchIndex["bySku"] = new Map();
  const byAlias: CatalogMatchIndex["byAlias"] = new Map();
  const byId = new Map<string, CatalogMatchItem>();

  for (const item of items) {
    byId.set(item.id, item);
    const nameKey = normalizeMaterialText(item.name);
    if (nameKey) {
      // Two items with the same name: never guess — leave the line for a human.
      byName.set(nameKey, byName.has(nameKey) ? "ambiguous" : item);
    }
    if (item.sku) {
      const skuKey = normalizeMaterialText(item.sku);
      if (skuKey) bySku.set(skuKey, item);
    }
  }
  for (const entry of aliases) {
    const item = byId.get(entry.catalogItemId);
    if (item) byAlias.set(normalizeMaterialText(entry.alias), item);
  }
  return { byName, bySku, byAlias };
}

/** Alias first (a human decided it), then SKU, then exact name. No fuzzy guessing. */
export function matchCatalogItem(
  text: string,
  index: CatalogMatchIndex,
): { item: CatalogMatchItem; via: CatalogMatchVia } | null {
  const key = normalizeMaterialText(text);
  if (!key) return null;
  const alias = index.byAlias.get(key);
  if (alias) return { item: alias, via: "alias" };
  const sku = index.bySku.get(key);
  if (sku) return { item: sku, via: "sku" };
  const named = index.byName.get(key);
  if (named && named !== "ambiguous") return { item: named, via: "name" };
  return null;
}

// ------------------------------------------------------------------
// Candidate building (estimate lines + kits → what to persist), D7 merge rule
// ------------------------------------------------------------------

function cleanQuantity(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const rounded = Math.round(value * 1000) / 1000;
  if (rounded <= 0 || rounded > MAX_QTY) return null;
  return rounded;
}

function cleanName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length > MAX_NAME ? name.slice(0, MAX_NAME).trim() : name;
}

export interface BuildCandidatesInput {
  /** Estimate/job line items. Only kind "product" becomes a material. */
  sourceLines: ReadonlyArray<SourceLineItem>;
  kits: ReadonlyArray<KitSnapshot>;
  index: CatalogMatchIndex;
}

export interface BuildCandidatesResult {
  candidates: PlanCandidateLine[];
  /** Services / other charges on the estimate: not materials. */
  nonProductSkipped: number;
  /** Product lines dropped because the name was blank or the quantity unusable. */
  invalidSkipped: number;
}

/**
 * D7: the same item from an estimate and a kit becomes ONE line. The estimate quantity
 * wins; the kit's quantity is kept on the line as kit_quantity. Two estimate lines (or two
 * kits) for the same catalog item add up. Lines that match no catalog item stay free text
 * ("needs SKU") — they are never dropped.
 */
export function buildPlanCandidates(input: BuildCandidatesInput): BuildCandidatesResult {
  const { sourceLines, kits, index } = input;
  let nonProductSkipped = 0;
  let invalidSkipped = 0;

  const ordered = [...sourceLines].sort((a, b) => a.sortOrder - b.sortOrder);
  const result: PlanCandidateLine[] = [];
  const byItem = new Map<string, PlanCandidateLine>();

  for (const line of ordered) {
    if (line.kind !== "product") {
      nonProductSkipped += 1;
      continue;
    }
    const name = cleanName(line.name);
    const quantity = cleanQuantity(line.qty);
    if (!name || quantity === null) {
      invalidSkipped += 1;
      continue;
    }
    const match = matchCatalogItem(name, index);
    const existing = match ? byItem.get(match.item.id) : undefined;
    if (existing) {
      existing.quantity = cleanQuantity(existing.quantity + quantity) ?? existing.quantity;
      continue;
    }
    const candidate: PlanCandidateLine = {
      name: match ? match.item.name : name,
      quantity,
      unit: match?.item.unit ?? "ea",
      catalogItemId: match?.item.id ?? null,
      partNumber: match?.item.sku ?? null,
      source: "estimate",
      jobLineItemId: line.table === "job" ? line.id : null,
      estimateLineItemId: line.table === "estimate" ? line.id : null,
      kitId: null,
      kitVersion: null,
      kitQuantity: null,
      isOptional: false,
    };
    result.push(candidate);
    if (match) byItem.set(match.item.id, candidate);
  }

  for (const kit of kits) {
    for (const kitLine of kit.lines) {
      const kitQty = cleanQuantity(kitLine.quantity * kit.multiplier);
      if (kitQty === null) {
        invalidSkipped += 1;
        continue;
      }
      const existing = byItem.get(kitLine.catalogItemId);
      if (existing) {
        if (existing.source === "estimate") {
          // Estimate quantity wins; remember what the kit asked for.
          existing.kitQuantity = cleanQuantity((existing.kitQuantity ?? 0) + kitQty);
          existing.kitId = existing.kitId ?? kit.kitId;
          existing.kitVersion = existing.kitVersion ?? kit.version;
        } else {
          // Same item in two kits: add up.
          existing.quantity = cleanQuantity(existing.quantity + kitQty) ?? existing.quantity;
          existing.kitQuantity = existing.quantity;
        }
        continue;
      }
      const candidate: PlanCandidateLine = {
        name: kitLine.name,
        quantity: kitQty,
        unit: kitLine.unit ?? "ea",
        catalogItemId: kitLine.catalogItemId,
        partNumber: null,
        source: "kit",
        jobLineItemId: null,
        estimateLineItemId: null,
        kitId: kit.kitId,
        kitVersion: kit.version,
        kitQuantity: kitQty,
        isOptional: kitLine.isOptional,
      };
      result.push(candidate);
      byItem.set(kitLine.catalogItemId, candidate);
    }
  }

  return { candidates: result, nonProductSkipped, invalidSkipped };
}

/** The `generated_from` value for a generation run. */
export function planOriginFor(candidates: ReadonlyArray<PlanCandidateLine>): "estimate" | "kit" | "mixed" | "manual" {
  const estimate = candidates.some((line) => line.source === "estimate");
  const kit = candidates.some((line) => line.source === "kit");
  if (estimate && kit) return "mixed";
  if (estimate) return "estimate";
  if (kit) return "kit";
  return "manual";
}

/** JSON the RPC expects (snake_case). */
export function toGenerateRpcLines(candidates: ReadonlyArray<PlanCandidateLine>): Array<Record<string, unknown>> {
  return candidates.map((line) => ({
    name: line.name,
    quantity: line.quantity,
    unit: line.unit,
    catalog_item_id: line.catalogItemId,
    part_number: line.partNumber,
    source: line.source,
    job_line_item_id: line.jobLineItemId,
    estimate_line_item_id: line.estimateLineItemId,
    kit_id: line.kitId,
    kit_version: line.kitVersion,
    kit_quantity: line.kitQuantity,
    is_optional: line.isOptional,
  }));
}

// ------------------------------------------------------------------
// Line state helpers
// ------------------------------------------------------------------

/** A plan line with no catalog item and no "not a stocked item" decision. */
export function isNeedsSku(line: Pick<JobMaterialLine, "planId" | "catalogItemId" | "nonStockReason">): boolean {
  return line.planId !== null && line.catalogItemId === null && line.nonStockReason === null;
}

export function countNeedsSku(lines: ReadonlyArray<JobMaterialLine>): number {
  return lines.reduce((count, line) => count + (isNeedsSku(line) ? 1 : 0), 0);
}

/** Scales a kit's current lines for refresh_job_kit(). */
export function toRefreshRpcLines(kit: KitSnapshot): Array<Record<string, unknown>> {
  return kit.lines
    .map((line) => ({ line, quantity: cleanQuantity(line.quantity * kit.multiplier) }))
    .filter((entry): entry is { line: KitSnapshot["lines"][number]; quantity: number } => entry.quantity !== null)
    .map(({ line, quantity }) => ({
      catalog_item_id: line.catalogItemId,
      name: line.name,
      unit: line.unit ?? "ea",
      quantity,
      is_optional: line.isOptional,
    }));
}

// ------------------------------------------------------------------
// Adjustments: the office must say why a quantity/item changed or a line left.
// ------------------------------------------------------------------

export class MaterialPlanValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "MaterialPlanValidationError";
  }
}

const MAX_REASON = 500;
const MIN_REASON = 3;

export function parseReason(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new MaterialPlanValidationError("reason must be text.");
  const reason = value.trim().replace(/\s+/g, " ");
  if (!reason) return null;
  if (reason.length > MAX_REASON) {
    throw new MaterialPlanValidationError(`reason must be ${MAX_REASON} characters or fewer.`);
  }
  return reason;
}

export interface LineAdjustmentPatch {
  quantity?: number;
  name?: string;
  unit?: string;
  notes?: string;
  isOptional?: boolean;
}

/** Quantity, name and unit changes change what gets pulled, so they need a reason. */
export function adjustmentNeedsReason(patch: LineAdjustmentPatch): boolean {
  return patch.quantity !== undefined || patch.name !== undefined || patch.unit !== undefined;
}

export function requireReasonFor(patch: LineAdjustmentPatch, reason: string | null): string | null {
  if (!adjustmentNeedsReason(patch)) return reason;
  if (!reason || reason.length < MIN_REASON) {
    throw new MaterialPlanValidationError("Say why this changed (a few words is fine).");
  }
  return reason;
}

export function parseAdjustmentPatch(body: Record<string, unknown>): LineAdjustmentPatch {
  const patch: LineAdjustmentPatch = {};
  if (body.quantity !== undefined) {
    const qty = typeof body.quantity === "number" ? body.quantity : Number.NaN;
    if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) {
      throw new MaterialPlanValidationError(`quantity must be greater than 0 and at most ${MAX_QTY}.`);
    }
    patch.quantity = Math.round(qty * 1000) / 1000;
  }
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > MAX_NAME) {
      throw new MaterialPlanValidationError(`name must be 1–${MAX_NAME} characters.`);
    }
    patch.name = cleanName(body.name);
  }
  if (body.unit !== undefined) {
    if (typeof body.unit !== "string" || !body.unit.trim() || body.unit.trim().length > 20) {
      throw new MaterialPlanValidationError("unit must be 1–20 characters.");
    }
    patch.unit = body.unit.trim();
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== "string" || body.notes.length > 2000) {
      throw new MaterialPlanValidationError("notes must be 2,000 characters or fewer.");
    }
    patch.notes = body.notes;
  }
  if (body.isOptional !== undefined) {
    if (typeof body.isOptional !== "boolean") {
      throw new MaterialPlanValidationError("isOptional must be true or false.");
    }
    patch.isOptional = body.isOptional;
  }
  if (Object.keys(patch).length === 0) {
    throw new MaterialPlanValidationError("Nothing to change.");
  }
  return patch;
}

export function patchToRpc(patch: LineAdjustmentPatch): Record<string, unknown> {
  const rpc: Record<string, unknown> = {};
  if (patch.quantity !== undefined) rpc.quantity = patch.quantity;
  if (patch.name !== undefined) rpc.name = patch.name;
  if (patch.unit !== undefined) rpc.unit = patch.unit;
  if (patch.notes !== undefined) rpc.notes = patch.notes;
  if (patch.isOptional !== undefined) rpc.is_optional = patch.isOptional;
  return rpc;
}

// ------------------------------------------------------------------
// Kit requests (generate / attach)
// ------------------------------------------------------------------

export interface KitRequest {
  kitId: string;
  multiplier: number;
}

export function parseMultiplier(value: unknown): number {
  if (value === undefined || value === null) return 1;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1000) {
    throw new MaterialPlanValidationError("multiplier must be greater than 0 and at most 1000.");
  }
  return Math.round(value * 1000) / 1000;
}

export function parseKitRequests(value: unknown): KitRequest[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new MaterialPlanValidationError("kits must be a list.");
  if (value.length > 10) throw new MaterialPlanValidationError("Attach at most 10 kits at once.");
  const seen = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new MaterialPlanValidationError("Each kit needs a kitId.");
    }
    const record = entry as Record<string, unknown>;
    if (!isUuid(record.kitId)) throw new MaterialPlanValidationError("kitId must be a valid id.");
    const kitId = record.kitId.toLowerCase();
    if (seen.has(kitId)) throw new MaterialPlanValidationError("A kit can only be listed once.");
    seen.add(kitId);
    return { kitId, multiplier: parseMultiplier(record.multiplier) };
  });
}

// ------------------------------------------------------------------
// History wording
// ------------------------------------------------------------------

function qty(value: number | null): string {
  return value === null ? "—" : String(value);
}

export function describeMaterialEvent(event: MaterialLineEvent): string {
  switch (event.eventType) {
    case "created":
      return event.origin === "generation" ? "Added by plan generation" : "Added";
    case "qty_changed":
      return `Quantity ${qty(event.fromQty)} → ${qty(event.toQty)}`;
    case "item_changed":
      return "Item changed";
    case "removed":
      return "Removed";
    case "sku_linked":
      return "Linked to a catalog item";
    case "kit_refreshed":
      return "Refreshed from kit";
    case "reserved":
      return "Reserved";
    case "released":
      return "Released";
    case "pulled":
      return "Pulled";
    case "used":
      return "Used";
    case "returned":
      return "Returned";
    case "override":
      return "Override";
    default:
      return "Changed";
  }
}
