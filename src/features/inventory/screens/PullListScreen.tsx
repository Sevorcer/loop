import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/atlas/AccessDenied";
import { ROUTES } from "@/lib/routes";
import { listPickableUnits, listPicksForLines } from "@/services/inventoryLineSerials";
import { getPullList } from "@/services/inventoryPulls";

import { LineUnitPicker } from "../components/LineUnitPicker";
import { PrintButton } from "../components/PullActions";
import { getInventoryAccess } from "../server/inventoryAccess";
import { formatQty, shortDate } from "../utils/readiness";

/** One job's pull list, laid out to print: item, how many to take, and a box to tick. */
export async function PullListScreen({ jobId }: { jobId: string }) {
  const access = await getInventoryAccess();
  if (!access.canViewPulls) {
    return <AccessDenied title="Pull lists are not available for your role" showHomeLink />;
  }

  const job = await getPullList(jobId);
  if (!job) notFound();

  const title = [job.jobNumber, job.jobTitle].filter(Boolean).join(" · ") || "Job";

  // Serialized lines are picked by unit. A read problem here must not hide the pull list itself.
  const serializedLines = job.lines.filter((line) => line.trackingMode === "serialized");
  const picks = new Map<string, { serialUnitId: string; serialNumber: string }[]>();
  const available = new Map<string, { id: string; serialNumber: string }[]>();
  let unitsError = false;
  if (serializedLines.length > 0) {
    try {
      for (const pick of await listPicksForLines(serializedLines.map((line) => line.lineId))) {
        picks.set(pick.lineId, [...(picks.get(pick.lineId) ?? []), { serialUnitId: pick.serialUnitId, serialNumber: pick.serialNumber }]);
      }
      for (const itemId of new Set(serializedLines.map((line) => line.itemId))) {
        available.set(itemId, await listPickableUnits(itemId));
      }
    } catch {
      unitsError = true;
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 print:max-w-none print:p-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={ROUTES.INVENTORY_PULLS}
          className="rounded-atlas-md text-sm text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          Back to pulls
        </Link>
        <PrintButton />
      </div>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-primary">Pull list</h1>
        <p className="text-sm text-muted">
          {title}
          {job.scheduledFor ? ` · Job date ${shortDate(job.scheduledFor)}` : ""}
        </p>
      </header>

      <table className="w-full text-sm">
        <caption className="sr-only">Materials to pull for {title}</caption>
        <thead>
          <tr className="border-b border-default text-left text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="w-10 py-2">
              <span className="sr-only">Pulled</span>
            </th>
            <th scope="col" className="py-2">Item</th>
            <th scope="col" className="py-2 text-right">Take</th>
            <th scope="col" className="py-2 text-right">Already on pallet</th>
            {serializedLines.length > 0 ? <th scope="col" className="py-2 pl-4">Units</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {job.lines.map((line) => (
            <tr key={line.lineId}>
              <td className="py-3">
                <span aria-hidden="true" className="inline-block h-4 w-4 rounded-sm border border-default" />
              </td>
              <td className="py-3 text-primary">
                {line.name}
                {line.itemSku ? <span className="ml-2 text-xs text-muted">{line.itemSku}</span> : null}
                {line.isOptional ? <span className="ml-2 text-xs text-muted">optional</span> : null}
              </td>
              <td className="py-3 text-right tabular-nums">
                {formatQty(line.reserved)} <span className="text-muted">{line.unit}</span>
              </td>
              <td className="py-3 text-right tabular-nums text-muted">{formatQty(line.pulled)}</td>
              {serializedLines.length > 0 ? (
                <td className="py-3 pl-4 align-top">
                  {line.trackingMode === "serialized" ? (
                    unitsError ? (
                      <span className="text-xs text-muted">Units could not be loaded.</span>
                    ) : (
                      <LineUnitPicker
                        lineId={line.lineId}
                        lineName={line.name}
                        needed={Math.ceil(line.required)}
                        picked={picks.get(line.lineId) ?? []}
                        available={available.get(line.itemId) ?? []}
                        canEdit={access.canPull}
                      />
                    )
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
