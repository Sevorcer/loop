import type { MaterialReadinessLevel } from "@/features/inventory/types/readiness";
import { daysBetween } from "@/features/inventory/utils/readiness";

export interface PlanReadinessForBoard {
  state: MaterialReadinessLevel | null;
  reason: string | null;
  needsSku: number;
}

export interface RiskJob {
  id: string;
  type: string;
  /** "YYYY-MM-DD" in the company time zone. */
  scheduledFor: string | null;
}

/**
 * "Next 3 days: N installs at risk" (plan §7.1). Counts Install jobs that start today or within
 * `days` more days and whose cached material readiness is At risk. Advisory: it only informs.
 */
export function countInstallsAtRisk(
  jobs: ReadonlyArray<RiskJob>,
  readiness: Readonly<Record<string, PlanReadinessForBoard>>,
  today: string,
  days = 3,
): number {
  let count = 0;
  for (const job of jobs) {
    if (job.type !== "Install" || !job.scheduledFor) continue;
    const away = daysBetween(today, job.scheduledFor);
    if (away < 0 || away > days) continue;
    if (readiness[job.id]?.state === "at_risk") count += 1;
  }
  return count;
}
