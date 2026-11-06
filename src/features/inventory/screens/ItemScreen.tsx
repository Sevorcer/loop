import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTES } from "@/lib/routes";
import { getCatalogItem, listCategories, listPriceTiers } from "@/services/inventoryCatalog";
import { listStockLevels } from "@/services/inventoryLedger";
import { listLocations, listVehicles } from "@/services/inventoryLocations";

import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { ItemEditForm } from "../components/ItemEditForm";
import { PriceTiersEditor } from "../components/PriceTiersEditor";
import type { CatalogItemWithCost, CatalogPriceTier } from "../types/catalog";
import type { InventoryLocation, StockLevel, Vehicle } from "../types/ledger";
import { getInventoryAccess } from "../server/inventoryAccess";
import { flattenCategoryTree } from "../utils/catalogView";
import { formatCents } from "../utils/money";
import { buildLocationOptions, computeStockFlag } from "../utils/stockView";

interface ItemScreenProps {
  itemId: string;
}

/** One catalog item: details, sell facet + price tiers, stock facet, cost (only for roles that may see it), on-hand per location. */
export async function ItemScreen({ itemId }: ItemScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canViewCatalog) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="The catalog is not available for your role" />
      </InventoryFrame>
    );
  }

  let item: CatalogItemWithCost;
  try {
    item = await getCatalogItem(itemId, { canSeeCost: access.canSeeCost });
  } catch (error) {
    if ((error as { status?: number }).status === 404) notFound();
    throw error;
  }

  const showStock = item.isStockable && access.canViewStock;
  const [categories, tiers, locations, vehicles, levels] = await Promise.all([
    listCategories(false),
    item.isSellable ? listPriceTiers(item.id) : Promise.resolve([] as CatalogPriceTier[]),
    showStock ? listLocations(false) : Promise.resolve([] as InventoryLocation[]),
    showStock ? listVehicles(false) : Promise.resolve([] as Vehicle[]),
    showStock ? listStockLevels({ itemId: item.id }) : Promise.resolve([] as StockLevel[]),
  ]);

  const stockRows = showStock
    ? buildLocationOptions(locations, vehicles).map((option) => {
        const onHand = levels.find((level) => level.locationId === option.id)?.onHand ?? 0;
        return { ...option, onHand, flag: computeStockFlag(onHand) };
      })
    : [];

  return (
    <InventoryFrame
      title={item.name}
      description={[item.brand, item.model, item.sku].filter(Boolean).join(" · ") || undefined}
      actions={
        <Link
          href={ROUTES.INVENTORY_CATALOG}
          className="inline-flex min-h-11 items-center gap-2 rounded-atlas-md px-2 text-sm text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:min-h-0"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to catalog
        </Link>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <SectionCard
          title="Details"
          description="Sell, stock and cost settings for this item."
          actions={item.isActive ? undefined : <StatusBadge variant="neutral">Inactive</StatusBadge>}
        >
          <ItemEditForm
            item={item}
            categories={flattenCategoryTree(categories)}
            showCost={access.canSeeCost}
            canEditCost={access.canEditCost}
            canEdit={access.canEditItems}
          />
        </SectionCard>

        <div className="min-w-0 space-y-6">
          {item.isSellable ? (
            <SectionCard title="Price tiers" description="Flat-rate options, such as Good / Better / Best.">
              <PriceTiersEditor
                key={tiers.map((tier) => `${tier.id}:${tier.priceCents}:${tier.memberPriceCents ?? ""}:${tier.label}`).join("|")}
                itemId={item.id}
                tiers={tiers}
                canEdit={access.canEditPriceTiers}
                canRemoveSaved={access.canDeleteTiers}
              />
              <p className="mt-3 text-xs text-muted">Base price {formatCents(item.sellPriceCents)}</p>
            </SectionCard>
          ) : null}

          {showStock ? (
            <SectionCard title="On hand" description="Quantity at each location.">
              {stockRows.length === 0 ? (
                <p className="text-sm text-muted">No locations yet. Add a warehouse or van under Locations &amp; vans.</p>
              ) : (
                <InventoryTable
                  caption={`On-hand quantity of ${item.name} by location`}
                  headers={[{ label: "Location" }, { label: "On hand", align: "right" }, { label: "Status" }]}
                >
                  {stockRows.map((row) => (
                    <tr key={row.id}>
                      <Td>{row.label}</Td>
                      <Td align="right">
                        <span className="font-semibold">{row.onHand}</span>
                        {item.unit ? <span className="ml-1 text-xs text-muted">{item.unit}</span> : null}
                      </Td>
                      <Td>
                        {row.flag === "negative" ? <StatusBadge variant="danger">Negative</StatusBadge> : null}
                        {row.flag === "zero" ? <StatusBadge variant="warning">Out</StatusBadge> : null}
                      </Td>
                    </tr>
                  ))}
                </InventoryTable>
              )}
            </SectionCard>
          ) : null}
        </div>
      </div>
    </InventoryFrame>
  );
}
