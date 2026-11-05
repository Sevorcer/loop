/** Follow-up state on a single job (jobs.follow_up_* columns). */
export interface JobFollowUpState {
  needed: boolean;
  note: string | null;
  markedAt: string | null;
  markedBy: string | null;
}

/** One row in the Follow-ups worklist. */
export interface FollowUpItem {
  jobId: string;
  jobNumber: string;
  title: string;
  status: string;
  customerName: string;
  propertyName: string;
  scheduledFor: string | null;
  note: string | null;
  markedAt: string | null;
  markedByName: string | null;
}
