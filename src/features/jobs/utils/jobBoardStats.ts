import { normalizeJobStatus } from "@/lib/jobs/status";

import type { Job } from "../types/job";

export interface JobBoardStats {
  total: number;
  inProgress: number;
  scheduled: number;
  highPriority: number;
}

function isHighPriority(priority: string | null | undefined): boolean {
  return (priority ?? "").trim().toLowerCase() === "high";
}

/**
 * Counts for the jobs list stat cards. Status and priority are matched
 * loosely so a stored variant ("in_progress", "high") still counts.
 */
export function summarizeJobBoard(jobs: readonly Pick<Job, "status" | "priority">[]): JobBoardStats {
  let inProgress = 0;
  let scheduled = 0;
  let highPriority = 0;

  for (const job of jobs) {
    const status = normalizeJobStatus(job.status);
    if (status === "In Progress") inProgress += 1;
    if (status === "Scheduled") scheduled += 1;
    if (isHighPriority(job.priority)) highPriority += 1;
  }

  return {
    total: jobs.length,
    inProgress,
    scheduled,
    highPriority,
  };
}
