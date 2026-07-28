import type { Job } from "@/features/jobs/types/job";
import { ACTIONABLE_VIEWS } from "@/lib/operationsMetricDefinitions";
import { JobListWidget } from "./JobListWidget";

export function TodaysJobsWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="Today's Jobs"
      jobs={jobs}
      viewAllHref={ACTIONABLE_VIEWS.scheduledToday}
      emptyTitle="No jobs scheduled today"
      emptyDescription="There are no jobs on the schedule for today."
    />
  );
}
