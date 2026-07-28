import type { Job } from "@/features/jobs/types/job";
import { ACTIONABLE_VIEWS } from "@/lib/operationsMetricDefinitions";
import { JobListWidget } from "./JobListWidget";

export function InProgressJobsWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="In Progress"
      jobs={jobs}
      viewAllHref={ACTIONABLE_VIEWS.inProgress}
      emptyTitle="No jobs in progress"
      emptyDescription="No crews are currently working in the field."
    />
  );
}
