import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { ROUTE_BUILDERS } from "@/lib/routes";

import { CountSheet } from "../components/CountSheet";
import { InventoryFrame } from "../components/InventoryFrame";
import { getInventoryAccess } from "../server/inventoryAccess";
import { loadVanContext } from "../server/loadVanContext";
import { orderCountSheet, type CountSheetItem } from "../utils/countSheet";

interface CountScreenProps {
  vehicleId: string;
}

/** Office count-in, and a later recount of the same van. Stock moves only as count rows. */
export async function CountScreen({ vehicleId }: CountScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canPostLedger) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied
          title="Counting a van is done by the owner, a manager, or the office"
          description="Dispatch can read stock. Adjustments of other locations stay on Stock for the same people who can post the ledger."
          showHomeLink
        />
      </InventoryFrame>
    );
  }

  let context;
  try {
    context = await loadVanContext(vehicleId);
  } catch (error) {
    if ((error as { status?: number }).status === 404) notFound();
    throw error;
  }

  const { vehicle, location, items, levels, counted } = context;
  const levelByItem = new Map(levels.map((level) => [level.itemId, level]));
  const sheet: CountSheetItem[] = orderCountSheet(
    items
      .filter((item) => item.isActive && item.isStockable)
      .map((item) => {
        const level = levelByItem.get(item.id);
        return {
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          onHand: level?.onHand ?? 0,
          minQty: level?.minQty ?? null,
          maxQty: level?.maxQty ?? null,
        };
      }),
  );

  const back = (
    <Link
      href={ROUTE_BUILDERS.INVENTORY_VAN(vehicle.id)}
      className="inline-flex min-h-11 items-center gap-2 rounded-atlas-md px-2 text-sm text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:min-h-0"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Back to {vehicle.name}
    </Link>
  );

  const closed = !location || !location.isActive || vehicle.status === "retired";

  return (
    <InventoryFrame
      title={counted ? `Recount · ${vehicle.name}` : `Count in · ${vehicle.name}`}
      description={
        counted
          ? "Type what is on the truck now. A blank line is skipped, and a match posts nothing."
          : "Type what is actually on the truck. The first count that changes on-hand turns restock alerts on."
      }
      actions={back}
    >
      {closed ? (
        <EmptyState
          title={location ? "This van is not open for a count" : "This van has no stock location"}
          description={
            location
              ? "Bring the van back before counting it. History already on the ledger stays put."
              : "Create the stock location on the van, then count what is on the truck."
          }
          action={back}
        />
      ) : sheet.length === 0 ? (
        <EmptyState title="No stockable items yet" description="Add items in the Catalog first. Nothing is seeded onto a van." action={back} />
      ) : (
        <SectionCard
          title={counted ? "Recount" : "Count in"}
          description="Items with a par are listed first. Zeros count when you type them and the ledger is not already there."
        >
          <CountSheet vehicleId={vehicle.id} counted={counted} items={sheet} />
        </SectionCard>
      )}
    </InventoryFrame>
  );
}
