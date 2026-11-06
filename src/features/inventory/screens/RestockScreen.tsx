import Link from "next/link";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTE_BUILDERS, ROUTES } from "@/lib/routes";
import { listCatalogItems } from "@/services/inventoryCatalog";
import { listCountedLocationIds, listStockLevels } from "@/services/inventoryLedger";
import { listLocations, listVehicles } from "@/services/inventoryLocations";

import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { firstParam, getInventoryAccess } from "../server/inventoryAccess";
import { negativeOnHandWarning, projectedOnHand } from "../utils/stockView";
import {
  awaitingCountCopy,
  buildRestockList,
  resolveShopLocation,
  restockOmitCopy,
  type RestockVanInput,
} from "../utils/parRules";

interface RestockScreenProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Office pick list. Read-only in this pass: posting the shop-to-van transfer
 * is the next inventory change. Cost is never loaded.
 */
export async function RestockScreen({ searchParams }: RestockScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canViewStock) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Needs restock is not available for your role" showHomeLink />
      </InventoryFrame>
    );
  }

  const params = (await searchParams) ?? {};
  const focusVan = firstParam(params.van);

  const [vehicles, locations, items, levels] = await Promise.all([
    listVehicles(true),
    listLocations(true),
    listCatalogItems({ includeInactive: true, limit: 1000 }, { canSeeCost: false }),
    listStockLevels(),
  ]);

  const locationByVehicle = new Map(
    locations.filter((location) => location.vehicleId).map((location) => [location.vehicleId as string, location]),
  );
  const vanLocationIds = [...locationByVehicle.values()].map((location) => location.id);
  const countedIds = await listCountedLocationIds(vanLocationIds);

  const vans: RestockVanInput[] = vehicles.map((vehicle) => {
    const location = locationByVehicle.get(vehicle.id) ?? null;
    const shop = location ? resolveShopLocation(location, locations) : null;
    return {
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      vehicleActive: vehicle.status === "active",
      locationId: location?.id ?? null,
      locationActive: location?.isActive ?? false,
      counted: location != null && countedIds.has(location.id),
      shopLocationId: shop?.id ?? null,
      shopLocationName: shop?.name ?? null,
    };
  });

  const list = buildRestockList(
    vans,
    items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      isActive: item.isActive,
      isStockable: item.isStockable,
    })),
    levels.map((level) => ({
      itemId: level.itemId,
      locationId: level.locationId,
      onHand: level.onHand,
      minQty: level.minQty,
      maxQty: level.maxQty,
    })),
  );

  const lineCount = list.groups.reduce((sum, group) => sum + group.lines.length, 0);
  const waiting = awaitingCountCopy(list.awaitingCount);
  const focus = focusVan ? list.omitted.find((row) => row.vehicleId === focusVan) : undefined;
  const focusOnList = focusVan ? list.groups.some((group) => group.vehicleId === focusVan) : false;

  return (
    <InventoryFrame
      title="Inventory"
      description="Vans under par, and what to pull from the shop. The pull is not posted from this screen yet."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {lineCount > 0 ? <StatusBadge variant="warning">{lineCount} below par</StatusBadge> : null}
          <p className="text-sm text-muted">The pull is not posted from this screen yet.</p>
        </div>
        {waiting ? (
          <p className="rounded-atlas-md border border-default bg-surface-elevated px-4 py-3 text-sm leading-6 text-primary">
            {waiting}
          </p>
        ) : null}
        {focusVan && !focusOnList ? (
          <p className="rounded-atlas-md border border-default bg-surface-elevated px-4 py-3 text-sm leading-6 text-primary">
            {focus
              ? restockOmitCopy(focus.reason, focus.vehicleName)
              : "That van is not on the pick list."}{" "}
            <Link href={ROUTE_BUILDERS.INVENTORY_VAN(focusVan)} className="font-medium underline underline-offset-4">
              Open the van
            </Link>
          </p>
        ) : null}

        {list.groups.length === 0 ? (
          <EmptyState
            title="No vans need a restock"
            description={
              waiting
                ? "Pars on a van that has not been counted in stay off this list on purpose."
                : "A line shows up after a van has been counted and something is under its minimum."
            }
            action={
              <Link href={ROUTES.INVENTORY_LOCATIONS} className="text-sm font-medium text-accent hover:underline">
                Go to Locations & vans
              </Link>
            }
          />
        ) : (
          list.groups.map((group) => (
            <SectionCard
              key={group.vehicleId}
              title={group.vehicleName}
              description={
                group.shopLocationName
                  ? `Pull from ${group.shopLocationName}.`
                  : "Set the shop as this van's parent before anyone pulls parts."
              }
              actions={
                <Link
                  href={ROUTE_BUILDERS.INVENTORY_VAN(group.vehicleId)}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  Open van
                </Link>
              }
            >
              {!group.shopLocationId ? (
                <p className="mb-4 text-sm text-primary">Set the shop as this van&apos;s parent before anyone pulls parts.</p>
              ) : null}
              <InventoryTable
                caption={`Needs restock on ${group.vehicleName}`}
                headers={[
                  { label: "Item" },
                  { label: "On hand", align: "right" },
                  { label: "Minimum", align: "right" },
                  { label: "Suggested pull", align: "right" },
                  { label: "Shop on hand", align: "right" },
                  { label: "Status" },
                ]}
              >
                {group.lines.map((line) => {
                  const shopWarning =
                    line.shopOnHand != null && line.shopShort && group.shopLocationName
                      ? negativeOnHandWarning({
                          itemName: line.name,
                          locationName: group.shopLocationName,
                          projected: projectedOnHand(line.shopOnHand, -line.suggestedQty),
                        })
                      : null;
                  return (
                    <tr key={line.itemId} className="transition-colors hover:bg-surface-elevated">
                      <Td>
                        <span className="font-medium">{line.name}</span>
                        {line.sku ? <span className="ml-2 text-xs text-muted">{line.sku}</span> : null}
                      </Td>
                      <Td align="right">
                        <span className="font-semibold">{line.onHand}</span>
                        {line.unit ? <span className="ml-1 text-xs text-muted">{line.unit}</span> : null}
                      </Td>
                      <Td align="right" className="text-muted">{line.minQty}</Td>
                      <Td align="right">
                        <span className="font-semibold">{line.suggestedQty}</span>
                      </Td>
                      <Td align="right">
                        <span className="text-muted">{line.shopOnHand ?? "—"}</span>
                        {shopWarning ? <span className="mt-1 block text-xs status-warning">{shopWarning}</span> : null}
                      </Td>
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          {line.negative ? <StatusBadge variant="danger">Negative</StatusBadge> : null}
                          <StatusBadge variant="warning">Below par</StatusBadge>
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </InventoryTable>
            </SectionCard>
          ))
        )}
      </div>
    </InventoryFrame>
  );
}
