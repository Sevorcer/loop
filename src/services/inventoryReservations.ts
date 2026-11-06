import "server-only";

import type { ReserveReason, ReserveResult } from "@/features/inventory/types/reservations";
import { loadReadinessData, rpcReserveJobMaterials } from "@/repositories/inventoryReservations";

import { recomputeReadiness, recomputeReadinessQuietly, type RecomputeOptions } from "./readiness";

// ---------------------------------------------------------------------------
// Reservations (plan §2.8, §3.2). The database function decides what a job can
// hold: it needs a confirmed plan, a date, and a Scheduled / In Progress status.
// Everything below is a thin, best-effort layer on top of that function.
// ---------------------------------------------------------------------------

/** Reserve (or trim / release) a job's materials and refresh readiness. Throws on failure. */
export async function reserveJobMaterials(
  jobId: string,
  reason: ReserveReason = "plan_changed",
  options: { requeue?: boolean; snapshot?: RecomputeOptions } = {},
): Promise<ReserveResult> {
  const result = await rpcReserveJobMaterials(jobId, reason, options.requeue ?? false);
  await recomputeReadinessQuietly(options.snapshot);
  return result;
}

/**
 * The job-lifecycle hook (amendment 7). Called after a job's date, status or
 * deletion changes: a date move goes to the back of the queue (kept stock is
 * re-claimed in the same database call); anything else just re-derives what the
 * job may hold. Never throws, because a stock claim must not fail a job update:
 * the availability view already ignores Cancelled, Completed and deleted jobs.
 */
export async function releaseAndRecheck(jobId: string, change: "rescheduled" | "changed"): Promise<void> {
  try {
    await rpcReserveJobMaterials(jobId, change === "rescheduled" ? "rescheduled" : "plan_changed", change === "rescheduled");
  } catch (error) {
    // A role that cannot reserve (tech, sales) lands here; so does a job with no plan.
    console.error("[reservations] release/recheck skipped:", error instanceof Error ? error.message : error);
  }
  await recomputeReadinessQuietly();
}

/** After a plan edit, confirm or reopen. Quiet for the same reason as releaseAndRecheck. */
export async function afterPlanChange(jobId: string, options: RecomputeOptions = {}): Promise<void> {
  try {
    await rpcReserveJobMaterials(jobId, "plan_changed", false);
  } catch (error) {
    console.error("[reservations] plan change not reserved:", error instanceof Error ? error.message : error);
  }
  await recomputeReadinessQuietly(options);
}

/**
 * Stock for these items just changed (a receive, an adjustment, a count). Jobs
 * that want them are topped up in job-date order, so the soonest job claims
 * first, then readiness is refreshed. Never throws.
 */
export async function reconcileAfterStockChange(itemIds: string[]): Promise<void> {
  const wanted = new Set(itemIds);
  if (wanted.size === 0) return;
  try {
    const data = await loadReadinessData();
    const jobs = data.jobs
      .filter((job) => job.active && job.scheduledDate !== null && job.lines.some((line) => line.itemId !== null && wanted.has(line.itemId)))
      .sort((a, b) =>
        (a.scheduledDate ?? "") === (b.scheduledDate ?? "")
          ? a.jobId.localeCompare(b.jobId)
          : (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""),
      );
    for (const job of jobs) {
      try {
        await rpcReserveJobMaterials(job.jobId, "plan_changed", false);
      } catch (error) {
        console.error("[reservations] top-up skipped:", error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    console.error("[reservations] reconcile failed:", error instanceof Error ? error.message : error);
  }
  await recomputeReadinessQuietly();
}

export { recomputeReadiness };
