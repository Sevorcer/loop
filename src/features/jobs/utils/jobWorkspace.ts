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
