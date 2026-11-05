import { normalizeJobStatus } from "@/lib/jobs/status";

import type { Job } from "../types/job";

export interface JobBoardStats {
  total: number;
  inProgress: number;
  scheduled: number;
}

/**
 * Counts for the jobs list stat cards. Status is matched loosely so a stored
 * variant ("in_progress") still counts. Priority is no longer shown on the
 * board (Option C); the column stays in the database for imports/callbacks.
 */
export function summarizeJobBoard(jobs: readonly Pick<Job, "status">[]): JobBoardStats {
  let inProgress = 0;
  let scheduled = 0;

  for (const job of jobs) {
    const status = normalizeJobStatus(job.status);
    if (status === "In Progress") inProgress += 1;
    if (status === "Scheduled") scheduled += 1;
  }

  return {
    total: jobs.length,
    inProgress,
    scheduled,
  };
}
