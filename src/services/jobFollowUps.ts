import type { FollowUpItem, JobFollowUpState } from "@/features/follow-ups/types/followUp";
import { buildFollowUpPatch } from "@/features/follow-ups/utils/followUpPatch";
import {
  getJobFollowUp,
  listOpenFollowUps,
  writeJobFollowUp,
} from "@/repositories/jobFollowUps";

export type { FollowUpItem, JobFollowUpState };

export async function getFollowUp(jobId: string): Promise<JobFollowUpState | null> {
  return getJobFollowUp(jobId);
}

export async function listFollowUps(): Promise<FollowUpItem[]> {
  return listOpenFollowUps();
}

/**
 * Mark (or re-note) / unmark a job's follow-up. Any role allowed to update the
 * job may do it; completed jobs can be marked. Throws "Job not found." when no
 * row was updated (missing job or row-level security denied it).
 */
export async function setFollowUp(input: {
  jobId: string;
  needed: boolean;
  note?: unknown;
  userId: string | null;
  now?: Date;
}): Promise<JobFollowUpState> {
  const existing = await getJobFollowUp(input.jobId);
  if (!existing) throw new Error("Job not found.");
  const columns = buildFollowUpPatch(
    { needed: input.needed, note: input.note, userId: input.userId, now: input.now ?? new Date() },
    existing,
  );
  const saved = await writeJobFollowUp(input.jobId, columns);
  if (!saved) throw new Error("Job not found.");
  return saved;
}
