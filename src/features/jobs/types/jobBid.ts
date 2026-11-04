export type JobBidStatus = "draft" | "sent" | "accepted" | "declined";

export interface JobBid {
  id: string;
  orgId: string;
  jobId: string;
  /** Stored as cents in the database; display helpers convert to dollars. */
  amountCents: number;
  status: JobBidStatus;
  /** Reference to an uploaded file (the Joist PDF), if attached. */
  fileId: string | null;
  isCurrent: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export const JOB_BID_STATUSES: readonly JobBidStatus[] = [
  "draft",
  "sent",
  "accepted",
  "declined",
] as const;

export const JOB_BID_STATUS_SET = new Set<string>(JOB_BID_STATUSES);
