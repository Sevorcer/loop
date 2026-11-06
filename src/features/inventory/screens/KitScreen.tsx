import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTES } from "@/lib/routes";
import { listCatalogItems } from "@/services/inventoryCatalog";
import { getKit } from "@/services/kitTemplates";

import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { KitEditor } from "../components/KitEditor";
import { getInventoryAccess } from "../server/inventoryAccess";
import type { KitItemOption, KitTemplate } from "../types/kits";

interface KitScreenProps {
  kitId: string;
}

/** One kit: editable by owner/manager/office, a plain read-only list for everyone else. */
export async function KitScreen({ kitId }: KitScreenProps) {
  const access = await getInventoryAccess();
  if (!access.canViewKits) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Kits are not available for your role" />
      </InventoryFrame>
    );
  }

  let kit: KitTemplate;
  try {
    kit = await getKit(kitId);
  } catch (error) {
    if ((error as { status?: number }).status === 404) notFound();
    throw error;
  }

  const backLink = (
    <Link
      href={ROUTES.INVENTORY_KITS}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-atlas-md text-sm text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      All kits
    </Link>
  );

  if (access.canEditKits) {
    // Stocked, active catalog items only. Cost is never requested here.
    const items = await listCatalogItems({ facet: "stockable", limit: 1000 }, { canSeeCost: false });
    const options: KitItemOption[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      itemKind: item.itemKind,
    }));
    return (
      <InventoryFrame title="Inventory" actions={backLink}>
        <KitEditor key={kit.id} kit={kit} options={options} />
      </InventoryFrame>
    );
  }

  return (
    <InventoryFrame title="Inventory" actions={backLink}>
      <SectionCard
        title={kit.name}
        description={kit.description ?? (kit.category ? `${kit.category} kit` : undefined)}
        actions={
          <>
            <StatusBadge variant={kit.status === "active" ? "success" : "neutral"}>
              {kit.status === "active" ? "Active" : "Archived"}
            </StatusBadge>
            <StatusBadge variant="neutral">v{kit.version}</StatusBadge>
          </>
        }
      >
        {kit.lines.length === 0 ? (
          <p className="text-sm text-muted">This kit has no items yet.</p>
        ) : (
          <InventoryTable
            caption={`Items in ${kit.name}`}
            headers={[{ label: "Item" }, { label: "SKU" }, { label: "Qty", align: "right" }, { label: "Notes" }]}
          >
            {kit.lines.map((line) => (
              <tr key={line.id}>
                <Td className="font-medium">
                  {line.itemName}
                  {line.isOptional ? <span className="ml-2 text-xs text-muted">(optional)</span> : null}
                </Td>
                <Td className="text-muted">{line.sku ?? "—"}</Td>
                <Td align="right">
                  {line.quantity}
                  {line.unit ? <span className="text-muted"> {line.unit}</span> : null}
                </Td>
                <Td className="text-muted">{line.notes ?? "—"}</Td>
              </tr>
            ))}
          </InventoryTable>
        )}
      </SectionCard>
    </InventoryFrame>
  );
}
