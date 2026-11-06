import { Truck } from "lucide-react";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { listCatalogItems } from "@/services/inventoryCatalog";
import { listLocations } from "@/services/inventoryLocations";
import { listArrivals } from "@/services/expectedArrivals";
import { todayInCompanyTimeZone } from "@/lib/timezone";

import { ArrivalDialog } from "../components/ArrivalDialog";
import { ArrivalRowActions } from "../components/ArrivalRowActions";
import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { getInventoryAccess } from "../server/inventoryAccess";
import { formatQty, shortDate } from "../utils/readiness";

/**
 * Expected arrivals: what is on its way. Readiness counts an arrival only when it lands
 * early enough before the job. Marking one received posts the ledger receive.
 */
export async function ArrivalsScreen() {
  const access = await getInventoryAccess();
  if (!access.canViewArrivals) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Arrivals are not available for your role" showHomeLink />
      </InventoryFrame>
    );
  }

  const canEdit = access.canEditArrivals;
  const [arrivals, locations, items] = await Promise.all([
    listArrivals(true),
    listLocations(false),
    canEdit ? listCatalogItems({ includeInactive: false, limit: 1000 }, { canSeeCost: false }) : Promise.resolve([]),
  ]);

  const today = todayInCompanyTimeZone();
  const open = arrivals.filter((arrival) => arrival.status === "expected").sort((a, b) => a.etaDate.localeCompare(b.etaDate));
  const history = arrivals.filter((arrival) => arrival.status !== "expected").slice(0, 25);

  const itemOptions = items
    .filter((item) => item.isStockable && item.isActive)
    .map((item) => ({ id: item.id, name: item.name, sku: item.sku, unit: item.unit }));
  const locationOptions = locations
    .filter((location) => location.type === "warehouse" && location.isActive)
    .map((location) => ({ id: location.id, label: location.name }));

  return (
    <InventoryFrame
      title="Inventory"
      description="Stock that is on its way. Jobs short on an item count it as coming when the date is early enough."
      actions={canEdit ? <ArrivalDialog items={itemOptions} locations={locationOptions} /> : undefined}
    >
      <SectionCard title="On its way" description="Marking an arrival received adds it to stock and tops up waiting jobs, soonest job first.">
        {open.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-5 w-5" aria-hidden="true" />}
            title="Nothing expected"
            description="Add an arrival when you order stock, so the dispatch board can tell which installs are covered."
          />
        ) : (
          <InventoryTable
            caption="Expected arrivals"
            headers={[
              { label: "Item" },
              { label: "Qty", align: "right" },
              { label: "Expected" },
              { label: "Goes to" },
              { label: "Note" },
              { label: "Actions", srOnly: true },
            ]}
          >
            {open.map((arrival) => (
              <tr key={arrival.id} className="transition-colors hover:bg-surface-elevated">
                <Td className="font-medium text-primary">
                  {arrival.itemName}
                  {arrival.itemSku ? <span className="ml-2 text-xs text-muted">{arrival.itemSku}</span> : null}
                </Td>
                <Td align="right">
                  {formatQty(arrival.qty)} <span className="text-muted">{arrival.unit ?? ""}</span>
                </Td>
                <Td>
                  {shortDate(arrival.etaDate)}
                  {arrival.etaDate < today ? (
                    <StatusBadge variant="warning" className="ml-2">
                      Overdue
                    </StatusBadge>
                  ) : null}
                </Td>
                <Td className="text-muted">
                  {arrival.locationName}
                  {arrival.forJobLabel ? ` · for ${arrival.forJobLabel}` : ""}
                </Td>
                <Td className="text-muted">{arrival.supplierNote ?? ""}</Td>
                <Td align="right">
                  {canEdit ? <ArrivalRowActions arrival={arrival} items={itemOptions} locations={locationOptions} /> : null}
                </Td>
              </tr>
            ))}
          </InventoryTable>
        )}
      </SectionCard>

      {history.length > 0 ? (
        <SectionCard title="Recently closed" description="Received and cancelled arrivals stay as history.">
          <InventoryTable
            caption="Closed arrivals"
            headers={[{ label: "Item" }, { label: "Qty", align: "right" }, { label: "Expected" }, { label: "Result" }]}
          >
            {history.map((arrival) => (
              <tr key={arrival.id}>
                <Td>{arrival.itemName}</Td>
                <Td align="right">{formatQty(arrival.qty)}</Td>
                <Td className="text-muted">{shortDate(arrival.etaDate)}</Td>
                <Td>
                  <StatusBadge variant={arrival.status === "received" ? "success" : "neutral"}>
                    {arrival.status === "received" ? "Received" : "Cancelled"}
                  </StatusBadge>
                </Td>
              </tr>
            ))}
          </InventoryTable>
        </SectionCard>
      ) : null}
    </InventoryFrame>
  );
}
