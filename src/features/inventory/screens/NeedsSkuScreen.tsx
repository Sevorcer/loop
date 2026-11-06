import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { NeedsSkuRowActions } from "@/features/job-materials/components/NeedsSkuRowActions";
import { canResolveNeedsSku } from "@/features/job-materials/utils/materialPlan";
import { ROUTE_BUILDERS } from "@/lib/routes";
import { getNeedsSkuQueue } from "@/services/materialPlans";

import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { getInventoryAccess } from "../server/inventoryAccess";

/** Plan lines no catalog item matched yet, across every job. Linking one teaches the alias. */
export async function NeedsSkuScreen() {
  const access = await getInventoryAccess();
  if (!access.canViewMaterialPlans) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Needs SKU is not available for your role" />
      </InventoryFrame>
    );
  }

  const rows = await getNeedsSkuQueue();
  const canResolve = canResolveNeedsSku(access.role);

  return (
    <InventoryFrame
      title="Inventory"
      description="Estimate lines that did not match a catalog item. Link each one once and it matches on its own next time."
    >
      <SectionCard title="Needs SKU" description="Lines stay on their job’s plan, but nothing can be pulled for them until they are linked.">
        {rows.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
            title="Nothing waiting"
            description="Every material line on a plan is matched to a catalog item or marked as not stocked."
          />
        ) : (
          <InventoryTable
            caption="Material lines without a catalog item"
            headers={[
              { label: "Line" },
              { label: "Job" },
              { label: "Qty", align: "right" },
              { label: "Source" },
              { label: "Actions", srOnly: true },
            ]}
          >
            {rows.map((row) => (
              <tr key={row.lineId} className="transition-colors hover:bg-surface-elevated">
                <Td className="font-medium text-primary">{row.name}</Td>
                <Td>
                  <Link
                    href={ROUTE_BUILDERS.JOB_DETAIL(row.jobId)}
                    className="rounded-atlas-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    {[row.jobNumber, row.jobTitle].filter(Boolean).join(" · ") || "Job"}
                  </Link>
                </Td>
                <Td align="right">
                  {row.quantity} <span className="text-muted">{row.unit}</span>
                </Td>
                <Td className="text-muted">{row.source}</Td>
                <Td align="right">
                  {canResolve ? <NeedsSkuRowActions jobId={row.jobId} lineId={row.lineId} lineName={row.name} /> : null}
                </Td>
              </tr>
            ))}
          </InventoryTable>
        )}
      </SectionCard>
    </InventoryFrame>
  );
}
