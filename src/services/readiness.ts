import "server-only";

import type { JobReadiness, MaterialReadinessLevel } from "@/features/inventory/types/readiness";
import { computeReadiness } from "@/features/inventory/utils/readiness";
import { todayInCompanyTimeZone } from "@/lib/timezone";
import {
  insertReadinessSnapshot,
  loadPlanReadinessForJobs,
  loadReadinessData,
  writeLineReadiness,
  writePlanReadiness,
  type CachedReadiness,
  type LineReadinessWrite,
  type PlanReadinessSummary,
} from "@/repositories/inventoryReservations";

import { getSettings } from "./inventorySettings";

// ---------------------------------------------------------------------------
// Material readiness (plan §3.3). Advisory only: nothing here changes a job's
// status or blocks scheduling. The pure engine does the thinking; this module
// loads the inputs, caches the answer on the plan and its lines, and appends a
// snapshot when a job's rollup changes.
// ---------------------------------------------------------------------------

export type SnapshotTrigger = "plan_confirmed" | "state_changed" | "dispatched";

export interface RecomputeSummary {
  jobsChecked: number;
  linesUpdated: number;
  plansUpdated: number;
  snapshots: number;
  /** Cache writes that were refused (for example a role that cannot write the cache). */
  failedWrites: number;
}

export interface RecomputeOptions {
  /** Jobs whose snapshot should be written even if the rollup did not change. */
  forceSnapshotFor?: string[];
  forceSnapshotTrigger?: SnapshotTrigger;
}

function same(a: CachedReadiness | undefined, b: CachedReadiness): boolean {
  return a !== undefined && a.state === b.state && a.reason === b.reason && (a.eta ?? null) === (b.eta ?? null);
}

function snapshotDetail(result: JobReadiness, names: Map<string, string>) {
  return {
    lines: result.lines
      .filter((line) => !line.excluded)
      .map((line) => ({
        lineId: line.lineId,
        name: names.get(line.lineId) ?? null,
        state: line.state,
        shortfall: line.shortfall,
        needsSku: line.unverified,
      })),
  };
}

/**
 * Recomputes readiness for every planned, live job (jobs compete for the same
 * stock and arrivals, so the whole set is always computed together) and writes
 * only what changed. Cache writes are best-effort per job: a role that cannot
 * write the cache leaves the old value in place and the caller carries on.
 */
export async function recomputeReadiness(options: RecomputeOptions = {}): Promise<RecomputeSummary> {
  const [settings, data] = await Promise.all([getSettings(), loadReadinessData()]);
  const results = computeReadiness({
    today: todayInCompanyTimeZone(),
    settings: {
      leadDays: settings.readinessLeadDays,
      bufferDays: settings.arrivalBufferDays,
    },
    jobs: data.jobs,
    arrivals: data.arrivals,
    freeStock: data.freeStock,
  });

  const summary: RecomputeSummary = { jobsChecked: results.size, linesUpdated: 0, plansUpdated: 0, snapshots: 0, failedWrites: 0 };
  const forced = new Set(options.forceSnapshotFor ?? []);

  for (const job of data.jobs) {
    const result = results.get(job.jobId);
    if (!result) continue;
    const names = new Map(job.lines.map((line) => [line.lineId, line.name]));

    try {
      const lineWrites: LineReadinessWrite[] = [];
      for (const line of result.lines) {
        const next: CachedReadiness = { state: line.state, reason: line.reason, eta: line.eta };
        if (!same(data.cachedLines.get(line.lineId), next)) {
          lineWrites.push({ lineId: line.lineId, ...next });
        }
      }
      await writeLineReadiness(lineWrites);
      summary.linesUpdated += lineWrites.length;

      const nextPlan: CachedReadiness = { state: result.rollup, reason: result.reason, eta: null };
      const previousPlan = data.cachedPlans.get(job.jobId);
      const rollupChanged = (previousPlan?.state ?? null) !== result.rollup;
      if (!same(previousPlan, nextPlan)) {
        await writePlanReadiness(job.jobId, result.rollup, result.reason);
        summary.plansUpdated += 1;
      }

      const wantsSnapshot = result.rollup !== null && (rollupChanged || forced.has(job.jobId));
      if (wantsSnapshot && result.rollup !== null) {
        await insertReadinessSnapshot({
          jobId: job.jobId,
          trigger: forced.has(job.jobId) ? (options.forceSnapshotTrigger ?? "state_changed") : "state_changed",
          scheduledDate: job.scheduledDate,
          rollupState: result.rollup as MaterialReadinessLevel,
          counts: result.counts,
          detail: snapshotDetail(result, names),
        });
        summary.snapshots += 1;
      }
    } catch {
      summary.failedWrites += 1;
    }
  }

  return summary;
}

/** Best-effort wrapper for hooks: readiness is advisory, so it never fails the caller. */
export async function recomputeReadinessQuietly(options: RecomputeOptions = {}): Promise<void> {
  try {
    await recomputeReadiness(options);
  } catch (error) {
    console.error("[readiness] recompute failed:", error instanceof Error ? error.message : error);
  }
}

/** Cached rollup per job for the dispatch board. A failed read leaves the board as it was. */
export async function getPlanReadinessForJobs(jobIds: ReadonlyArray<string>): Promise<Record<string, PlanReadinessSummary>> {
  return loadPlanReadinessForJobs(jobIds);
}
