import "server-only";

import {
  EMPTY_JOB_CALLBACK_CONTEXT,
  type JobCallbackContext,
  type JobCallbackLink,
} from "@/features/jobs/types/jobCallback";
import {
  buildCallbackJobInput,
  callbackReasonError,
  canCreateCallback,
} from "@/features/jobs/utils/callbackJob";
import { insertJobCallback, listJobCallbackRows } from "@/repositories/jobCallbacks";
import { createJobActivity, getJobById } from "@/repositories/jobs";
import { createJob } from "@/services/jobs";
import type { AppRole } from "@/services/authorization";
import type { SessionRepositoryContextInput } from "@/repositories/supabaseContext";

export interface CallbackRequestContext {
  actorId?: string;
  role: AppRole;
}

function isMissingCallbackStore(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /job_callbacks/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

function httpError(message: string, status: number): Error {
  const error = new Error(message);
  (error as { status?: number }).status = status;
  return error;
}

async function visibleJobLink(jobId: string): Promise<JobCallbackLink | null> {
  const job = await getJobById(jobId);
  if (!job) return null;
  return { id: job.id, jobNumber: job.jobNumber, title: job.title };
}

export async function getJobCallbackContext(jobId: string): Promise<JobCallbackContext> {
  try {
    const rows = await listJobCallbackRows(jobId);
    const asReturnVisit = rows.find((row) => row.job_id === jobId) ?? null;
    const children = rows.filter((row) => row.original_job_id === jobId);

    const original = asReturnVisit ? await visibleJobLink(asReturnVisit.original_job_id) : null;
    const returnVisits = (
      await Promise.all(
        children.map(async (row) => {
          const link = await visibleJobLink(row.job_id);
          return link ? { ...link, reason: row.reason } : null;
        }),
      )
    ).filter((link): link is JobCallbackLink & { reason: string } => link !== null);

    return {
      original,
      reason: asReturnVisit?.reason ?? null,
      returnVisits,
    };
  } catch (error) {
    if (isMissingCallbackStore(error)) return EMPTY_JOB_CALLBACK_CONTEXT;
    throw error;
  }
}

export async function createCallbackFromJob(
  originalJobId: string,
  input: { reason: string; scheduledStartAt?: string | null },
  context: CallbackRequestContext,
  contextInput?: SessionRepositoryContextInput,
) {
  if (!canCreateCallback(context.role)) {
    throw httpError("You don't have permission to create a callback.", 403);
  }

  const reasonError = callbackReasonError(input.reason);
  if (reasonError) throw new Error(reasonError);

  const original = await getJobById(originalJobId, contextInput);
  if (!original) throw httpError("Job not found.", 404);
  if (original.status !== "Completed") {
    throw new Error(
      `Create a callback from a completed job. This job is still ${original.status}.`,
    );
  }

  const draft = buildCallbackJobInput(
    {
      id: original.id,
      jobNumber: original.jobNumber,
      title: original.title,
      customerId: original.customerId,
      customerName: original.customerName,
      propertyId: original.propertyId,
      propertyName: original.propertyName,
      assignedTo: original.assignedTo,
      assigneeIds: (original.assignees ?? []).map((assignee) => assignee.id),
      estimateId: original.estimateId,
      equipmentBundleId: original.equipmentBundleId,
      contractorIds: original.contractorIds,
      location: original.location,
      summary: original.summary,
      priority: original.priority,
    },
    {
      reason: input.reason,
      scheduledStartAt: input.scheduledStartAt ?? null,
    },
  );

  const created = await createJob(draft, contextInput);
  const reason = input.reason.trim();

  try {
    await insertJobCallback(
      {
        jobId: created.id,
        originalJobId: original.id,
        reason,
        createdBy: context.actorId || null,
      },
      contextInput,
    );
  } catch (error) {
    if (isMissingCallbackStore(error)) {
      throw new Error("Callbacks are not available until the latest database update is applied.");
    }
    throw new Error(
      `Return visit ${created.jobNumber} was created, but it could not be linked to ${original.jobNumber}.`,
    );
  }

  await Promise.all([
    createJobActivity({
      jobId: created.id,
      actorId: context.actorId,
      type: "callback",
      title: "Callback opened",
      description: `Return visit for ${original.jobNumber}. ${reason}`,
    }),
    createJobActivity({
      jobId: original.id,
      actorId: context.actorId,
      type: "callback",
      title: "Callback created",
      description: `Return visit ${created.jobNumber} opened. ${reason}`,
    }),
  ]);

  return created;
}
