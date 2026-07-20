import "server-only";

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
