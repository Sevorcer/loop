import type { Job } from "@/features/jobs/types/job";
import { ROUTES } from "@/lib/routes";
import { JobListWidget } from "./JobListWidget";

export function TodaysJobsWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="Today's Jobs"
      jobs={jobs}
      viewAllHref={ROUTES.JOBS}
      emptyTitle="No jobs scheduled today"
      emptyDescription="There are no jobs on the schedule for today."
    />
  );
}
