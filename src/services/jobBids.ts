import "server-only";

import { JOB_BID_STATUS_SET } from "@/features/jobs/types/jobBid";
import type { JobBid } from "@/features/jobs/types/jobBid";
import {
  createBid,
  deleteBid,
  getBidById,
  listBidsByJobId,
  markBidsNonCurrent,
  updateBid,
} from "@/repositories/jobBids";
import type { CreateBidInput, UpdateBidInput } from "@/repositories/jobBids";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateAmountCents(cents: number): void {
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new Error("Bid amount must be greater than zero.");
  }
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Bid amount is out of range.");
  }
}

function validateStatus(status: string): void {
  if (!JOB_BID_STATUS_SET.has(status)) {
    throw new Error(`Invalid bid status: ${status}. Must be one of: draft, sent, accepted, declined.`);
  }
}

// ---------------------------------------------------------------------------
// Service API
// ---------------------------------------------------------------------------

export async function listJobBids(jobId: string): Promise<JobBid[]> {
  return listBidsByJobId(jobId);
}

export async function getJobBid(bidId: string): Promise<JobBid | null> {
  return getBidById(bidId);
}

export interface CreateJobBidInput {
  jobId: string;
  amountCents: number;
  status: string;
  fileId?: string | null;
  notes?: string;
  createdBy?: string | null;
}

/**
 * Create a new bid for a job. If the job already has a current bid, the
 * previous current bid is marked non-current before the new one is inserted.
 */
export async function createJobBid(input: CreateJobBidInput): Promise<JobBid> {
  validateAmountCents(input.amountCents);
  validateStatus(input.status);

  // Mark any existing current bids as non-current
  await markBidsNonCurrent(input.jobId);

  return createBid({
    jobId: input.jobId,
    amountCents: input.amountCents,
    status: input.status,
    fileId: input.fileId,
    notes: input.notes,
    createdBy: input.createdBy,
  });
}

export interface UpdateJobBidInput {
  amountCents?: number;
  status?: string;
  fileId?: string | null;
  notes?: string;
}

export async function updateJobBid(bidId: string, input: UpdateJobBidInput): Promise<JobBid | null> {
  if (input.amountCents !== undefined) {
    validateAmountCents(input.amountCents);
  }
  if (input.status !== undefined) {
    validateStatus(input.status);
  }

  return updateBid(bidId, input);
}

export async function deleteJobBid(bidId: string): Promise<boolean> {
  return deleteBid(bidId);
}
