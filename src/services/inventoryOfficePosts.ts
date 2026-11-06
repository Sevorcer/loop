import "server-only";

import { randomUUID } from "node:crypto";

import type { CatalogItem } from "@/features/inventory/types/catalog";
import type { InventoryLocation, NewLedgerRow } from "@/features/inventory/types/ledger";
import {
  expandOfficeCount,
  resolveCountReason,
  type CountLine,
} from "@/features/inventory/utils/countSheet";
import { resolveShopLocation } from "@/features/inventory/utils/parRules";
import { expandOfficeRestock, type RestockPostLine } from "@/features/inventory/utils/restockPost";
import { getItem, listItems } from "@/repositories/catalog";
import { appendLedgerRows, listCountedLocationIds, listStockLevels } from "@/repositories/inventoryLedger";
import { getVanLocationForVehicle, listLocations } from "@/repositories/inventoryLocations";
import { getVehicle, listVehicles } from "@/repositories/vehicles";

function notFound(what: string): never {
  throw Object.assign(new Error(`${what} not found.`), { status: 404 });
}

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

async function loadItems(itemIds: readonly string[]): Promise<Map<string, CatalogItem>> {
  const listed = await listItems({ includeInactive: true, facet: "stockable", limit: 1000 });
  const map = new Map(listed.map((item) => [item.id, item]));
  for (const itemId of itemIds) {
    if (map.has(itemId)) continue;
    const item = await getItem(itemId);
    if (item) map.set(item.id, item);
  }
  return map;
}

function assertStockable(map: ReadonlyMap<string, CatalogItem>, itemId: string): void {
  const item = map.get(itemId);
  if (!item) notFound("Item");
  if (!item.isStockable) badRequest(`"${item.name}" is not a stockable item.`);
  if (!item.isActive) badRequest(`"${item.name}" is inactive.`);
}

export interface OfficeCountResult {
  posted: number;
  skipped: number;
  noChange: boolean;
  /** True when this post wrote the van's first count row. */
  countedIn: boolean;
}

/**
 * Posts the office count sheet for one van. Each changed line is a count
 * command. Matching lines post nothing. Rows append in one insert. On-hand
 * changes only through the ledger trigger.
 */
export async function postOfficeVanCount(
  vehicleId: string,
  lines: readonly CountLine[],
  reason: string | null,
  userId: string,
): Promise<OfficeCountResult> {
  if (!userId) throw Object.assign(new Error("Authenticated user is required."), { status: 401 });
  if (!vehicleId.trim()) badRequest("A van is required.");
  if (lines.length === 0) badRequest("Type a quantity on at least one line.");

  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound("Vehicle");
  if (vehicle.status === "retired") badRequest("Bring this van back from retired before counting it in.");

  const location = await getVanLocationForVehicle(vehicleId);
  if (!location) badRequest("This van has no stock location. Create one before counting it in.");
  if (location.type !== "van") badRequest("Count-in is for a van.");
  if (!location.isActive) badRequest("This van's stock location is inactive.");

  const items = await loadItems(lines.map((line) => line.itemId));
  const seenItems = new Set<string>();
  for (const line of lines) {
    if (seenItems.has(line.itemId)) badRequest("Each item can only be counted once.");
    seenItems.add(line.itemId);
    assertStockable(items, line.itemId);
  }

  const [levels, countedIds] = await Promise.all([
    listStockLevels({ locationId: location.id }),
    listCountedLocationIds([location.id]),
  ]);
  const counted = countedIds.has(location.id);
  const onHandByItem = new Map(levels.map((level) => [level.itemId, level.onHand]));
  const note = resolveCountReason(reason, counted);
  const expanded = expandOfficeCount({
    locationId: location.id,
    reason: note,
    lines,
    onHandByItem,
  });

  if (expanded.rows.length === 0) {
    return { posted: 0, skipped: expanded.skippedItemIds.length, noChange: true, countedIn: false };
  }

  await appendLedgerRows(expanded.rows, userId);
  return {
    posted: expanded.rows.length,
    skipped: expanded.skippedItemIds.length,
    noChange: false,
    countedIn: !counted,
  };
}

export interface OfficeRestockResult {
  posted: number;
}

interface VanTarget {
  vehicleName: string;
  location: InventoryLocation;
  shopId: string;
}

/**
 * Posts shop-to-van transfer pairs for the lines the office left checked.
 * The shop must be the van's resolved warehouse. The van must already have
 * a count-in. A short shop does not block the pull. Each pair keeps its own
 * transfer group. unit_cost_cents stays null.
 */
export async function postOfficeRestock(
  lines: readonly RestockPostLine[],
  userId: string,
): Promise<OfficeRestockResult> {
  if (!userId) throw Object.assign(new Error("Authenticated user is required."), { status: 401 });
  if (lines.length === 0) badRequest("Check at least one line to pull.");

  const [locations, vehicles, items] = await Promise.all([
    listLocations(true),
    listVehicles(true),
    loadItems(lines.map((line) => line.itemId)),
  ]);
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const locationById = new Map(locations.map((location) => [location.id, location]));

  const targets = new Map<string, VanTarget>();
  const seenLines = new Set<string>();
  for (const line of lines) {
    const lineKey = `${line.itemId}:${line.toLocationId}`;
    if (seenLines.has(lineKey)) badRequest("Each item can only be pulled once onto the same van.");
    seenLines.add(lineKey);
    assertStockable(items, line.itemId);
    const destination = locationById.get(line.toLocationId);
    if (!destination || destination.type !== "van" || !destination.vehicleId) {
      badRequest("Pull onto a van.");
    }
    if (!destination.isActive) badRequest("That van's stock location is inactive.");
    const vehicle = vehicleById.get(destination.vehicleId);
    if (!vehicle) notFound("Vehicle");
    if (vehicle.status !== "active") {
      badRequest(`${vehicle.name} is not an active van, so it is off the pick list.`);
    }

    let target = targets.get(destination.id);
    if (!target) {
      const shop = resolveShopLocation(destination, locations);
      if (!shop) badRequest(`Set the shop as ${vehicle.name}'s parent before pulling parts.`);
      target = { vehicleName: vehicle.name, location: destination, shopId: shop.id };
      targets.set(destination.id, target);
    }
    if (line.fromLocationId !== target.shopId) {
      badRequest(`Pull ${target.vehicleName} from its shop warehouse.`);
    }
  }

  const countedIds = await listCountedLocationIds([...targets.keys()]);
  for (const target of targets.values()) {
    if (!countedIds.has(target.location.id)) {
      badRequest(`${target.vehicleName} has not been counted in yet, so restock alerts stay off.`);
    }
  }

  const rows: NewLedgerRow[] = expandOfficeRestock(lines, randomUUID);
  await appendLedgerRows(rows, userId);
  return { posted: lines.length };
}
