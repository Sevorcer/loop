import type { Job } from "@/features/jobs/types/job";
import { ROUTES } from "@/lib/routes";
import { JobListWidget } from "./JobListWidget";

export function UnassignedJobsWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="Unassigned Jobs"
      jobs={jobs}
      viewAllHref={ROUTES.JOBS}
      emptyTitle="No unassigned jobs"
      emptyDescription="All open jobs have a technician assigned."
      emptyIsGood
    />
  );
}
