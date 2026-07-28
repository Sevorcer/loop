import type { Job } from "@/features/jobs/types/job";
import { ROUTES } from "@/lib/routes";
import { JobListWidget } from "./JobListWidget";

export function LateJobsWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="Late Jobs"
      jobs={jobs}
      viewAllHref={ROUTES.JOBS}
      emptyTitle="No late jobs — looking good!"
      emptyDescription="All jobs are on schedule. Keep it up."
      emptyIsGood
    />
  );
}
