import type { Job } from "@/features/jobs/types/job";
import { ACTIONABLE_VIEWS } from "@/lib/operationsMetricDefinitions";
import { JobListWidget } from "./JobListWidget";

export function UnassignedJobsWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="Unassigned Jobs"
      jobs={jobs}
      viewAllHref={ACTIONABLE_VIEWS.unassigned}
      emptyTitle="No unassigned jobs"
      emptyDescription="All open jobs have a technician assigned."
      emptyIsGood
    />
  );
}
