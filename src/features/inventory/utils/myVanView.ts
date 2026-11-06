/**
 * My van view rules.
 *
 * The phone opens the van from vehicle_operators (home first). Below-par
 * badges and the pick list stay off until that van has a count row. Sitting
 * exactly on the minimum is not low. Shop on-hand is attached only to pick
 * lines. Cards never carry shop quantity, cost, or another van.
 */

import { companyTimeZone } from "@/lib/timezone";

import type { CatalogItem } from "../types/catalog";
import { buildRestockList, isBelowPar, type RestockItemInput, type RestockLevelInput } from "./parRules";
import { matchesItemSearch } from "./stockView";

export const MY_VAN_ACTIVITY_SCAN = 200;
export const MY_VAN_ACTIVITY_SHOW = 8;

export const UNCOUNTED_VAN_COPY =
  "This van has not been counted in yet. Restock alerts stay off until the office posts that count.";

export const RETIRED_VAN_COPY = "This van is retired. Count and restock stay off.";

export const NO_LOCATION_COPY =
  "This van has no stock location yet. The office sets that up on Locations & vans.";

export const SHOP_UNRESOLVED_COPY =
  "The shop for this van isn't set. Ask the office to set the shop as this van's parent. Nothing can be pulled until then.";

export interface MyVanAssignmentRef {
  vehicleId: string;
  isHome: boolean;
  name: string;
}

/** Home van first, then name. */
export function orderMyVanAssignments<T extends MyVanAssignmentRef>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return a.vehicleId.localeCompare(b.vehicleId);
  });
}

/**
 * Opens the requested van when it is one of the caller's assignments.
 * Any other id falls back to the home van, so a guessed id does not confirm
 * that another van exists.
 */
export function pickMyVanAssignment<T extends MyVanAssignmentRef>(
  rows: readonly T[],
  requestedVehicleId: string | null | undefined,
): T | null {
  if (rows.length === 0) return null;
  const ordered = orderMyVanAssignments(rows);
  const requested = requestedVehicleId?.trim();
  if (requested) {
    const match = ordered.find((row) => row.vehicleId === requested);
    if (match) return match;
  }
  return ordered[0];
}

/**
 * The post path does not fall back. A vehicle id that is not assigned is refused.
 * Omitting the id uses the home van.
 */
export function resolvePostAssignment<T extends MyVanAssignmentRef>(
  rows: readonly T[],
  requestedVehicleId: string | null | undefined,
): { ok: true; assignment: T } | { ok: false; status: 400 | 403; message: string } {
  if (rows.length === 0) {
    return { ok: false, status: 400, message: "You're not assigned to a van yet. The office assigns you on Locations & vans." };
  }
  const ordered = orderMyVanAssignments(rows);
  const requested = requestedVehicleId?.trim();
  if (requested) {
    const match = ordered.find((row) => row.vehicleId === requested);
    if (!match) return { ok: false, status: 403, message: "That van is not assigned to you." };
    return { ok: true, assignment: match };
  }
  return { ok: true, assignment: ordered[0] };
}

export function locationWasCounted(
  rows: readonly { locationId: string; txnType: string }[],
  locationId: string,
): boolean {
  return rows.some((row) => row.locationId === locationId && row.txnType === "count");
}

/** The van can be counted and restocked. A retired van, or one with no active location, cannot. */
export function vanIsOpen(status: string, locationActive: boolean): boolean {
  return status !== "retired" && locationActive;
}

export function myVanSignals(args: {
  counted: boolean;
  onHand: number;
  minQty: number | null | undefined;
}): { belowPar: boolean; negative: boolean } {
  return {
    belowPar: args.counted && isBelowPar(args.onHand, args.minQty),
    negative: args.onHand < 0,
  };
}

export function showRestockSection(args: { open: boolean; counted: boolean; hasPar: boolean }): boolean {
  return args.open && args.counted && args.hasPar;
}

export function showRecountSection(args: { open: boolean; counted: boolean }): boolean {
  return args.open && args.counted;
}

export interface MyVanCard {
  itemId: string;
  name: string;
  sku: string | null;
  unit: string | null;
  brand: string | null;
  onHand: number;
  minQty: number | null;
  belowPar: boolean;
  negative: boolean;
}

