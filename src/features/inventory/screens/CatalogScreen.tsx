import Link from "next/link";
import { BookOpen } from "lucide-react";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTE_BUILDERS, ROUTES } from "@/lib/routes";
import { listCatalogItems, listCategories } from "@/services/inventoryCatalog";

import { AddItemDialog } from "../components/AddItemDialog";
import { CatalogFilters } from "../components/CatalogFilters";
import { CategorySidebar } from "../components/CategorySidebar";
import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { firstParam, getInventoryAccess } from "../server/inventoryAccess";
import {
  countItemsByCategory,
  describeFacets,
  filterCatalogItems,
  flattenCategoryTree,
  parseCatalogFacet,
} from "../utils/catalogView";
import { formatCents } from "../utils/money";

export interface CatalogScreenProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Catalog: the one item master. Server-rendered; the cost column and the cost
 * query exist only when the role may read catalog_item_costs.
 */
export async function CatalogScreen({ searchParams }: CatalogScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canViewCatalog) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="The catalog is not available for your role" />
      </InventoryFrame>
    );
  }

  const params = (await searchParams) ?? {};
  const search = firstParam(params.q) ?? "";
  const facet = parseCatalogFacet(firstParam(params.facet));

  const [categories, allItems] = await Promise.all([
    listCategories(false),
    listCatalogItems({ includeInactive: true, limit: 1000 }, { canSeeCost: access.canSeeCost }),
  ]);

  const requestedCategory = firstParam(params.category) ?? null;
  const categoryId = requestedCategory && categories.some((category) => category.id === requestedCategory) ? requestedCategory : null;
  const flatCategories = flattenCategoryTree(categories);
  const items = filterCatalogItems(allItems, categories, { search, facet, categoryId });
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const headers = [
    { label: "Item" },
    { label: "Category" },
    { label: "Type" },
    { label: "Sell price", align: "right" as const },
    ...(access.canSeeCost ? [{ label: "Cost", align: "right" as const }] : []),
    { label: "Status" },
  ];

  return (
    <InventoryFrame
      title="Inventory"
      description="One catalog for everything you sell and everything you stock."
      actions={access.canCreateItems ? <AddItemDialog categories={flatCategories} canSetCost={access.canEditCost} defaultCategoryId={categoryId} /> : undefined}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <SectionCard title="Categories">
            <CategorySidebar
              baseHref={ROUTES.INVENTORY_CATALOG}
              categories={flatCategories}
              counts={countItemsByCategory(allItems)}
              selectedId={categoryId}
              current={{ q: search, facet }}
            />
          </SectionCard>
        </aside>

        <SectionCard title="Catalog" description={`${items.length} ${items.length === 1 ? "item" : "items"}`}>
          <div className="space-y-4">
            <CatalogFilters search={search} facet={facet} />
            {items.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
                title={allItems.length === 0 ? "The catalog is empty" : "No items match these filters"}
                description={
                  allItems.length === 0
                    ? "Add your first item. An item can be sellable, stockable, or both."
                    : "Clear the search or pick a different category or filter."
                }
              />
            ) : (
              <InventoryTable caption="Catalog items" headers={headers}>
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-surface-elevated">
                    <Td>
                      <Link href={ROUTE_BUILDERS.INVENTORY_ITEM(item.id)} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                        {item.name}
                      </Link>
                      {item.sku ? <span className="ml-2 text-xs text-muted">{item.sku}</span> : null}
                    </Td>
                    <Td className="text-muted">{(item.categoryId && categoryNames.get(item.categoryId)) || "—"}</Td>
                    <Td className="text-muted">{describeFacets(item)}</Td>
                    <Td align="right">{item.isSellable ? formatCents(item.sellPriceCents) : "—"}</Td>
                    {access.canSeeCost ? <Td align="right">{formatCents(item.cost?.unitCostCents)}</Td> : null}
                    <Td>{item.isActive ? null : <StatusBadge variant="neutral">Inactive</StatusBadge>}</Td>
                  </tr>
                ))}
              </InventoryTable>
            )}
          </div>
        </SectionCard>
      </div>
    </InventoryFrame>
  );
}
