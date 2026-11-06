/**
 * Par and restock math for Lane 2.
 *
 * Minimum flags a van when on-hand is under it. Fill-to is what a restock
 * aims for. A blank fill-to means fill up to the minimum. Sitting exactly on
 * the minimum is not low. The van stock screen and Needs restock both use
 * these helpers so the badge and the pick list cannot disagree.
 */

const SCALE = 1000;

export function roundQuantity(value: number): number {
  return Math.round(value * SCALE) / SCALE;
}

/** True when a minimum is set and on-hand is strictly under it. */
export function isBelowPar(onHand: number, minQty: number | null | undefined): boolean {
  return minQty != null && onHand < minQty;
}

/**
 * How many to pull. Uses fill-to when it is set, otherwise the minimum.
 * Never negative. Zero when there is no minimum.
 */
export function suggestedRestockQty(
  onHand: number,
  minQty: number | null | undefined,
  maxQty: number | null | undefined,
): number {
  if (minQty == null) return 0;
  const target = maxQty ?? minQty;
  return Math.max(0, roundQuantity(target - onHand));
}

/** The shop cannot cover the suggestion. The pull is still allowed later. */
export function shopIsShort(shopOnHand: number, suggestedQty: number): boolean {
  return suggestedQty > 0 && shopOnHand < suggestedQty;
}

