import type { JobStatus } from "../types/job";
import type { JobActivity } from "../types/jobActivity";

const JOB_STATUS_INTENTS: Record<JobStatus, string> = {
  Scheduled:
    "This job is scheduled and ready to move once the field team arrives and confirms execution.",
  "In Progress":
    "This job is actively being worked and should be monitored for completion, blockers, and field updates.",
  "On Hold":
    "This job is paused and needs a blocker resolved before it should return to the active queue.",
  Completed:
    "This job is complete and should only need closeout, documentation, or follow-up review.",
  Cancelled:
    "This job is no longer active and should remain out of the operational queue unless it is reopened.",
};

export function getJobStatusIntent(status: JobStatus): string {
  return JOB_STATUS_INTENTS[status];
}

export function sortJobActivity(activity: JobActivity[]): JobActivity[] {
  return [...activity].sort((left, right) => {
    const timestampDelta =
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();

    if (timestampDelta !== 0) {
      return timestampDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

// ─── Job Status Transitions ───────────────────────────────────────────────────
// Defines the legal state machine for job execution lifecycle.
// Completed is terminal — no outbound transitions. Cancelled can be reopened to Scheduled.

const VALID_JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  Scheduled: ["In Progress", "On Hold", "Cancelled"],
  "In Progress": ["Completed", "On Hold", "Cancelled"],
  "On Hold": ["Scheduled", "In Progress", "Cancelled"],
  Completed: [],
  Cancelled: ["Scheduled"],
};

/**
 * Returns all statuses that a job may legally transition to from its current state.
 * Returns an empty array for terminal statuses (Completed).
 */
export function getValidNextStatuses(current: JobStatus): JobStatus[] {
  return VALID_JOB_STATUS_TRANSITIONS[current];
}

/**
 * Returns true when transitioning from `from` to `to` is a valid lifecycle move.
 */
export function canTransitionStatus(from: JobStatus, to: JobStatus): boolean {
  return VALID_JOB_STATUS_TRANSITIONS[from].includes(to);
}
