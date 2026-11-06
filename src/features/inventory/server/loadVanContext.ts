import "server-only";

import { listCatalogItems } from "@/services/inventoryCatalog";
import { listCountedLocationIds, listStockLevels } from "@/services/inventoryLedger";
import { getVehicleOrThrow, listLocations, listVehicles } from "@/services/inventoryLocations";
import { listVanOperators, listVanPeople } from "@/services/vehicleOperators";

import type { CatalogItem } from "../types/catalog";
import type { InventoryLocation, StockLevel, Vehicle } from "../types/ledger";
import type { VanPerson, VehicleOperator } from "../types/operators";
import type { VanCopySource } from "../types/vans";
import { resolveShopLocation, type ShopLocationRef } from "../utils/parRules";
import { loadCrewOptions } from "./loadCrewOptions";

export type { VanCopySource };

export interface VanContext {
  vehicle: Vehicle;
  location: InventoryLocation | null;
  crewName: string | null;
  counted: boolean;
  items: CatalogItem[];
  levels: StockLevel[];
  shop: ShopLocationRef | null;
  copySources: VanCopySource[];
  operators: VehicleOperator[];
  people: VanPerson[];
}

async function loadPeople(): Promise<VanPerson[]> {
  try {
    return await listVanPeople();
  } catch {
    return [];
  }
}

/** Everything the van stock page and the par editor share. Cost is never loaded. */
export async function loadVanContext(vehicleId: string): Promise<VanContext> {
  const vehicle = await getVehicleOrThrow(vehicleId);
  const [locations, vehicles, items, levels, people, operators, crews] = await Promise.all([
    listLocations(true),
    listVehicles(true),
    listCatalogItems({ includeInactive: true, limit: 1000 }, { canSeeCost: false }),
    listStockLevels(),
    loadPeople(),
    listVanOperators(),
    loadCrewOptions(),
  ]);
  const crewName = (vehicle.crewId && crews.find((crew) => crew.id === vehicle.crewId)?.name) || null;

  const location = locations.find((row) => row.vehicleId === vehicle.id) ?? null;
  const vanLocationIds = locations.filter((row) => row.type === "van" && row.vehicleId).map((row) => row.id);
  const countedIds = await listCountedLocationIds(vanLocationIds);
  const counted = location != null && countedIds.has(location.id);
  const shop = location ? resolveShopLocation(location, locations) : null;

  const locationByVehicle = new Map(
    locations.filter((row) => row.vehicleId).map((row) => [row.vehicleId as string, row.id]),
  );
  const copySources: VanCopySource[] = vehicles
    .filter((other) => other.id !== vehicle.id && locationByVehicle.has(other.id))
    .map((other) => {
      const otherLocationId = locationByVehicle.get(other.id) as string;
      return {
        vehicleId: other.id,
        name: other.name,
        pars: levels
          .filter((level) => level.locationId === otherLocationId && (level.minQty != null || level.maxQty != null))
          .map((level) => ({ itemId: level.itemId, minQty: level.minQty, maxQty: level.maxQty })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    vehicle: { ...vehicle, crewId: vehicle.crewId },
    location,
    crewName,
    counted,
    items,
    levels: location ? levels.filter((level) => level.locationId === location.id) : [],
    shop,
    copySources,
    operators: operators.filter((row) => row.vehicleId === vehicle.id),
    people,
  };
}
