import type { Job } from "@/features/jobs/types/job";
import { ACTIONABLE_VIEWS } from "@/lib/operationsMetricDefinitions";
import { JobListWidget } from "./JobListWidget";

export function LateJobsWidget({ jobs, totalCount }: { jobs: Job[]; totalCount?: number }) {
  return (
    <JobListWidget
      title="Late Jobs"
      jobs={jobs}
      totalCount={totalCount}
      viewAllHref={ACTIONABLE_VIEWS.late}
      emptyTitle="No late jobs — looking good!"
      emptyDescription="All jobs are on schedule. Keep it up."
      emptyIsGood
    />
  );
}