export function buildMyVanCards(
  items: readonly Pick<CatalogItem, "id" | "name" | "sku" | "unit" | "brand" | "isActive" | "isStockable">[],
  levels: readonly { itemId: string; onHand: number; minQty: number | null }[],
  counted: boolean,
): MyVanCard[] {
  const byItem = new Map(levels.map((level) => [level.itemId, level]));
  const cards: MyVanCard[] = [];
  for (const item of items) {
    if (!item.isStockable) continue;
    const level = byItem.get(item.id);
    const onHand = level?.onHand ?? 0;
    if (!item.isActive && onHand === 0) continue;
    const minQty = level?.minQty ?? null;
    const signals = myVanSignals({ counted, onHand, minQty });
    cards.push({
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      brand: item.brand,
      onHand,
      minQty,
      belowPar: signals.belowPar,
      negative: signals.negative,
    });
  }
  return cards.sort((a, b) => {
    if (a.belowPar !== b.belowPar) return a.belowPar ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function filterMyVanCards(cards: readonly MyVanCard[], search: string): MyVanCard[] {
  const needle = search.trim();
  if (!needle) return [...cards];
  return cards.filter((card) =>
    matchesItemSearch(
      { name: card.name, sku: card.sku, brand: card.brand, model: null, mfrPartNumber: null },
      needle,
    ),
  );
}

export interface MyVanPickLine {
  itemId: string;
  name: string;
  sku: string | null;
  unit: string | null;
  onHand: number;
  minQty: number;
  suggestedQty: number;
  shopOnHand: number | null;
  shopShort: boolean;
  negative: boolean;
}

/**
 * Pick list for one van. Empty until the van is open, counted, and has a par.
 * Shop quantity is only present on these lines.
 */
export function buildMyVanPickLines(args: {
  open: boolean;
  counted: boolean;
  vehicleId: string;
  vehicleName: string;
  locationId: string;
  shopLocationId: string | null;
  shopLocationName: string | null;
  items: readonly RestockItemInput[];
  levels: readonly RestockLevelInput[];
}): MyVanPickLine[] {
  const hasPar = args.levels.some((level) => level.locationId === args.locationId && level.minQty != null);
  if (!showRestockSection({ open: args.open, counted: args.counted, hasPar })) return [];
  const list = buildRestockList(
    [
      {
        vehicleId: args.vehicleId,
        vehicleName: args.vehicleName,
        vehicleActive: true,
        locationId: args.locationId,
        locationActive: true,
        counted: true,
        shopLocationId: args.shopLocationId,
        shopLocationName: args.shopLocationName,
      },
    ],
    args.items,
    args.levels,
  );
  const lines = list.groups[0]?.lines ?? [];
  return lines.map((line) => ({
    itemId: line.itemId,
    name: line.name,
    sku: line.sku,
    unit: line.unit,
    onHand: line.onHand,
    minQty: line.minQty,
    suggestedQty: line.suggestedQty,
    shopOnHand: line.shopOnHand,
    shopShort: line.shopShort,
    negative: line.negative,
  }));
}

export interface MyVanActivityInput {
  id: string;
  txnType: string;
  itemId: string;
  locationId: string;
  qtyDelta: number;
  reason: string | null;
  createdAt: string;
}

export interface MyVanActivityItem {
  id: string;
  label: string;
  itemName: string;
  quantity: string;
  when: string;
}

export function describeVanActivity(row: { txnType: string; reason: string | null; qtyDelta: number }): {
  label: string;
  quantity: string;
} {
  const reason = (row.reason ?? "").trim().toLowerCase();
  let label = "Movement";
  switch (row.txnType) {
    case "count":
      label = "Counted";
      break;
    case "transfer_in":
      label = reason === "restock" ? "Restock from shop" : "Transferred onto the van";
      break;
    case "transfer_out":
      label = "Transferred off the van";
      break;
    case "adjust":
      label = "Adjustment";
      break;
    case "receive":
      label = "Received";
      break;
    case "issue_to_job":
      label = "Issued";
      break;
    case "return_from_job":
      label = "Returned";
      break;
    case "reversal":
      label = "Reversal";
      break;
    case "buy_for_job":
      label = "Bought for a job";
      break;
    default:
      label = "Movement";
  }
  const rounded = Math.round(row.qtyDelta * 1000) / 1000;
  const quantity = rounded > 0 ? `+${rounded}` : String(rounded);
  return { label, quantity };
}

export function formatVanActivityWhen(iso: string, timeZone = companyTimeZone()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Newest activity on this van only. No cost, no job, no other van. */
export function buildMyVanActivity(
  rows: readonly MyVanActivityInput[],
  locationId: string,
  itemNames: ReadonlyMap<string, string>,
  limit = MY_VAN_ACTIVITY_SHOW,
): MyVanActivityItem[] {
  return rows
    .filter((row) => row.locationId === locationId)
    .slice(0, limit)
    .map((row) => {
      const described = describeVanActivity(row);
      return {
        id: row.id,
        label: described.label,
        itemName: itemNames.get(row.itemId) ?? "Part",
        quantity: described.quantity,
        when: formatVanActivityWhen(row.createdAt),
      };
    });
}
