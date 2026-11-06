import "server-only";

import type { CatalogItem } from "@/features/inventory/types/catalog";
import { isBelowPar, resolveShopLocation } from "@/features/inventory/utils/parRules";
import {
  locationWasCounted,
  MY_VAN_ACTIVITY_SCAN,
  resolvePostAssignment,
  SHOP_UNRESOLVED_COPY,
  vanIsOpen,
} from "@/features/inventory/utils/myVanView";
import {
  buildTechCountEntries,
  buildTechRestockEntries,
  resolveTechCountReason,
  type TechCountLine,
  type TechPullLine,
} from "@/features/inventory/utils/vanEntries";
import { getItem, listItems } from "@/repositories/catalog";
import { listStockLevels } from "@/repositories/inventoryLedger";
import { getVanLocationForVehicle, listLocations } from "@/repositories/inventoryLocations";
import { listMyVanActivity, listVehiclesById, postMyVanEntries } from "@/repositories/myVan";
import { listVehicleOperators } from "@/repositories/vehicleOperators";

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function forbidden(message: string): never {
  throw Object.assign(new Error(message), { status: 403 });
}

const NOT_COUNTED = "This van has not been counted in yet. Restock alerts stay off until the office posts that count.";

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
  if (!item) throw Object.assign(new Error("Item not found."), { status: 404 });
  if (!item.isStockable) badRequest(`"${item.name}" is not a stockable item.`);
  if (!item.isActive) badRequest(`"${item.name}" is inactive.`);
}

interface ResolvedVan {
  vehicleId: string;
  vehicleName: string;
  locationId: string;
  counted: boolean;
}

/**
 * The caller's own van, from vehicle_operators. Crew names are not consulted.
 * Counted is true only when activity for this location includes a count row.
 */
async function resolveOwnVan(userId: string, vehicleId: string | null): Promise<ResolvedVan> {
  if (!userId) throw Object.assign(new Error("Authenticated user is required."), { status: 401 });
  const operators = (await listVehicleOperators()).filter((row) => row.userId === userId);
  const vehicles = await listVehiclesById(operators.map((row) => row.vehicleId));
  const names = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const assignments = operators
    .filter((row) => names.has(row.vehicleId))
    .map((row) => ({
      vehicleId: row.vehicleId,
      isHome: row.isHome,
      name: names.get(row.vehicleId)?.name ?? "Van",
    }));
  const picked = resolvePostAssignment(assignments, vehicleId);
  if (!picked.ok) {
    if (picked.status === 403) forbidden(picked.message);
    badRequest(picked.message);
  }

  const vehicle = names.get(picked.assignment.vehicleId);
  if (!vehicle) throw Object.assign(new Error("Vehicle not found."), { status: 404 });
  if (vehicle.status === "retired") badRequest("This van is retired. Count and restock stay off.");

  const location = await getVanLocationForVehicle(vehicle.id);
  if (!location || location.type !== "van" || !location.isActive) {
    badRequest("This van has no stock location yet. The office sets that up on Locations & vans.");
  }
  if (!vanIsOpen(vehicle.status, location.isActive)) {
    badRequest("This van is retired. Count and restock stay off.");
  }

  // Count-in is read from the cost-free activity function. Techs have no
  // SELECT on the ledger. The function returns the newest 200 van rows.
  const activity = await listMyVanActivity(MY_VAN_ACTIVITY_SCAN);
  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    locationId: location.id,
    counted: locationWasCounted(activity, location.id),
  };
}

export interface TechCountResult {
  posted: number;
  skipped: number;
  noChange: boolean;
}

/**
 * Tech recount. Posts count rows through fn_inventory_post_van_entries.
 * A line that matches on-hand is skipped. Free-form adjust is not accepted.
 * Cost is not read and is not written.
 */
export async function postTechVanCount(
  userId: string,
  vehicleId: string | null,
  lines: readonly TechCountLine[],
  reason: string | null,
): Promise<TechCountResult> {
  if (lines.length === 0) badRequest("Type a quantity on at least one line.");
  const van = await resolveOwnVan(userId, vehicleId);
  if (!van.counted) badRequest(NOT_COUNTED);

  const items = await loadItems(lines.map((line) => line.itemId));
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.itemId)) badRequest("Each item can only be counted once.");
    seen.add(line.itemId);
    assertStockable(items, line.itemId);
  }

  const levels = await listStockLevels({ locationId: van.locationId });
  const onHandByItem = new Map(levels.map((level) => [level.itemId, level.onHand]));
  const built = buildTechCountEntries({
    locationId: van.locationId,
    reason: resolveTechCountReason(reason),
    lines,
    onHandByItem,
  });
  if (built.entries.length === 0) {
    return { posted: 0, skipped: built.skipped, noChange: true };
  }
  const posted = await postMyVanEntries(built.entries);
  return { posted, skipped: built.skipped, noChange: false };
}

export interface TechPullResult {
  posted: number;
}

/**
 * Self-serve pick. Each line is a shop-to-own-van transfer, reason Restock.
 * The line must be below par on this van. Shop quantity does not block the post.
 * Cost is not read and is not written.
 */
export async function postTechVanRestock(
  userId: string,
  vehicleId: string | null,
  lines: readonly TechPullLine[],
): Promise<TechPullResult> {
  if (lines.length === 0) badRequest("Check at least one line to pull.");
  const van = await resolveOwnVan(userId, vehicleId);
  if (!van.counted) badRequest(NOT_COUNTED);

  const items = await loadItems(lines.map((line) => line.itemId));
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.itemId)) badRequest("Each item can only be pulled once.");
    seen.add(line.itemId);
    assertStockable(items, line.itemId);
  }

  const [locations, levels] = await Promise.all([
    listLocations(false),
    listStockLevels({ locationId: van.locationId }),
  ]);
  const location = locations.find((row) => row.id === van.locationId) ?? null;
  const shop = location ? resolveShopLocation(location, locations) : null;
  if (!shop) badRequest(SHOP_UNRESOLVED_COPY);

  const vanLevels = new Map(levels.map((level) => [level.itemId, level]));
  for (const line of lines) {
    const level = vanLevels.get(line.itemId);
    const onHand = level?.onHand ?? 0;
    if (!isBelowPar(onHand, level?.minQty)) {
      const name = items.get(line.itemId)?.name ?? "That part";
      badRequest(`${name} is not below par, so it is not on the pick list.`);
    }
  }

  const entries = buildTechRestockEntries({
    shopLocationId: shop.id,
    vanLocationId: van.locationId,
    lines,
  });
  const posted = await postMyVanEntries(entries);
  return { posted };
}
