import type { Job } from "@/features/jobs/types/job";
import { ACTIONABLE_VIEWS } from "@/lib/operationsMetricDefinitions";
import { JobListWidget } from "./JobListWidget";

export function UnassignedJobsWidget({ jobs, totalCount }: { jobs: Job[]; totalCount?: number }) {
  return (
    <JobListWidget
      title="Unassigned Jobs"
      jobs={jobs}
      totalCount={totalCount}
      viewAllHref={ACTIONABLE_VIEWS.unassigned}
      emptyTitle="No unassigned jobs"
      emptyDescription="All open jobs have a technician assigned."
      emptyIsGood
    />
  );
}
