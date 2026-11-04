import type { Job } from "@/features/jobs/types/job";
import { ACTIONABLE_VIEWS } from "@/lib/operationsMetricDefinitions";
import { CALLBACK_LABELS } from "@/lib/callbacks";
import { JobListWidget } from "./JobListWidget";

/**
 * CallbacksWidget — shows OPEN callbacks (jobs whose type is Callback and that
 * are not Completed/Cancelled). Classification is by job type via the shared
 * definitions in src/lib/callbacks.ts, not by title/notes keyword matching.
 */
export function CallbacksWidget({ jobs, totalCount }: { jobs: Job[]; totalCount?: number }) {
  return (
    <JobListWidget
      title={CALLBACK_LABELS.open}
      jobs={jobs}
      totalCount={totalCount}
      viewAllHref={ACTIONABLE_VIEWS.callbacks}
      emptyTitle="No open callbacks"
      emptyDescription="No callback jobs are currently open."
      emptyIsGood
    />
  );
}
