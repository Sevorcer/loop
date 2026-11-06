import { PackageCheck } from "lucide-react";
import Link from "next/link";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { EmptyState } from "@/components/atlas/EmptyState";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { ROUTE_BUILDERS } from "@/lib/routes";
import { getPullQueue } from "@/services/inventoryPulls";

import { InventoryFrame } from "../components/InventoryFrame";
import { InventoryTable, Td } from "../components/InventoryTable";
import { LineFlagButton, PullButton, PullListLink, ReturnPalletButton } from "../components/PullActions";
import { getInventoryAccess } from "../server/inventoryAccess";
import { formatQty, shortDate } from "../utils/readiness";

function jobLabel(jobNumber: string, jobTitle: string): string {
  return [jobNumber, jobTitle].filter(Boolean).join(" · ") || "Job";
}

/**
 * Pull queue: confirmed jobs with stock reserved for them, soonest first. Pulling moves the
 * stock from the shop to the job's pallet. Cancelled jobs whose pallet still holds stock are
 * listed at the top so it goes back on the shelf.
 */
export async function PullsScreen() {
  const access = await getInventoryAccess();
  if (!access.canViewPulls) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Pulls are not available for your role" showHomeLink />
      </InventoryFrame>
    );
  }

  const { jobs, stranded } = await getPullQueue();
  const canPull = access.canPull;

  return (
    <InventoryFrame title="Inventory" description="What the shop needs to pull for upcoming jobs, soonest first.">
      {stranded.length > 0 ? (
        <SectionCard title="Return to shop" description="These jobs were cancelled with materials still on their pallet.">
          <InventoryTable
            caption="Pallets to return"
            headers={[{ label: "Job" }, { label: "On the pallet" }, { label: "Actions", srOnly: true }]}
          >
            {stranded.map((pallet) => (
              <tr key={pallet.jobId} className="transition-colors hover:bg-surface-elevated">
                <Td className="font-medium text-primary">
                  <Link
                    href={ROUTE_BUILDERS.JOB_DETAIL(pallet.jobId)}
                    className="rounded-atlas-md underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    {jobLabel(pallet.jobNumber, pallet.jobTitle)}
                  </Link>
                  <StatusBadge variant="warning" className="ml-2">
                    {pallet.jobStatus === "Cancelled" ? "Cancelled" : "Deleted"}
                  </StatusBadge>
                </Td>
                <Td className="text-muted">
                  {pallet.items.map((item) => `${formatQty(item.onHand)} ${item.unit ?? ""} ${item.itemName}`.replace("  ", " ")).join(", ")}
                </Td>
                <Td align="right">{canPull ? <ReturnPalletButton jobId={pallet.jobId} /> : null}</Td>
              </tr>
            ))}
          </InventoryTable>
        </SectionCard>
      ) : null}

      {jobs.length === 0 ? (
        <EmptyState
          icon={<PackageCheck className="h-5 w-5" aria-hidden="true" />}
          title="Nothing to pull"
          description="Jobs show up here once their plan is confirmed, they have a date, and stock is reserved for them."
        />
      ) : (
        jobs.map((job) => {
          const waiting = job.lines.filter((line) => line.reserved > 0).length;
          return (
            <SectionCard
              key={job.jobId}
              title={jobLabel(job.jobNumber, job.jobTitle)}
              description={job.scheduledFor ? `Job date ${shortDate(job.scheduledFor)}` : undefined}
              actions={
                <div className="flex items-center gap-2">
                  <PullListLink jobId={job.jobId} />
                  {canPull ? <PullButton jobId={job.jobId} label="Pull all" disabled={waiting === 0} /> : null}
                </div>
              }
            >
              <InventoryTable
                caption={`Materials for ${jobLabel(job.jobNumber, job.jobTitle)}`}
                headers={[
                  { label: "Item" },
                  { label: "Needed", align: "right" },
                  { label: "On the shelf", align: "right" },
                  { label: "On the pallet", align: "right" },
                  { label: "Actions", srOnly: true },
                ]}
              >
                {job.lines.map((line) => (
                  <tr key={line.lineId} className="transition-colors hover:bg-surface-elevated">
                    <Td className="font-medium text-primary">
                      {line.name}
                      {line.itemSku ? <span className="ml-2 text-xs text-muted">{line.itemSku}</span> : null}
                      {line.isOptional ? <span className="ml-2 text-xs text-muted">optional</span> : null}
                    </Td>
                    <Td align="right">
                      {formatQty(line.required)} <span className="text-muted">{line.unit}</span>
                    </Td>
                    <Td align="right">{formatQty(line.reserved)}</Td>
                    <Td align="right">{formatQty(line.pulled)}</Td>
                    <Td align="right">
                      <div className="flex items-start justify-end gap-1">
                        <LineFlagButton jobId={job.jobId} lineId={line.lineId} itemId={line.itemId} lineName={line.name} />
                        {canPull && line.reserved > 0 ? (
                          <PullButton jobId={job.jobId} lineId={line.lineId} label="Pull" />
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </InventoryTable>
            </SectionCard>
          );
        })
      )}
    </InventoryFrame>
  );
}
