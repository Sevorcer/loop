import type { Job } from "@/features/jobs/types/job";
import { ROUTES } from "@/lib/routes";
import { JobListWidget } from "./JobListWidget";

/**
 * OnHoldJobsWidget — shows jobs with status = 'On Hold'.
 *
 * Widget intentionally labelled "On Hold" (not "Waiting on Parts") because
 * the status maps to any hold reason, not only missing parts.
 * Sprint 8: add a hold_reason field to surface specific blockers per job.
 */
export function OnHoldJobsWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="On Hold"
      jobs={jobs}
      viewAllHref={ROUTES.JOBS}
      emptyTitle="No jobs on hold"
      emptyDescription="No jobs are currently blocked or waiting."
      emptyIsGood
    />
  );
}
