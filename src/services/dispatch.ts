import "server-only";

import { listContractors } from "@/repositories/contractors";
import { getJobById, listJobs, updateJob } from "@/repositories/jobs";
import {
  companyTimeOfDay,
  shiftIsoToCompanyDate,
} from "@/lib/timezone";
import { scheduledWindowClock, scheduledWindowHours } from "@/features/dispatch/utils/jobSchedule";

import type {
  AssignmentStatus,
  DispatchEventType,
  DispatchPriority,
  DispatchStatus,
} from "@/features/dispatch/types/dispatch";
import {
  appendDispatchEvent,
  createDispatchPlan,
  loadDispatchSnapshot,
  upsertCrewAssignment,
  upsertScheduleBlock,
  updateDispatchPlanPlacement,
  getDispatchPlanById,
  type CrewAssignmentWriteInput,
  type DispatchPlanWriteInput,
  type ScheduleBlockWriteInput,
} from "@/repositories/dispatch";

export { loadDispatchSnapshot };

/**
 * Job-level context the dispatch board filters need but the snapshot lacks:
 * the contractors assigned to each job (jobs carry contractor_ids; dispatch
 * plans don't) and the contractor list for the filter dropdown. Also returns
 * all job IDs so the board can drop dispatch plans orphaned by job deletion.
 */
export async function loadDispatchJobContext(): Promise<{
  contractors: { id: string; name: string }[];
  jobContractorIds: Record<string, string[]>;
  jobIds: string[];
  jobs: Awaited<ReturnType<typeof listJobs>>;
}> {
  const [jobs, contractorList] = await Promise.all([
    listJobs(),
    listContractors(),
  ]);

  const jobContractorIds: Record<string, string[]> = {};

  for (const job of jobs) {
    if (job.contractorIds && job.contractorIds.length > 0) {
      jobContractorIds[job.id] = job.contractorIds;
    }
  }

  return {
    contractors: contractorList.map((contractor) => ({
      id: contractor.id,
      name: contractor.companyName,
    })),
    jobContractorIds,
    jobIds: jobs.map((job) => job.id),
    jobs,
  };
}
export async function createPlan(input: DispatchPlanWriteInput) {
  return createDispatchPlan(input);
}

export async function assignCrewToPlan(
  planId: string,
  crewId: string,
  crewName: string,
  leadInstaller: string,
  supportingTechnicians: string[],
  jobId?: string,
  reassignmentHistory: AssignmentStatus extends string ? unknown[] : never[] = []
) {
  const input: CrewAssignmentWriteInput = {
    dispatchPlanId: planId,
    jobId,
    crewId,
    crewName,
    leadInstaller,
    supportingTechnicians,
    status: "confirmed" as AssignmentStatus,
    reassignmentHistory: reassignmentHistory as import("@/features/dispatch/types/dispatch").ReassignmentRecord[],
  };
  return upsertCrewAssignment(input);
}

export async function schedulePlan(
  input: ScheduleBlockWriteInput,
  planId: string
) {
  const planResult = await getDispatchPlanById(planId);
  const plan = planResult.ok ? planResult.data : null;
  const jobId = input.jobId || plan?.jobId;
  const job = jobId ? await getJobById(jobId) : null;

  let scheduledStartTime = input.scheduledStartTime;
  let scheduledEndTime = input.scheduledEndTime;
  let estimatedDurationHours = input.estimatedDurationHours;

  if (job) {
    const shiftedStart = job.scheduledStartAt
      ? shiftIsoToCompanyDate(job.scheduledStartAt, input.scheduledDate)
      : null;
    const shiftedEnd = job.scheduledEndAt
      ? shiftIsoToCompanyDate(job.scheduledEndAt, input.scheduledDate)
      : null;
    const clock = scheduledWindowClock(
      shiftedStart ?? job.scheduledStartAt,
      shiftedEnd ?? job.scheduledEndAt,
    );
    if (job.scheduledStartAt) scheduledStartTime = companyTimeOfDay(shiftedStart ?? job.scheduledStartAt) ?? clock.start;
    if (job.scheduledEndAt) scheduledEndTime = companyTimeOfDay(shiftedEnd ?? job.scheduledEndAt) ?? clock.end;
    estimatedDurationHours = scheduledWindowHours(
      shiftedStart ?? job.scheduledStartAt,
      shiftedEnd ?? job.scheduledEndAt,
      input.estimatedDurationHours || plan?.estimatedDurationHours || 4,
    );

    await updateJob(job.id, {
      scheduledFor: input.scheduledDate,
      ...(shiftedStart ? { scheduledStartAt: shiftedStart } : {}),
      ...(shiftedEnd ? { scheduledEndAt: shiftedEnd } : {}),
    });
  }

  const [blockResult, statusResult] = await Promise.all([
    upsertScheduleBlock({
      ...input,
      jobId: jobId || undefined,
      scheduledStartTime,
      scheduledEndTime,
      estimatedDurationHours,
      dispatchStatus: "scheduled",
    }),
    updateDispatchPlanPlacement(planId, {
      targetDate: input.scheduledDate,
      dispatchStatus: "scheduled",
      estimatedDurationHours,
    }),
  ]);
  return { blockResult, statusResult };
}

export async function emitDispatchEvent(
  dispatchPlanId: string,
  type: DispatchEventType,
  description: string,
  metadata?: Record<string, string>
) {
  return appendDispatchEvent({ dispatchPlanId, type, description, metadata });
}

export type { DispatchPlanWriteInput, DispatchPriority, DispatchStatus };
