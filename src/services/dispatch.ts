import "server-only";

import { listContractors } from "@/repositories/contractors";
import { listJobs } from "@/repositories/jobs";

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
  updateDispatchPlanStatus,
  type CrewAssignmentWriteInput,
  type DispatchPlanWriteInput,
  type ScheduleBlockWriteInput,
} from "@/repositories/dispatch";

export { loadDispatchSnapshot };

/**
 * Job-level context the dispatch board filters need but the snapshot lacks:
 * the contractors assigned to each job (jobs carry contractor_ids; dispatch
 * plans don't) and the contractor list for the filter dropdown.
 */
export async function loadDispatchJobContext(): Promise<{
  contractors: { id: string; name: string }[];
  jobContractorIds: Record<string, string[]>;
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
  const [blockResult, statusResult] = await Promise.all([
    upsertScheduleBlock(input),
    updateDispatchPlanStatus(planId, "scheduled"),
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
