import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { ROUTE_BUILDERS } from "@/lib/routes";

import { ParEditor } from "../components/ParEditor";
import { InventoryFrame } from "../components/InventoryFrame";
import { getInventoryAccess } from "../server/inventoryAccess";
import { loadVanContext } from "../server/loadVanContext";

interface ParEditorScreenProps {
  vehicleId: string;
}

/** Owner, manager, and office set pars. Copy from another van fills inputs and does not save. */
export async function ParEditorScreen({ vehicleId }: ParEditorScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canEditPars) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied
          title="Par levels are edited by the owner, a manager, or the office"
          description="You can still read on-hand and pars. Techs and dispatch cannot change them."
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

  const { vehicle, location, items, levels, copySources } = context;
  const stockable = items
    .filter((item) => item.isActive && item.isStockable)
    .map((item) => ({ id: item.id, name: item.name, sku: item.sku, unit: item.unit }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const initial = levels
    .filter((level) => level.minQty != null || level.maxQty != null)
    .map((level) => ({ itemId: level.itemId, minQty: level.minQty, maxQty: level.maxQty }));

  const back = (
    <Link
      href={ROUTE_BUILDERS.INVENTORY_VAN(vehicle.id)}
      className="inline-flex min-h-11 items-center gap-2 rounded-atlas-md px-2 text-sm text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:min-h-0"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Back to {vehicle.name}
    </Link>
  );

  return (
    <InventoryFrame title={`Pars · ${vehicle.name}`} description="Minimum flags the van when on-hand is under it. Fill to is what a restock aims for." actions={back}>
      {!location ? (
        <EmptyState
          title="This van has no stock location"
          description="Create the stock location on the van before setting pars."
          action={back}
        />
      ) : !location.isActive || vehicle.status === "retired" ? (
        <EmptyState
          title="Pars stay on a retired van, and they are not edited here"
          description="Bring the van back to active before changing minimums. History and the numbers already saved stay put."
          action={back}
        />
      ) : stockable.length === 0 ? (
        <EmptyState
          title="No stockable items yet"
          description="Add items in the Catalog first. Nothing is seeded onto a van."
        />
      ) : (
        <SectionCard title="Minimum and fill to" description="Blank means not tracked on this van. Save sends only the rows you changed.">
          <ParEditor locationId={location.id} items={stockable} initial={initial} sources={copySources} />
        </SectionCard>
      )}
    </InventoryFrame>
  );
}
