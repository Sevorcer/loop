import type { Job } from "@/features/jobs/types/job";
import { ACTIONABLE_VIEWS } from "@/lib/operationsMetricDefinitions";
import { JobListWidget } from "./JobListWidget";

export function WaitingOnInspectionWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="Waiting on Inspection"
      jobs={jobs}
      viewAllHref={ACTIONABLE_VIEWS.waitingOnInspection}
      emptyTitle="No open inspections"
      emptyDescription="All inspection jobs are complete or cancelled."
      emptyIsGood
    />
  );
}