export function formatParInput(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

export type ParsedPar = { ok: true; value: number | null } | { ok: false };

/** Blank is "not tracked". Anything else must be a non-negative number with at most 3 decimals. */
export function parseParInput(raw: string): ParsedPar {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { ok: false };
  return { ok: true, value };
}

export function isParQuantity(value: number | null): boolean {
  if (value == null) return true;
  if (!Number.isFinite(value) || value < 0 || value > 999999999.999) return false;
  return Math.abs(value * SCALE - Math.round(value * SCALE)) < 1e-6;
}

/** Plain-language problems for a minimum / fill-to pair. Null when the pair is saveable. */
export function parInputProblem(minRaw: string, maxRaw: string): string | null {
  const min = parseParInput(minRaw);
  const max = parseParInput(maxRaw);
  if (!min.ok || !max.ok) return "Use a number, or leave it blank.";
  if (min.value != null && max.value != null && min.value > max.value) {
    return "Fill to can't be less than the minimum.";
  }
  return null;
}

export function parValuesProblem(minQty: number | null, maxQty: number | null): string | null {
  if (!isParQuantity(minQty) || !isParQuantity(maxQty)) return "Use a number, or leave it blank.";
  if (minQty != null && maxQty != null && minQty > maxQty) return "Fill to can't be less than the minimum.";
  return null;
}

export interface ShopLocationRef {
  id: string;
  name: string;
}

/**
 * Shop warehouse for a van: its parent when that parent is an active warehouse,
 * otherwise the single active warehouse. Unresolved when neither applies.
 */
export function resolveShopLocation(
  van: { parentLocationId: string | null },
  locations: readonly { id: string; type: string; isActive: boolean; name: string }[],
): ShopLocationRef | null {
  if (van.parentLocationId) {
    const parent = locations.find(
      (location) => location.id === van.parentLocationId && location.type === "warehouse" && location.isActive,
    );
    if (parent) return { id: parent.id, name: parent.name };
  }
  const warehouses = locations.filter((location) => location.type === "warehouse" && location.isActive);
  if (warehouses.length === 1) return { id: warehouses[0].id, name: warehouses[0].name };
  return null;
}

export interface RestockVanInput {
  vehicleId: string;
  vehicleName: string;
  vehicleActive: boolean;
  locationId: string | null;
  locationActive: boolean;
  counted: boolean;
  shopLocationId: string | null;
  shopLocationName: string | null;
}

export interface RestockItemInput {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  isActive: boolean;
  isStockable: boolean;
}

export interface RestockLevelInput {
  itemId: string;
  locationId: string;
  onHand: number;
  minQty: number | null;
  maxQty: number | null;
}

export type RestockOmitReason = "inactive" | "no_location" | "not_counted" | "no_pars" | "not_below";

export interface RestockLine {
  itemId: string;
  name: string;
  sku: string | null;
  unit: string | null;
  onHand: number;
  minQty: number;
  maxQty: number | null;
  suggestedQty: number;
  shopOnHand: number | null;
  shopShort: boolean;
  negative: boolean;
}

export interface RestockGroup {
  vehicleId: string;
  vehicleName: string;
  locationId: string;
  shopLocationId: string | null;
  shopLocationName: string | null;
  lines: RestockLine[];
}

export interface RestockList {
  groups: RestockGroup[];
  /** Active vans with a location that have never been counted in. */
  awaitingCount: number;
  omitted: { vehicleId: string; vehicleName: string; reason: RestockOmitReason }[];
}

function levelKey(itemId: string, locationId: string): string {
  return `${itemId}:${locationId}`;
}

/**
 * Pick list at read time. Uncounted vans and vans with no pars are absent.
 * A missing stock row counts as zero, which only matters after a count exists.
 */
export function buildRestockList(
  vans: readonly RestockVanInput[],
  items: readonly RestockItemInput[],
  levels: readonly RestockLevelInput[],
): RestockList {
  const stockable = items.filter((item) => item.isActive && item.isStockable);
  const byKey = new Map(levels.map((level) => [levelKey(level.itemId, level.locationId), level]));
  const groups: RestockGroup[] = [];
  const omitted: RestockList["omitted"] = [];
  let awaitingCount = 0;

  const ordered = [...vans].sort((a, b) => a.vehicleName.localeCompare(b.vehicleName));
  for (const van of ordered) {
    if (!van.vehicleActive) {
      omitted.push({ vehicleId: van.vehicleId, vehicleName: van.vehicleName, reason: "inactive" });
      continue;
    }
    if (!van.locationId || !van.locationActive) {
      omitted.push({ vehicleId: van.vehicleId, vehicleName: van.vehicleName, reason: "no_location" });
      continue;
    }
    if (!van.counted) {
      awaitingCount += 1;
      omitted.push({ vehicleId: van.vehicleId, vehicleName: van.vehicleName, reason: "not_counted" });
      continue;
    }

    const locationId = van.locationId;
    const lines: RestockLine[] = [];
    let hasPar = false;
    for (const item of stockable) {
      const level = byKey.get(levelKey(item.id, locationId));
      const onHand = level?.onHand ?? 0;
      const minQty = level?.minQty ?? null;
      const maxQty = level?.maxQty ?? null;
      if (minQty == null) continue;
      hasPar = true;
      if (!isBelowPar(onHand, minQty)) continue;
      const suggestedQty = suggestedRestockQty(onHand, minQty, maxQty);
      const shopLevel = van.shopLocationId ? byKey.get(levelKey(item.id, van.shopLocationId)) : undefined;
      const shopOnHand = van.shopLocationId ? (shopLevel?.onHand ?? 0) : null;
      lines.push({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        onHand,
        minQty,
        maxQty,
        suggestedQty,
        shopOnHand,
        shopShort: shopOnHand != null && shopIsShort(shopOnHand, suggestedQty),
        negative: onHand < 0,
      });
    }

    if (!hasPar) {
      omitted.push({ vehicleId: van.vehicleId, vehicleName: van.vehicleName, reason: "no_pars" });
      continue;
    }
    if (lines.length === 0) {
      omitted.push({ vehicleId: van.vehicleId, vehicleName: van.vehicleName, reason: "not_below" });
      continue;
    }

    lines.sort((a, b) => a.name.localeCompare(b.name));
    groups.push({
      vehicleId: van.vehicleId,
      vehicleName: van.vehicleName,
      locationId,
      shopLocationId: van.shopLocationId,
      shopLocationName: van.shopLocationName,
      lines,
    });
  }

  return { groups, awaitingCount, omitted };
}

export function restockOmitCopy(reason: RestockOmitReason, vehicleName: string): string {
  switch (reason) {
    case "inactive":
      return `${vehicleName} is not an active van, so it is off the pick list.`;
    case "no_location":
      return `${vehicleName} has no stock location yet. Create one on the van, then count it in.`;
    case "not_counted":
      return `${vehicleName} has not been counted in yet, so restock alerts stay off.`;
    case "no_pars":
      return `${vehicleName} has no pars, so it is not part of restock.`;
    case "not_below":
      return `${vehicleName} is at or above its pars.`;
  }
}

export function awaitingCountCopy(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) return "1 van is waiting on a first count. Restock alerts stay off until that count is posted.";
  return `${count} vans are waiting on a first count. Restock alerts stay off until that count is posted.`;
}
