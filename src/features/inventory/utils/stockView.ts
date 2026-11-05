/** Pure view logic for the Stock screen: locations, per-location rows, flags, search. */

import type { CatalogItem } from "../types/catalog";
import type { InventoryLocation, StockLevel, Vehicle } from "../types/ledger";

export type StockFlag = "negative" | "zero" | "ok";

export function computeStockFlag(onHand: number): StockFlag {
  if (onHand < 0) return "negative";
  if (onHand === 0) return "zero";
  return "ok";
}

export interface StockRow {
  itemId: string;
  name: string;
  sku: string | null;
  unit: string | null;
  brand: string | null;
  onHand: number;
  minQty: number | null;
  /** True when on-hand is at or below a configured minimum (and not already negative/zero). */
  belowMin: boolean;
  flag: StockFlag;
}

export interface LocationOption {
  id: string;
  label: string;
  type: InventoryLocation["type"];
}

const TYPE_ORDER: Record<InventoryLocation["type"], number> = { warehouse: 0, van: 1, quarantine: 2, job: 3 };

/** Switcher options: warehouses, vans, quarantine (job locations are never offered). Active only. */
export function buildLocationOptions(
  locations: readonly InventoryLocation[],
  vehicles: readonly Vehicle[] = [],
): LocationOption[] {
  const vehicleNames = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name]));
  return locations
    .filter((location) => location.isActive && location.type !== "job")
    .map((location) => ({
      id: location.id,
      type: location.type,
      label: (location.vehicleId && vehicleNames.get(location.vehicleId)) || location.name,
    }))
    .sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.label.localeCompare(b.label));
}

/** Picks the location from ?location=, falling back to the first warehouse, then the first option. */
export function resolveSelectedLocation(
  options: readonly LocationOption[],
  requested: string | null | undefined,
): string | null {
  if (requested && options.some((option) => option.id === requested)) return requested;
  return (options.find((option) => option.type === "warehouse") ?? options[0])?.id ?? null;
}

/** Stock levels grouped by location id. */
export function groupStockByLocation(levels: readonly StockLevel[]): Map<string, StockLevel[]> {
  const grouped = new Map<string, StockLevel[]>();
  for (const level of levels) {
    const list = grouped.get(level.locationId);
    if (list) list.push(level);
    else grouped.set(level.locationId, [level]);
  }
  return grouped;
}

/** Case-insensitive match over name / sku / brand / model / manufacturer part number. */
export function matchesItemSearch(
  item: Pick<CatalogItem, "name" | "sku" | "brand" | "model" | "mfrPartNumber">,
  search: string | null | undefined,
): boolean {
  const needle = search?.trim().toLowerCase();
  if (!needle) return true;
  return [item.name, item.sku, item.brand, item.model, item.mfrPartNumber].some(
    (value) => typeof value === "string" && value.toLowerCase().includes(needle),
  );
}

/**
 * Rows for one location. Every active stockable item appears (missing level = 0 on hand),
 * so a zero is visible, not absent. Items with a stock row but now inactive still show if they hold stock.
 */
export function buildStockRows(
  items: readonly CatalogItem[],
  levelsAtLocation: readonly StockLevel[],
  search?: string | null,
): StockRow[] {
  const byItem = new Map(levelsAtLocation.map((level) => [level.itemId, level]));
  const rows: StockRow[] = [];
  for (const item of items) {
    if (!item.isStockable) continue;
    const level = byItem.get(item.id);
    if (!item.isActive && (!level || level.onHand === 0)) continue;
    if (!matchesItemSearch(item, search)) continue;
    const onHand = level?.onHand ?? 0;
    const minQty = level?.minQty ?? null;
    const flag = computeStockFlag(onHand);
    rows.push({
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      brand: item.brand,
      onHand,
      minQty,
      flag,
      belowMin: flag === "ok" && minQty != null && onHand <= minQty,
    });
  }
  return rows.sort((a, b) => flagRank(a.flag) - flagRank(b.flag) || a.name.localeCompare(b.name));
}

function flagRank(flag: StockFlag): number {
  return flag === "negative" ? 0 : flag === "zero" ? 1 : 2;
}

export function countFlags(rows: readonly StockRow[]): { negative: number; zero: number } {
  return {
    negative: rows.filter((row) => row.flag === "negative").length,
    zero: rows.filter((row) => row.flag === "zero").length,
  };
}

/** What on-hand would become after a delta; used for the non-blocking negative warning. */
export function projectedOnHand(current: number, delta: number): number {
  return Math.round((current + delta) * 1000) / 1000;
}

export function negativeOnHandWarning(args: { itemName?: string; locationName?: string; projected: number }): string | null {
  if (args.projected >= 0) return null;
  const where = args.locationName ? ` at ${args.locationName}` : "";
  const what = args.itemName ? `${args.itemName}${where}` : `This location`;
  return `${what} will be at ${args.projected} on hand. You can still save; this will show as negative until corrected.`;
}

export interface StockSnapshot {
  itemId: string;
  locationId: string;
  onHand: number;
}

/** On-hand for an item at a location from a flat snapshot (0 when no level exists). */
export function lookupOnHand(snapshot: readonly StockSnapshot[], itemId: string, locationId: string): number {
  return snapshot.find((row) => row.itemId === itemId && row.locationId === locationId)?.onHand ?? 0;
}
