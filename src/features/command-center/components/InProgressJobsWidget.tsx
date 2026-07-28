import type { Job } from "@/features/jobs/types/job";
import { ROUTES } from "@/lib/routes";
import { JobListWidget } from "./JobListWidget";

export function InProgressJobsWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="In Progress"
      jobs={jobs}
      viewAllHref={ROUTES.JOBS}
      emptyTitle="No jobs in progress"
      emptyDescription="No crews are currently working in the field."
    />
  );
}
