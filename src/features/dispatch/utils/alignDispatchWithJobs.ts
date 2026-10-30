import type { Job, JobStatus } from "@/features/jobs/types/job";
import { companyCalendarDate, hoursBetweenIso } from "@/lib/timezone";
import type {
  CrewAssignment,
  DispatchPlan,
  DispatchSnapshot,
  ScheduleBlock,
} from "../types/dispatch";
import { resolvePlanPeople, teamLabelForPeople } from "./dispatchPeople";
import { chooseDispatchPlanToKeep } from "./dispatchPlanIdentity";
import { dispatchMetricsForPlans } from "./dispatchUtils";
import { dispatchStatusForJob, scheduledWindowClock, scheduledWindowHours } from "./jobSchedule";

export interface DispatchJobSchedule {
  id: string;
  status: JobStatus;
  scheduledFor?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  assignedTo?: string | null;
  assignees?: { id: string; name: string }[];
}

function jobCompanyDate(job: DispatchJobSchedule): string | null {
  return companyCalendarDate(job.scheduledStartAt) ?? companyCalendarDate(job.scheduledFor);
}

function showsOnCrewDay(status: DispatchPlan["dispatchStatus"]): boolean {
  return (
    status === "scheduled" ||
    status === "in_progress" ||
    status === "on_hold" ||
    status === "completed"
  );
}

/**
 * Several plans can exist for one job. Keep one — the plan already on the
 * job's company day when there is one — so the board and crew schedule draw
 * a single card for that job on that day.
 */
export function collapseDispatchPlansToOnePerJob(
  plans: DispatchPlan[],
  jobsById: Map<string, DispatchJobSchedule>,
): DispatchPlan[] {
  const unlinked: DispatchPlan[] = [];
  const grouped = new Map<string, DispatchPlan[]>();

  for (const plan of plans) {
    if (!plan.jobId) {
      unlinked.push(plan);
      continue;
    }
    const group = grouped.get(plan.jobId) ?? [];
    group.push(plan);
    grouped.set(plan.jobId, group);
  }

  const kept: DispatchPlan[] = [];
  for (const [jobId, group] of grouped) {
    const companyDate = jobCompanyDate(jobsById.get(jobId) ?? { id: jobId, status: "Scheduled" });
    const chosen = chooseDispatchPlanToKeep(group, companyDate);
    if (chosen) kept.push(chosen);
  }

  return [...unlinked, ...kept];
}

/**
 * Make the dispatch board follow the job. Plans created as "ready_to_schedule"
 * with a hardcoded 4h estimate are rewritten in memory from the job's real
 * window, company-timezone day, and status. Schedule blocks are aligned to
 * that day so a 2:00–5:00 PM Pacific job does not also appear the next day.
 * One plan is kept per job before that rewrite, so extra plans are not drawn
 * on top of each other.
 */
export function alignDispatchSnapshotWithJobs(
  snapshot: DispatchSnapshot,
  jobs: DispatchJobSchedule[],
): DispatchSnapshot {
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const assignmentByPlan = new Map<string, CrewAssignment>();
  for (const assignment of snapshot.crewAssignments) {
    assignmentByPlan.set(assignment.dispatchPlanId, assignment);
  }

  const sourcePlans = collapseDispatchPlansToOnePerJob(snapshot.dispatchPlans, jobsById);
  const plans = sourcePlans.map((plan) => {
    const job = plan.jobId ? jobsById.get(plan.jobId) : undefined;
    if (!job) return plan;
    const companyDate = jobCompanyDate(job);
    const hours = job.scheduledStartAt
      ? scheduledWindowHours(job.scheduledStartAt, job.scheduledEndAt, plan.estimatedDurationHours)
      : plan.estimatedDurationHours;
    const next: DispatchPlan = {
      ...plan,
      dispatchStatus: dispatchStatusForJob(job.status, Boolean(companyDate), plan.dispatchStatus),
      estimatedDurationHours: hours,
      scheduledStartAt: job.scheduledStartAt ?? plan.scheduledStartAt ?? null,
      scheduledEndAt: job.scheduledEndAt ?? null,
    };
    if (companyDate) next.targetDate = companyDate;
    const assignment = assignmentByPlan.get(plan.id);
    const crew = assignment
      ? snapshot.crews.find((item) => item.id === assignment.crewId)
      : undefined;
    const resolved = resolvePlanPeople({
      jobAssignees: job.assignees,
      assignedTo: job.assignedTo,
      assignment,
      crew,
    });
    if (resolved.length > 0) {
      next.assignees = resolved;
      next.assignedTechNames = resolved.map((person) => person.name);
    } else if (!next.assignedTechNames?.length && job.assignedTo?.trim()) {
      next.assignedTechNames = job.assignedTo.split(",").map((name) => name.trim()).filter(Boolean);
    }
    return next;
  });

  const blocksByPlan = new Map<string, ScheduleBlock>();
  for (const block of snapshot.scheduleBlocks) {
    if (!blocksByPlan.has(block.dispatchPlanId)) {
      blocksByPlan.set(block.dispatchPlanId, block);
    }
  }

  const scheduleBlocks: ScheduleBlock[] = [];
  for (const plan of plans) {
    if (!plan.targetDate || !showsOnCrewDay(plan.dispatchStatus)) continue;
    const job = plan.jobId ? jobsById.get(plan.jobId) : undefined;
    const existing = blocksByPlan.get(plan.id);
    const clock = scheduledWindowClock(job?.scheduledStartAt, job?.scheduledEndAt);
    const assignment = assignmentByPlan.get(plan.id);
    const team = teamLabelForPeople(plan.assignees ?? []);
    const techLabel = (plan.assignedTechNames ?? []).filter(Boolean).join(", ");
    const crewName = team || techLabel || assignment?.crewName || existing?.crewName || "Unassigned";
    const hours =
      hoursBetweenIso(job?.scheduledStartAt, job?.scheduledEndAt) ?? plan.estimatedDurationHours;

    scheduleBlocks.push({
      id: existing?.id ?? `derived-${plan.id}`,
      dispatchPlanId: plan.id,
      jobId: plan.jobId,
      crewAssignmentId: existing?.crewAssignmentId ?? assignment?.id ?? "",
      crewName,
      scheduledDate: plan.targetDate,
      scheduledStartTime: job?.scheduledStartAt ? clock.start : existing?.scheduledStartTime ?? clock.start,
      scheduledEndTime: job?.scheduledEndAt ? clock.end : existing?.scheduledEndTime ?? clock.end,
      estimatedDurationHours: hours,
      jobType: plan.jobType,
      customerName: plan.customerName,
      propertyName: plan.propertyName,
      dispatchStatus: plan.dispatchStatus,
      scheduledStartAt: job?.scheduledStartAt ?? existing?.scheduledStartAt,
    });
  }

  return {
    ...snapshot,
    dispatchPlans: plans,
    scheduleBlocks,
    metrics: dispatchMetricsForPlans(plans),
  };
}

export function jobSchedulesFromJobs(jobs: Pick<Job, "id" | "status" | "scheduledFor" | "scheduledStartAt" | "scheduledEndAt" | "assignedTo" | "assignees">[]): DispatchJobSchedule[] {
  return jobs.map((job) => ({
    id: job.id,
    status: job.status,
    scheduledFor: job.scheduledFor,
    scheduledStartAt: job.scheduledStartAt,
    scheduledEndAt: job.scheduledEndAt,
    assignedTo: job.assignedTo,
    assignees: job.assignees,
  }));
}
