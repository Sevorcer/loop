import "server-only";

import { listCatalogItems } from "@/services/inventoryCatalog";
import { listStockLevels } from "@/services/inventoryLedger";
import { listLocations } from "@/repositories/inventoryLocations";
import { listMyVanActivity, listVehiclesById } from "@/repositories/myVan";
import { getRepositoryContext } from "@/repositories/supabaseContext";
import { listVehicleOperators } from "@/repositories/vehicleOperators";

import type { VehicleStatus } from "../types/ledger";
import {
  buildMyVanActivity,
  buildMyVanCards,
  buildMyVanPickLines,
  locationWasCounted,
  MY_VAN_ACTIVITY_SCAN,
  NO_LOCATION_COPY,
  pickMyVanAssignment,
  RETIRED_VAN_COPY,
  SHOP_UNRESOLVED_COPY,
  showRecountSection,
  showRestockSection,
  UNCOUNTED_VAN_COPY,
  vanIsOpen,
  type MyVanActivityItem,
  type MyVanCard,
  type MyVanPickLine,
} from "../utils/myVanView";
import { orderCountSheet, type CountSheetItem } from "../utils/countSheet";
import { resolveShopLocation } from "../utils/parRules";
import { getInventoryAccess } from "./inventoryAccess";

export interface MyVanAssignmentOption {
  vehicleId: string;
  name: string;
  isHome: boolean;
  status: VehicleStatus;
}

export interface MyVanRecountItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  onHand: number;
  minQty: number | null;
}

export interface MyVanLoaded {
  canOpenInventory: boolean;
  assignments: MyVanAssignmentOption[];
  selected: null | {
    vehicleId: string;
    name: string;
    plate: string | null;
    status: VehicleStatus;
    counted: boolean;
    open: boolean;
    closedMessage: string | null;
    uncountedMessage: string | null;
    shopName: string | null;
    shopReady: boolean;
    shopMessage: string | null;
    showRestock: boolean;
    showRecount: boolean;
    cards: MyVanCard[];
    pickLines: MyVanPickLine[];
    recountItems: MyVanRecountItem[];
    activity: MyVanActivityItem[];
  };
}

/**
 * The signed-in person's vans, from vehicle_operators.
 * Cost is never loaded. Shop on-hand is attached only to pick lines.
 * Another van's stock is not included.
 */
export async function loadMyVan(requestedVehicleId: string | null): Promise<MyVanLoaded> {
  const access = await getInventoryAccess();
  const { userId } = await getRepositoryContext();
  // Technicians can read their own stock, and still cannot open /inventory.
  const canOpenInventory = access.role !== "tech" && access.canViewStock;
  const empty: MyVanLoaded = { canOpenInventory, assignments: [], selected: null };
  if (!userId) return empty;

  const operators = (await listVehicleOperators()).filter((row) => row.userId === userId);
  const vehicles = await listVehiclesById(operators.map((row) => row.vehicleId));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const assignments = operators
    .filter((row) => vehicleById.has(row.vehicleId))
    .map((row) => {
      const vehicle = vehicleById.get(row.vehicleId)!;
      return {
        vehicleId: vehicle.id,
        name: vehicle.name,
        isHome: row.isHome,
        status: vehicle.status,
      };
    });
  const selectedRef = pickMyVanAssignment(assignments, requestedVehicleId);
  if (!selectedRef) return { ...empty, assignments };

  const vehicle = vehicleById.get(selectedRef.vehicleId)!;
  const [locations, items, activity] = await Promise.all([
    listLocations(false),
    listCatalogItems({ includeInactive: true, facet: "stockable", limit: 1000 }, { canSeeCost: false }),
    listMyVanActivity(MY_VAN_ACTIVITY_SCAN),
  ]);
  const location = locations.find((row) => row.type === "van" && row.vehicleId === vehicle.id) ?? null;
  const open = location != null && vanIsOpen(vehicle.status, location.isActive);
  const counted = location != null && locationWasCounted(activity, location.id);
  const shop = location ? resolveShopLocation(location, locations) : null;

  const vanLevels = location ? await listStockLevels({ locationId: location.id }) : [];
  const hasPar = vanLevels.some((level) => level.minQty != null);
  const showRestock = showRestockSection({ open, counted, hasPar });
  const shopLevels = showRestock && shop ? await listStockLevels({ locationId: shop.id }) : [];
  const scopedLevels = [
    ...vanLevels.map((level) => ({
      itemId: level.itemId,
      locationId: location!.id,
      onHand: level.onHand,
      minQty: level.minQty,
      maxQty: level.maxQty,
    })),
    ...shopLevels.map((level) => ({
      itemId: level.itemId,
      locationId: shop!.id,
      onHand: level.onHand,
      minQty: level.minQty,
      maxQty: level.maxQty,
    })),
  ];

  const cards = buildMyVanCards(items, vanLevels, counted);
  const pickLines =
    location == null
      ? []
      : buildMyVanPickLines({
          open,
          counted,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          locationId: location.id,
          shopLocationId: shop?.id ?? null,
          shopLocationName: shop?.name ?? null,
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            unit: item.unit,
            isActive: item.isActive,
            isStockable: item.isStockable,
          })),
          levels: scopedLevels,
        });

  const showRecount = showRecountSection({ open, counted });
  const names = new Map(items.map((item) => [item.id, item.name]));
  const activityItems = location ? buildMyVanActivity(activity, location.id, names) : [];

  const recountItems: MyVanRecountItem[] = showRecount
    ? orderCountSheet(
        items
          .filter((item) => item.isActive && item.isStockable)
          .map((item) => {
            const level = vanLevels.find((row) => row.itemId === item.id);
            const sheet: CountSheetItem = {
              id: item.id,
              name: item.name,
              sku: item.sku,
              unit: item.unit,
              onHand: level?.onHand ?? 0,
              minQty: level?.minQty ?? null,
              maxQty: level?.maxQty ?? null,
            };
            return sheet;
          }),
      ).map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        onHand: item.onHand,
        minQty: item.minQty,
      }))
    : [];

  let closedMessage: string | null = null;
  if (vehicle.status === "retired") closedMessage = RETIRED_VAN_COPY;
  else if (!location || !location.isActive) closedMessage = NO_LOCATION_COPY;

  return {
    canOpenInventory,
    assignments,
    selected: {
      vehicleId: vehicle.id,
      name: vehicle.name,
      plate: vehicle.plate,
      status: vehicle.status,
      counted,
      open,
      closedMessage,
      uncountedMessage: open && !counted ? UNCOUNTED_VAN_COPY : null,
      shopName: shop?.name ?? null,
      shopReady: shop != null,
      shopMessage: showRestock && !shop ? SHOP_UNRESOLVED_COPY : null,
      showRestock,
      showRecount,
      cards,
      pickLines,
      recountItems,
      activity: activityItems,
    },
  };
}
