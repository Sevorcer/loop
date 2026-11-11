import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { ROUTE_BUILDERS } from "@/lib/routes";
import { hasPermission } from "@/services/authorization";
import { listSerialReview } from "@/services/inventorySerialUnits";

import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { SerialReviewActions } from "../components/SerialReviewActions";
import { getInventoryAccess } from "../server/inventoryAccess";
import { groupReviewRows, reviewReasonCopy } from "../utils/serialRules";

const linkClass =
  "rounded-atlas-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]";

/** Serials the office must settle: duplicates are kept, corrected or removed by a person; blanks are filled from the nameplate. */
export async function SerialReviewScreen() {
  const access = await getInventoryAccess();
  if (!access.canReviewSerials) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Serial review is not available for your role" />
      </InventoryFrame>
    );
  }

  const groups = groupReviewRows(await listSerialReview());
  const canEditSystem = access.role !== null && hasPermission(access.role, "installed_systems", "update");

  return (
    <InventoryFrame
      title="Inventory"
      description="Serial numbers that need a person to look at them. Nothing here is merged or fixed automatically."
    >
      <SectionCard
        title="Serial review"
        description={
          groups.length === 0
            ? undefined
            : `${groups.length} ${groups.length === 1 ? "item" : "items"} waiting. A duplicate stays flagged until all but one are corrected or removed.`
        }
      >
        {groups.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
            title="Nothing waiting"
            description="Every serial number on file is unique and filled in."
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key} aria-label={group.serialNumber ?? "Missing serial"} className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold text-primary">
                    {group.reason === "duplicate_serial"
                      ? `${[group.manufacturer, group.serialNumber].filter(Boolean).join(" · ")} (${group.rows.length} systems)`
                      : group.reason === "detached_unit"
                        ? `Detached unit · ${[group.manufacturer, group.serialNumber].filter(Boolean).join(" · ")}`
                        : "Missing serial"}
                  </h3>
                  <p className="text-xs text-muted">{reviewReasonCopy(group.reason)}</p>
                </div>
                <InventoryTable
                  caption={
                    group.reason === "duplicate_serial"
                      ? `Systems sharing ${group.serialNumber ?? "a serial"}`
                      : group.reason === "detached_unit"
                        ? "Unit on no system"
                        : "System without a serial"
                  }
                  headers={[
                    { label: "System" },
                    { label: "Model" },
                    { label: "Serial" },
                    { label: "Actions", srOnly: true },
                  ]}
                >
                  {group.rows.map((row) => (
                    <tr key={row.serialUnitId ?? row.installedSystemId ?? row.serialNumber} className="transition-colors hover:bg-surface-elevated">
                      <Td>
                        {row.installedSystemId ? (
                          <Link href={ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(row.installedSystemId)} className={linkClass}>
                            View system
                          </Link>
                        ) : (
                          <span className="text-muted">Not on a system</span>
                        )}
                      </Td>
                      <Td className="text-muted">{row.modelNumber || "—"}</Td>
                      <Td className="font-medium text-primary">{row.serialNumber ?? "—"}</Td>
                      <Td align="right">
                        {(row.reason === "duplicate_serial" || row.reason === "detached_unit") && row.serialUnitId && row.serialNumber ? (
                          <SerialReviewActions unitId={row.serialUnitId} serialNumber={row.serialNumber} canEditSystem={canEditSystem} reason={row.reason} />
                        ) : row.installedSystemId && canEditSystem ? (
                          <Link href={ROUTE_BUILDERS.INSTALLED_SYSTEM_EDIT(row.installedSystemId)} className={linkClass}>
                            Add serial
                          </Link>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </InventoryTable>
              </section>
            ))}
          </div>
        )}
      </SectionCard>
    </InventoryFrame>
  );
}
