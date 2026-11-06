import Link from "next/link";
import { History } from "lucide-react";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTE_BUILDERS } from "@/lib/routes";
import { listCatalogItems } from "@/services/inventoryCatalog";
import { listLedger } from "@/services/inventoryLedger";
import { listLocations, listVehicles } from "@/services/inventoryLocations";

import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { ReverseDialog } from "../components/ReverseDialog";
import { SearchParamInput, SearchParamSelect } from "../components/SearchParamControls";
import { firstParam, getInventoryAccess } from "../server/inventoryAccess";
import { TXN_TYPES } from "../types/ledger";
import {
  canReverseEntry,
  formatLedgerTime,
  formatQtyDelta,
  parseTxnType,
  reversedEntryIds,
  summarizeEntry,
  TXN_LABELS,
} from "../utils/activityView";
import { buildLocationOptions } from "../utils/stockView";

export interface ActivityScreenProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 200;
const ALL = "";

/** Append-only ledger history. Corrections are reversals (opposite entries with a reason), never edits. */
export async function ActivityScreen({ searchParams }: ActivityScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canViewLedger) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Activity is not available for your role" />
      </InventoryFrame>
    );
  }

  const params = (await searchParams) ?? {};
  const itemId = firstParam(params.item);
  const locationId = firstParam(params.location);
  const jobId = firstParam(params.job);
  const txnType = parseTxnType(firstParam(params.type));

  const [entries, items, locations, vehicles] = await Promise.all([
    listLedger({ itemId, locationId, jobId, txnType, limit: PAGE_SIZE }),
    listCatalogItems({ includeInactive: true, limit: 1000 }, { canSeeCost: false }),
    listLocations(true),
    listVehicles(true),
  ]);

  const itemNames = new Map(items.map((item) => [item.id, item.name]));
  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  const locationOptions = buildLocationOptions(locations, vehicles);
  const reversed = reversedEntryIds(entries);

  const filtered = Boolean(itemId || locationId || jobId || txnType);

  return (
    <InventoryFrame title="Inventory" description="Every change to stock, newest first. History is never edited; corrections are reversals.">
      <SectionCard title="Activity" description={`Showing the latest ${entries.length} ${entries.length === 1 ? "entry" : "entries"}.`}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <SearchParamSelect
              param="item"
              label="Item"
              value={itemId ?? ALL}
              clearValue={ALL}
              options={[{ value: ALL, label: "All items" }, ...items.map((item) => ({ value: item.id, label: item.name }))]}
            />
            <SearchParamSelect
              param="location"
              label="Location"
              value={locationId ?? ALL}
              clearValue={ALL}
              options={[{ value: ALL, label: "All locations" }, ...locationOptions.map((option) => ({ value: option.id, label: option.label }))]}
            />
            <SearchParamSelect
              param="type"
              label="Type"
              value={txnType ?? ALL}
              clearValue={ALL}
              options={[{ value: ALL, label: "All types" }, ...TXN_TYPES.map((type) => ({ value: type, label: TXN_LABELS[type] }))]}
            />
            <SearchParamInput param="job" label="Filter by job id" placeholder="Job id" initialValue={jobId ?? ""} />
          </div>

          {entries.length === 0 ? (
            <EmptyState
              icon={<History className="h-5 w-5" aria-hidden="true" />}
              title={filtered ? "No entries match these filters" : "No activity yet"}
              description={filtered ? "Clear a filter to see more history." : "Receiving, counting, adjusting and transferring stock all show up here."}
            />
          ) : (
            <InventoryTable
              caption="Inventory ledger"
              headers={[
                { label: "When" },
                { label: "Type" },
                { label: "Item" },
                { label: "Location" },
                { label: "Qty", align: "right" },
                { label: "Job / reason" },
                { label: "Actions", srOnly: true },
              ]}
            >
              {entries.map((entry) => {
                const itemName = itemNames.get(entry.itemId) ?? "Unknown item";
                const locationName = locationNames.get(entry.locationId) ?? "Unknown location";
                return (
                  <tr key={entry.id} className="transition-colors hover:bg-surface-elevated">
                    <Td className="whitespace-nowrap text-muted">{formatLedgerTime(entry.createdAt)}</Td>
                    <Td>
                      <span className="whitespace-nowrap">{TXN_LABELS[entry.txnType]}</span>
                      {reversed.has(entry.id) ? <StatusBadge variant="neutral" className="ml-2">Reversed</StatusBadge> : null}
                    </Td>
                    <Td>
                      <Link href={ROUTE_BUILDERS.INVENTORY_ITEM(entry.itemId)} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                        {itemName}
                      </Link>
                    </Td>
                    <Td className="text-muted">{locationName}</Td>
                    <Td align="right">
                      <span className={entry.qtyDelta < 0 ? "text-[var(--danger)]" : undefined}>{formatQtyDelta(entry.qtyDelta)}</span>
                    </Td>
                    <Td className="max-w-xs text-muted">
                      {entry.jobId ? (
                        <Link href={ROUTE_BUILDERS.JOB_DETAIL(entry.jobId)} className="mr-2 text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                          Job
                        </Link>
                      ) : null}
                      {entry.reason ?? (entry.jobId ? "" : "—")}
                    </Td>
                    <Td align="right">
                      {access.canPostLedger && canReverseEntry(entry, reversed) ? (
                        <ReverseDialog
                          transactionId={entry.id}
                          summary={summarizeEntry({ txnType: entry.txnType, qtyDelta: entry.qtyDelta, itemName, locationName })}
                        />
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </InventoryTable>
          )}
        </div>
      </SectionCard>
    </InventoryFrame>
  );
}
