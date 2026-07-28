import type { Job } from "@/features/jobs/types/job";
import { ROUTES } from "@/lib/routes";
import { JobListWidget } from "./JobListWidget";

export function WaitingOnInspectionWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="Waiting on Inspection"
      jobs={jobs}
      viewAllHref={ROUTES.JOBS}
      emptyTitle="No open inspections"
      emptyDescription="All inspection jobs are complete or cancelled."
      emptyIsGood
    />
  );
}
