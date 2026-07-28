import type { Job } from "@/features/jobs/types/job";
import { ROUTES } from "@/lib/routes";
import { JobListWidget } from "./JobListWidget";

/**
 * CallbacksWidget — shows jobs matching the "callback" text pattern.
 *
 * NOTE: uses ilike pattern match on title/notes (no dedicated type/flag in
 * current schema). Sprint 8 should add a proper callback flag or job type
 * to eliminate false positives.
 */
export function CallbacksWidget({ jobs }: { jobs: Job[] }) {
  return (
    <JobListWidget
      title="Callbacks"
      jobs={jobs}
      viewAllHref={ROUTES.JOBS}
      emptyTitle="No open callbacks"
      emptyDescription="No callback jobs are currently open."
      emptyIsGood
    />
  );
}
