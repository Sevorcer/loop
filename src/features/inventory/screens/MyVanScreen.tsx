import Link from "next/link";
import { Truck } from "lucide-react";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { PageHeader } from "@/components/atlas/PageHeader";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTES } from "@/lib/routes";

import { MyVanOnTruck } from "../components/MyVanOnTruck";
import { MyVanPickList } from "../components/MyVanPickList";
import { MyVanRecount } from "../components/MyVanRecount";
import { firstParam, getInventoryAccess } from "../server/inventoryAccess";
import { loadMyVan } from "../server/loadMyVan";
import { orderMyVanAssignments } from "../utils/myVanView";

interface MyVanScreenProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS = {
  active: { label: "Active", variant: "success" },
  out_of_service: { label: "Out of service", variant: "warning" },
  retired: { label: "Retired", variant: "neutral" },
} as const;

function vanHref(vehicleId: string): string {
  return `${ROUTES.INVENTORY_MY_VAN}?van=${vehicleId}`;
}

/**
 * Tech phone screen for the assigned van. Office tabs are not shown.
 * A direct visit by someone with no assignment gets the empty state.
 */
export async function MyVanScreen({ searchParams }: MyVanScreenProps) {
  const access = await getInventoryAccess();
  if (access.role === "sales" || access.role === "portal" || access.role == null) {
    return (
      <AccessDenied
        title="My van is not available for your role"
        description="Technicians open their own van here. The office uses Inventory."
        showHomeLink={access.role !== "portal"}
      />
    );
  }

  const params = (await searchParams) ?? {};
  const requested = firstParam(params.van) ?? null;
  const model = await loadMyVan(requested);
  const assignments = orderMyVanAssignments(model.assignments);
  const selected = model.selected;

  if (!selected) {
    return (
      <div className="space-y-6">
        <PageHeader title="My van" description="On hand, a recount, and what to pull from the shop." />
        <EmptyState
          icon={<Truck className="h-5 w-5" aria-hidden="true" />}
          title="You're not assigned to a van yet"
          description="The office assigns you on Locations & vans."
          action={
            model.canOpenInventory ? (
              <Link href={ROUTES.INVENTORY} className="text-sm font-medium text-accent hover:underline">
                Open Inventory
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const status = STATUS[selected.status];
  const pickKey = selected.pickLines.map((line) => `${line.itemId}:${line.onHand}`).join("|");
  const recountKey = selected.recountItems.map((item) => `${item.id}:${item.onHand}`).join("|");

  return (
    <div className="space-y-6">
      <PageHeader title={selected.name} description="On hand next to the par for your van." />

      {assignments.length > 1 ? (
        <nav aria-label="Your vans" className="flex flex-col gap-2">
          {assignments.map((assignment) => {
            const current = assignment.vehicleId === selected.vehicleId;
            return (
              <Link
                key={assignment.vehicleId}
                href={vanHref(assignment.vehicleId)}
                aria-current={current ? "page" : undefined}
                className={
                  current
                    ? "inline-flex min-h-11 items-center rounded-atlas-md border px-4 text-sm font-medium status-info"
                    : "inline-flex min-h-11 items-center rounded-atlas-md border border-default px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-elevated hover:text-primary"
                }
              >
                {assignment.name}
                {assignment.isHome ? " · Home" : ""}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <SectionCard title="On the truck" description={selected.plate ? `Plate ${selected.plate}` : undefined}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
            {selected.plate ? <span className="text-sm text-muted">Plate {selected.plate}</span> : null}
          </div>
          {selected.closedMessage ? (
            <p className="rounded-atlas-md border border-default bg-surface-elevated px-4 py-3 text-sm leading-6 text-primary">
              {selected.closedMessage}
            </p>
          ) : null}
          {selected.uncountedMessage ? (
            <p className="rounded-atlas-md border border-default bg-surface-elevated px-4 py-3 text-sm leading-6 text-primary">
              {selected.uncountedMessage}
            </p>
          ) : null}
          {selected.open ? <MyVanOnTruck cards={selected.cards} /> : null}
          {selected.activity.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-primary">Recent</h3>
              <ul className="space-y-2">
                {selected.activity.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 text-primary">
                      {entry.label}
                      <span className="text-muted"> · {entry.itemName}</span>
                    </span>
                    <span className="shrink-0 text-right text-muted">
                      <span className="font-medium text-primary">{entry.quantity}</span>
                      {entry.when ? ` · ${entry.when}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </SectionCard>

      {selected.showRestock ? (
        <SectionCard title="Restock" description="Pull from the shop onto this van. Uncheck a line to leave it.">
          {selected.pickLines.length > 0 ? (
            <p className="mb-3 text-sm text-muted">
              Uncheck a line to leave it.
              {selected.shopReady ? " The shop count sits next to each part." : ""}
            </p>
          ) : null}
          {selected.shopMessage ? (
            <p className="mb-3 rounded-atlas-md border border-default bg-surface-elevated px-4 py-3 text-sm leading-6 text-primary">
              {selected.shopMessage}
            </p>
          ) : null}
          {selected.pickLines.length === 0 ? (
            <p className="text-sm text-muted">Nothing is below par.</p>
          ) : (
            <MyVanPickList
              key={pickKey}
              vehicleId={selected.vehicleId}
              shopName={selected.shopName}
              shopReady={selected.shopReady}
              lines={selected.pickLines}
            />
          )}
        </SectionCard>
      ) : null}

      {selected.showRecount ? (
        <SectionCard title="Recount" description="Type what is on the truck now. A blank line is skipped.">
          <MyVanRecount key={recountKey} vehicleId={selected.vehicleId} items={selected.recountItems} />
        </SectionCard>
      ) : null}
    </div>
  );
}
