import Link from "next/link";
import { MapPin } from "lucide-react";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTE_BUILDERS, ROUTES } from "@/lib/routes";
import { listCatalogItems } from "@/services/inventoryCatalog";
import { listStockLevels } from "@/services/inventoryLedger";
import { listLocations, listVehicles } from "@/services/inventoryLocations";

import { AdjustCountDialog } from "../components/AdjustCountDialog";
import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { ReceiveDialog } from "../components/ReceiveDialog";
import { SearchParamInput, SearchParamSelect } from "../components/SearchParamControls";
import type { StockDialogData } from "../components/StockDialogTypes";
import { TransferDialog } from "../components/TransferDialog";
import { firstParam, getInventoryAccess } from "../server/inventoryAccess";
import {
  buildLocationOptions,
  buildStockRows,
  countFlags,
  groupStockByLocation,
  resolveSelectedLocation,
} from "../utils/stockView";

export interface StockScreenProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Stock: on-hand per item at one location (warehouse, a van, or quarantine).
 * Server-rendered; cost is never fetched or shown here.
 */
export async function StockScreen({ searchParams }: StockScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canViewStock) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Stock is not available for your role" showHomeLink />
      </InventoryFrame>
    );
  }

  const params = (await searchParams) ?? {};
  const search = firstParam(params.q) ?? "";

  const [locations, vehicles, items, levels] = await Promise.all([
    listLocations(false),
    listVehicles(false),
    listCatalogItems({ includeInactive: true, limit: 1000 }, { canSeeCost: false }),
    listStockLevels(),
  ]);

  const options = buildLocationOptions(locations, vehicles);
  const selectedId = resolveSelectedLocation(options, firstParam(params.location));

  if (!selectedId) {
    return (
      <InventoryFrame title="Inventory" description="On-hand stock by location.">
        <EmptyState
          icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
          title="No stock locations yet"
          description="Add a warehouse and your vans under Locations & vans. Stock is counted per location."
          action={<Link href={ROUTES.INVENTORY_LOCATIONS} className="text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">Go to Locations & vans</Link>}
        />
      </InventoryFrame>
    );
  }

  const byLocation = groupStockByLocation(levels);
  const rows = buildStockRows(items, byLocation.get(selectedId) ?? [], search);
  const flags = countFlags(rows);
  const selected = options.find((option) => option.id === selectedId);
  const selectedLocation = locations.find((location) => location.id === selectedId);
  const vanVehicleId = selected?.type === "van" ? selectedLocation?.vehicleId : null;

  const dialogData: StockDialogData = {
    items: items
      .filter((item) => item.isStockable && item.isActive)
      .map((item) => ({ id: item.id, name: item.name, sku: item.sku, unit: item.unit, trackingMode: item.trackingMode })),
    locations: options.map((option) => ({ id: option.id, label: option.label })),
    stock: levels.map((level) => ({ itemId: level.itemId, locationId: level.locationId, onHand: level.onHand })),
  };

  const actions = access.canPostLedger ? (
    <>
      <ReceiveDialog items={dialogData.items} locations={dialogData.locations} defaultLocationId={selectedId} canSetCost={access.canSeeCost} />
      <AdjustCountDialog {...dialogData} defaultLocationId={selectedId} />
      <TransferDialog {...dialogData} defaultFromLocationId={selectedId} />
    </>
  ) : undefined;

  return (
    <InventoryFrame title="Inventory" description="On-hand stock by location." actions={actions}>
      <SectionCard title={selected?.label ?? "Stock"} description="Quantities come from the ledger; change them with Receive, Adjust / Count or Transfer.">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <SearchParamSelect
              param="location"
              label="Location"
              value={selectedId}
              options={options.map((option) => ({ value: option.id, label: option.label }))}
            />
            <SearchParamInput param="q" label="Search stock" placeholder="Search name, SKU, brand…" initialValue={search} />
            {vanVehicleId ? (
              <Link
                href={ROUTE_BUILDERS.INVENTORY_VAN(vanVehicleId)}
                className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                Open van stock
              </Link>
            ) : null}
          </div>

          {flags.negative > 0 || flags.zero > 0 ? (
            <p className="flex flex-wrap gap-2 text-sm" aria-live="polite">
              {flags.negative > 0 ? <StatusBadge variant="danger">{flags.negative} negative</StatusBadge> : null}
              {flags.zero > 0 ? <StatusBadge variant="warning">{flags.zero} out of stock</StatusBadge> : null}
            </p>
          ) : null}

          {rows.length === 0 ? (
            <EmptyState
              title={search ? "No items match your search" : "No stockable items yet"}
              description={search ? "Try a different name, SKU or brand." : "Add stockable items in the Catalog, then receive stock here."}
            />
          ) : (
            <InventoryTable
              caption={`On-hand stock at ${selected?.label ?? "location"}`}
              headers={[{ label: "Item" }, { label: "SKU" }, { label: "On hand", align: "right" }, { label: "Min", align: "right" }, { label: "Status" }]}
            >
              {rows.map((row) => (
                <tr key={row.itemId} className="transition-colors hover:bg-surface-elevated">
                  <Td>
                    <Link href={ROUTE_BUILDERS.INVENTORY_ITEM(row.itemId)} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                      {row.name}
                    </Link>
                    {row.brand ? <span className="ml-2 text-xs text-muted">{row.brand}</span> : null}
                  </Td>
                  <Td className="text-muted">{row.sku ?? "—"}</Td>
                  <Td align="right">
                    <span className="font-semibold">{row.onHand}</span>
                    {row.unit ? <span className="ml-1 text-xs text-muted">{row.unit}</span> : null}
                  </Td>
                  <Td align="right" className="text-muted">{row.minQty ?? "—"}</Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {row.flag === "negative" ? <StatusBadge variant="danger">Negative</StatusBadge> : null}
                      {row.flag === "zero" ? <StatusBadge variant="warning">Out</StatusBadge> : null}
                      {row.belowMin ? <StatusBadge variant="warning">Low</StatusBadge> : null}
                    </span>
                  </Td>
                </tr>
              ))}
            </InventoryTable>
          )}
        </div>
      </SectionCard>
    </InventoryFrame>
  );
}
