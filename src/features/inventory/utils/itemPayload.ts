/**
 * Pure request-body parsing for catalog items. Accepts only known keys with the
 * right JSON types and reports what was wrong; business rules live in catalogRules.
 */

import {
  ITEM_KINDS,
  TRACKING_MODES,
  type CatalogItemInput,
  type CatalogPriceTierInput,
  type ItemKind,
  type TrackingMode,
} from "../types/catalog";

export interface ParsedPayload<T> {
  value: T;
  problems: string[];
}

type Body = Record<string, unknown>;

function readString(body: Body, key: string, out: Record<string, unknown>, problems: string[]) {
  if (!(key in body)) return;
  const raw = body[key];
  if (raw === null) out[key] = null;
  else if (typeof raw === "string") out[key] = raw;
  else problems.push(`${key} must be text.`);
}

function readBool(body: Body, key: string, out: Record<string, unknown>, problems: string[]) {
  if (!(key in body)) return;
  if (typeof body[key] === "boolean") out[key] = body[key];
  else problems.push(`${key} must be true or false.`);
}

function readCents(body: Body, key: string, out: Record<string, unknown>, problems: string[]) {
  if (!(key in body)) return;
  const raw = body[key];
  if (raw === null) out[key] = null;
  else if (typeof raw === "number" && Number.isInteger(raw)) out[key] = raw;
  else problems.push(`${key} must be whole cents.`);
}

/** Parses the writable item fields that are present. Missing keys stay absent (for PATCH). */
export function parseItemPayload(body: Body): ParsedPayload<Partial<CatalogItemInput>> {
  const problems: string[] = [];
  const out: Record<string, unknown> = {};

  for (const key of ["name", "description", "categoryId", "sku", "unit", "brand", "model", "mfrPartNumber"]) {
    readString(body, key, out, problems);
  }
  for (const key of ["isSellable", "isTaxable", "isStockable", "isActive"]) readBool(body, key, out, problems);
  for (const key of ["sellPriceCents", "memberPriceCents"]) readCents(body, key, out, problems);

  if ("itemKind" in body) {
    if (typeof body.itemKind === "string" && ITEM_KINDS.includes(body.itemKind as ItemKind)) out.itemKind = body.itemKind;
    else problems.push(`itemKind must be one of: ${ITEM_KINDS.join(", ")}.`);
  }
  if ("trackingMode" in body) {
    if (typeof body.trackingMode === "string" && TRACKING_MODES.includes(body.trackingMode as TrackingMode)) {
      out.trackingMode = body.trackingMode;
    } else problems.push(`trackingMode must be one of: ${TRACKING_MODES.join(", ")}.`);
  }
  if ("sizeAttrs" in body) {
    const raw = body.sizeAttrs;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) out.sizeAttrs = raw;
    else problems.push("sizeAttrs must be an object.");
  }

  return { value: out as Partial<CatalogItemInput>, problems };
}

/** Parses the optional `cost` block on item create/update. `undefined` = not supplied. */
export function parseCostPayload(
  body: Body,
): ParsedPayload<{ unitCostCents: number; preferredVendor: string | null } | undefined> {
  if (!("cost" in body) || body.cost == null) return { value: undefined, problems: [] };
  const raw = body.cost;
  if (typeof raw !== "object" || Array.isArray(raw)) return { value: undefined, problems: ["cost must be an object."] };
  const cost = raw as Body;
  if (typeof cost.unitCostCents !== "number" || !Number.isInteger(cost.unitCostCents) || cost.unitCostCents < 0) {
    return { value: undefined, problems: ["cost.unitCostCents must be whole cents, 0 or more."] };
  }
  const vendor = typeof cost.preferredVendor === "string" ? cost.preferredVendor : null;
  return { value: { unitCostCents: cost.unitCostCents, preferredVendor: vendor }, problems: [] };
}

export function parseTierPayload(body: Body): ParsedPayload<CatalogPriceTierInput[]> {
  if (!Array.isArray(body.tiers)) return { value: [], problems: ["tiers must be a list."] };
  const problems: string[] = [];
  const tiers: CatalogPriceTierInput[] = [];
  body.tiers.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      problems.push(`tiers[${index}] must be an object.`);
      return;
    }
    const tier = raw as Body;
    if (typeof tier.label !== "string") problems.push(`tiers[${index}].label must be text.`);
    if (typeof tier.priceCents !== "number") problems.push(`tiers[${index}].priceCents must be a number.`);
    if (typeof tier.label === "string" && typeof tier.priceCents === "number") {
      tiers.push({
        label: tier.label,
        priceCents: tier.priceCents,
        memberPriceCents: typeof tier.memberPriceCents === "number" ? tier.memberPriceCents : null,
        sortOrder: typeof tier.sortOrder === "number" ? tier.sortOrder : undefined,
      });
    }
  });
  return { value: tiers, problems };
}
