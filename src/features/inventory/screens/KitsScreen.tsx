import { Package } from "lucide-react";
import Link from "next/link";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTES, ROUTE_BUILDERS } from "@/lib/routes";
import { listKits } from "@/services/kitTemplates";

import { DuplicateKitDialog } from "../components/DuplicateKitDialog";
import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { NewKitDialog } from "../components/NewKitDialog";
import { firstParam, getInventoryAccess } from "../server/inventoryAccess";

interface KitsScreenProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/** Install kits: named pallets of consumables built from the catalog. Nothing is seeded. */
export async function KitsScreen({ searchParams }: KitsScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canViewKits) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Kits are not available for your role" />
      </InventoryFrame>
    );
  }

  const params = (await searchParams) ?? {};
  const showArchived = firstParam(params.archived) === "1";
  const kits = await listKits(showArchived);

  return (
    <InventoryFrame
      title="Inventory"
      description="Kits are the consumables and accessories that travel with an install. Build them from your catalog."
      actions={access.canEditKits ? <NewKitDialog /> : undefined}
    >
      <SectionCard
        title="Install kits"
        description="Attaching a kit to a job copies it, so editing a kit never changes jobs that already used it."
        actions={
          <Link
            href={showArchived ? ROUTES.INVENTORY_KITS : `${ROUTES.INVENTORY_KITS}?archived=1`}
            className="inline-flex min-h-11 items-center rounded-atlas-md px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Link>
        }
      >
        {kits.length === 0 ? (
          <EmptyState
            icon={<Package className="h-5 w-5" aria-hidden="true" />}
            title={showArchived ? "No kits yet" : "No active kits yet"}
            description="Start with the install you do most, such as a gas furnace swap. Pick each item from the catalog and set how many go on the pallet."
            action={access.canEditKits ? <NewKitDialog /> : undefined}
          />
        ) : (
          <InventoryTable
            caption="Install kits"
            headers={[
              { label: "Kit" },
              { label: "Category" },
              { label: "Items", align: "right" },
              { label: "Version", align: "right" },
              { label: "Status" },
              { label: "Actions", srOnly: true },
            ]}
          >
            {kits.map((kit) => (
              <tr key={kit.id} className="transition-colors hover:bg-surface-elevated">
                <Td className="font-medium">
                  <Link
                    href={ROUTE_BUILDERS.INVENTORY_KIT(kit.id)}
                    className="rounded-atlas-md text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    {kit.name}
                  </Link>
                </Td>
                <Td className="text-muted">{kit.category ?? "—"}</Td>
                <Td align="right">
                  {kit.lineCount}
                  {kit.optionalCount > 0 ? <span className="text-muted"> ({kit.optionalCount} optional)</span> : null}
                </Td>
                <Td align="right" className="text-muted">v{kit.version}</Td>
                <Td>
                  {kit.status === "active" ? (
                    <StatusBadge variant="success">Active</StatusBadge>
                  ) : (
                    <StatusBadge variant="neutral">Archived</StatusBadge>
                  )}
                </Td>
                <Td align="right">{access.canEditKits ? <DuplicateKitDialog kitId={kit.id} kitName={kit.name} /> : null}</Td>
              </tr>
            ))}
          </InventoryTable>
        )}
      </SectionCard>
    </InventoryFrame>
  );
}
