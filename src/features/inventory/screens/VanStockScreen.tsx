import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck } from "lucide-react";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTE_BUILDERS, ROUTES } from "@/lib/routes";

import { EnsureVanLocationButton } from "../components/EnsureVanLocationButton";
import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { SearchParamInput } from "../components/SearchParamControls";
import { firstParam, getInventoryAccess } from "../server/inventoryAccess";
import { loadVanContext } from "../server/loadVanContext";
import { buildStockRows } from "../utils/stockView";

const VEHICLE_STATUS = {
  active: { label: "Active", variant: "success" },
  out_of_service: { label: "Out of service", variant: "warning" },
  retired: { label: "Retired", variant: "neutral" },
} as const;

const UNCOUNTED_BANNER =
  "This van has not been counted in yet. Set pars if you want, then count what is actually on the truck. Restock alerts stay off until that count is posted.";

interface VanStockScreenProps {
  vehicleId: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function vanQuery(vehicleId: string, search: string, below: boolean): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (below) params.set("below", "1");
  const query = params.toString();
  const path = ROUTE_BUILDERS.INVENTORY_VAN(vehicleId);
  return query ? `${path}?${query}` : path;
}

/** Office view of one van: on-hand next to par. Low signals stay off until the first count-in. */
export async function VanStockScreen({ vehicleId, searchParams }: VanStockScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canViewStock) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Van stock is not available for your role" showHomeLink />
      </InventoryFrame>
    );
  }

  const params = (await searchParams) ?? {};
  const search = firstParam(params.q) ?? "";
  const belowRequested = firstParam(params.below) === "1";

  let context;
  try {
    context = await loadVanContext(vehicleId);
  } catch (error) {
    if ((error as { status?: number }).status === 404) notFound();
    throw error;
  }

  const { vehicle, location, crewName, counted, items, levels, operators, people } = context;
  const status = VEHICLE_STATUS[vehicle.status];
  const canEditPars = access.canEditPars && location?.isActive === true && vehicle.status !== "retired";
  const names = new Map(people.map((person) => [person.id, person.name]));
  const openedBy = operators.map((row) => names.get(row.userId) ?? "Inactive teammate");

  const rows = buildStockRows(items, levels, search);
  const visible = counted && belowRequested ? rows.filter((row) => row.belowMin) : rows;
  const ordered = [...visible].sort((a, b) => {
    if (counted && a.belowMin !== b.belowMin) return a.belowMin ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const actions = location ? (
    <>
      <Link
        href={`${ROUTES.INVENTORY_RESTOCK}?van=${vehicle.id}`}
        className="btn-secondary inline-flex min-h-11 items-center rounded-atlas-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
      >
        Needs restock
      </Link>
      {canEditPars ? (
        <Link
          href={ROUTE_BUILDERS.INVENTORY_VAN_PARS(vehicle.id)}
          className="btn-primary inline-flex min-h-11 items-center rounded-atlas-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          Edit pars
        </Link>
      ) : null}
    </>
  ) : null;

  return (
    <InventoryFrame
      title={vehicle.name}
      description="On hand next to the par for this van."
      actions={actions}
    >
      <SectionCard
        title="On the truck"
        description={crewName ? `Crew: ${crewName}` : "No crew is assigned. The crew link stays on the van, separate from who opens it on the phone."}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
            {vehicle.plate ? <span className="text-sm text-muted">Plate {vehicle.plate}</span> : null}
            <span className="text-sm text-muted">{crewName ?? "No crew"}</span>
            {openedBy.length > 0 ? <span className="text-sm text-muted">Opened by {openedBy.join(", ")}</span> : null}
          </div>

          {!location ? (
            <EmptyState
              icon={<Truck className="h-5 w-5" aria-hidden="true" />}
              title="This van has no stock location"
              description="Create the stock location to set pars and count what is on the truck. The van itself is already saved."
              action={access.canEditVehicles ? <EnsureVanLocationButton vehicleId={vehicle.id} /> : undefined}
            />
          ) : (
            <>
              {!counted ? (
                <p className="rounded-atlas-md border border-default bg-surface-elevated px-4 py-3 text-sm leading-6 text-primary">
                  {UNCOUNTED_BANNER}
                </p>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <SearchParamInput param="q" label="Search van stock" placeholder="Search name, SKU, brand…" initialValue={search} />
                {counted ? (
                  <Link
                    href={vanQuery(vehicle.id, search, !belowRequested)}
                    aria-pressed={belowRequested}
                    className={
                      belowRequested
                        ? "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium status-info"
                        : "inline-flex min-h-11 items-center rounded-full border border-default px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-elevated hover:text-primary"
                    }
                  >
                    Below par
                  </Link>
                ) : null}
              </div>
              {ordered.length === 0 ? (
                <EmptyState
                  title={search || belowRequested ? "No items match" : "No stockable items yet"}
                  description={
                    search || belowRequested
                      ? "Try a different name, SKU, or filter."
                      : "Add stockable items in the Catalog. A zero stays visible once the item exists."
                  }
                />
              ) : (
                <InventoryTable
                  caption={`On-hand stock on ${vehicle.name}`}
                  headers={[
                    { label: "Item" },
                    { label: "SKU" },
                    { label: "On hand", align: "right" },
                    { label: "Par", align: "right" },
                    { label: "Fill to", align: "right" },
                    { label: "Status" },
                  ]}
                >
                  {ordered.map((row) => {
                    const showBelow = counted && row.belowMin;
                    const showNegative = row.onHand < 0;
                    return (
                      <tr key={row.itemId} className="transition-colors hover:bg-surface-elevated">
                        <Td>
                          <Link
                            href={ROUTE_BUILDERS.INVENTORY_ITEM(row.itemId)}
                            className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                          >
                            {row.name}
                          </Link>
                          {row.brand ? <span className="ml-2 text-xs text-muted">{row.brand}</span> : null}
                        </Td>
                        <Td className="text-muted">{row.sku ?? "—"}</Td>
                        <Td align="right">
                          <span className="text-lg font-semibold">{row.onHand}</span>
                          {row.unit ? <span className="ml-1 text-xs text-muted">{row.unit}</span> : null}
                        </Td>
                        <Td align="right" className="text-muted">{row.minQty ?? "—"}</Td>
                        <Td align="right" className="text-muted">{row.maxQty ?? "—"}</Td>
                        <Td>
                          <span className="flex flex-wrap gap-1">
                            {showNegative ? <StatusBadge variant="danger">Negative</StatusBadge> : null}
                            {showBelow ? <StatusBadge variant="warning">Below par</StatusBadge> : null}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </InventoryTable>
              )}
            </>
          )}
        </div>
      </SectionCard>
    </InventoryFrame>
  );
}
