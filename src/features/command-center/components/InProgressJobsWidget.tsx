import type { Job } from "@/features/jobs/types/job";
import { ACTIONABLE_VIEWS } from "@/lib/operationsMetricDefinitions";
import { JobListWidget } from "./JobListWidget";

export function InProgressJobsWidget({ jobs, totalCount }: { jobs: Job[]; totalCount?: number }) {
  return (
    <JobListWidget
      title="In Progress"
      jobs={jobs}
      totalCount={totalCount}
      viewAllHref={ACTIONABLE_VIEWS.inProgress}
      emptyTitle="No jobs in progress"
      emptyDescription="No one is currently working in the field."
    />
  );
}
