import type { Job } from "@/features/jobs/types/job";
import { ACTIONABLE_VIEWS } from "@/lib/operationsMetricDefinitions";
import { JobListWidget } from "./JobListWidget";

export function LateJobsWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="Late Jobs"
      jobs={jobs}
      viewAllHref={ACTIONABLE_VIEWS.late}
      emptyTitle="No late jobs — looking good!"
      emptyDescription="All jobs are on schedule. Keep it up."
      emptyIsGood
    />
  );
}
