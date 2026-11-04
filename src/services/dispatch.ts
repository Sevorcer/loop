import "server-only";

import { listContractors } from "@/repositories/contractors";
import { createJobActivity, getJobById, listJobsByIds, setJobPeople, updateJob } from "@/repositories/jobs";
import {
  addCalendarDays,
  companyCalendarDate,
  companyTimeOfDay,
  shiftIsoToCompanyDate,
  todayInCompanyTimeZone,
} from "@/lib/timezone";
import { computeRescheduleShift } from "@/lib/rescheduleShift";
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
  listDispatchPlansByJobId,
  loadDispatchSnapshot,
  upsertCrewAssignment,
  upsertScheduleBlock,
  updateDispatchPlanPlacement,
  getDispatchPlanById,
  type CrewAssignmentWriteInput,
  type DispatchPlanWriteInput,
  type ScheduleBlockWriteInput,
} from "@/repositories/dispatch";

/** How many days of completed work the dispatch board keeps on screen. */
export const DISPATCH_BOARD_COMPLETED_WINDOW_DAYS = 7;

/**
 * The dispatch board's windowed snapshot: all active plans (any date) plus
 * completed plans from the last DISPATCH_BOARD_COMPLETED_WINDOW_DAYS days,
 * counted in the company timezone.
 *
 * Both the server-rendered board page and the /api/dispatch-plans snapshot
 * API use this windowed read. The customer/property timeline uses the
 * scoped loadDispatchDataForJobs() in the repository layer instead.
 */
export async function loadBoardDispatchSnapshot() {
  const completedSince = addCalendarDays(
    todayInCompanyTimeZone(),
    -DISPATCH_BOARD_COMPLETED_WINDOW_DAYS,
  );
  return loadDispatchSnapshot({ boardWindow: { completedSince } });
}

/**
 * Job-level context the dispatch board filters need but the snapshot lacks:
 * the contractors assigned to each job (jobs carry contractor_ids; dispatch
 * plans don't) and the contractor list for the filter dropdown. Also returns
 * the job IDs so the board can drop dispatch plans orphaned by job deletion.
 *
 * The jobs are the ones the snapshot's plans point at, fetched by id. This
 * used to read listJobs(), whose default page is the 50 newest jobs: every
 * plan for an older job — the pilot jobs and everything the Service Fusion
 * import brought in — was then dropped by the board as an "orphan" even
 * though the job exists. Fetching by id has no page cap, so every plan in
 * the snapshot keeps its job.
 */
export async function loadDispatchJobContext(
  plans: ReadonlyArray<{ jobId?: string | null }> = [],
): Promise<{
  contractors: { id: string; name: string }[];
  jobContractorIds: Record<string, string[]>;
  jobIds: string[];
  jobs: Awaited<ReturnType<typeof listJobsByIds>>;
}> {
  const planJobIds = [
    ...new Set(plans.map((plan) => plan.jobId).filter((id): id is string => !!id)),
  ];
  const [jobs, contractorList] = await Promise.all([
    listJobsByIds(planJobIds),
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

async function recordPeopleChange(jobId: string, description: string) {
  try {
    await createJobActivity({
      jobId,
      type: "edited",
      title: "People assigned",
      description,
    });
  } catch {
    // The assignment is already saved. A history-row failure must not undo it.
  }
}

export async function assignPeopleToJob(jobId: string, assigneeIds: string[]) {
  const job = await setJobPeople(jobId, assigneeIds);
  if (!job) {
    throw Object.assign(new Error("Job not found."), { status: 404 });
  }
  const label = job.assignedTo.trim();
  await recordPeopleChange(
    jobId,
    label ? `${label} assigned to this job.` : "Everyone was removed from this job.",
  );
  return job;
}

export async function movePersonBetweenJobs(
  fromJobId: string,
  toJobId: string,
  personId: string,
) {
  if (fromJobId === toJobId) {
    throw Object.assign(new Error("Invalid move. Pick a different job."), { status: 400 });
  }
  const [fromJob, toJob] = await Promise.all([getJobById(fromJobId), getJobById(toJobId)]);
  if (!fromJob || !toJob) {
    throw Object.assign(new Error("Job not found."), { status: 404 });
  }
  const fromIds = (fromJob.assignees ?? []).map((assignee) => assignee.id);
  if (!fromIds.includes(personId)) {
    throw Object.assign(new Error("That person is not on the job."), { status: 400 });
  }
  const person = fromJob.assignees?.find((assignee) => assignee.id === personId);
  const toIds = (toJob.assignees ?? []).map((assignee) => assignee.id);
  const nextTo = toIds.includes(personId) ? toIds : [...toIds, personId];
  const nextFrom = fromIds.filter((id) => id !== personId);
  const [savedTarget, savedSource] = await Promise.all([
    setJobPeople(toJobId, nextTo),
    setJobPeople(fromJobId, nextFrom),
  ]);
  const name = person?.name ?? "A person";
  await Promise.all([
    recordPeopleChange(toJobId, `${name} was added to this job.`),
    recordPeopleChange(fromJobId, `${name} was moved to ${toJob.jobNumber}.`),
  ]);
  return { source: savedSource, target: savedTarget, personName: name, toJobNumber: toJob.jobNumber };
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

/**
 * Reschedule a job by shifting its dates to a new target day. If the job has
 * dispatch plans, the most recent one's schedule block and placement are moved
 * too (via schedulePlan). If it has no plans, the job dates are updated
 * directly. Used by the calendar drag-to-reschedule so that dispatch plans
 * stay in sync.
 */
export async function rescheduleJobByDayShift(
  jobId: string,
  grabDay: string,
  dropDay: string,
) {
  if (grabDay === dropDay) return;
  const job = await getJobById(jobId);
  if (!job) throw new Error(`Job '${jobId}' not found.`);

  // Find the job's dispatch plan(s); use the most recent one.
  const plansResult = await listDispatchPlansByJobId(jobId);
  const plans = plansResult.ok ? plansResult.data : [];
  if (plans.length > 0) {
    const plan = plans[plans.length - 1];
    // schedulePlan handles shift math, job update, block upsert, and
    // plan placement update — the same path the dispatch board uses.
    await schedulePlan(
      {
        dispatchPlanId: plan.id,
        jobId,
        scheduledDate: dropDay,
        scheduledStartTime: "07:00",
        scheduledEndTime: "16:00",
        estimatedDurationHours: plan.estimatedDurationHours ?? 4,
        crewName: "",
        jobType: plan.jobType ?? job.type ?? "",
        customerName: plan.customerName ?? job.customerName ?? "",
        propertyName: plan.propertyName ?? job.propertyName ?? "",
        dispatchStatus: "scheduled",
      },
      plan.id,
    );
  } else {
    // No dispatch plan — move the job dates directly.
    const shifted = job.scheduledStartAt
      ? computeRescheduleShift({
          scheduledStartAt: job.scheduledStartAt,
          scheduledEndAt: job.scheduledEndAt ?? null,
          grabDay,
          dropDay,
        })
      : null;

    await updateJob(jobId, {
      scheduledFor: dropDay,
      ...(shifted?.scheduledStartAt ? { scheduledStartAt: shifted.scheduledStartAt } : {}),
      ...(shifted?.scheduledEndAt ? { scheduledEndAt: shifted.scheduledEndAt } : {}),
    });
  }
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
    // When the job already has a scheduledStartAt, compute the day delta
    // between its current start date and the target date, then shift both
    // start and end by that delta. This preserves multi-day job spans —
    // the old code pinned both to the drop date, collapsing multi-day jobs.
    let shiftedStart: string | null = null;
    let shiftedEnd: string | null = null;

    if (job.scheduledStartAt) {
      const grabDay = companyCalendarDate(job.scheduledStartAt);
      if (grabDay) {
        const shifted = computeRescheduleShift({
          scheduledStartAt: job.scheduledStartAt,
          scheduledEndAt: job.scheduledEndAt ?? null,
          grabDay,
          dropDay: input.scheduledDate,
        });
        shiftedStart = shifted.scheduledStartAt;
        shiftedEnd = shifted.scheduledEndAt;
      } else {
        shiftedStart = shiftIsoToCompanyDate(job.scheduledStartAt, input.scheduledDate);
      }
    }

    // Jobs without a scheduledStartAt but with a scheduledEndAt: pin end to
    // the target date (legacy single-day behaviour, preserving time of day).
    if (!shiftedEnd && job.scheduledEndAt && !job.scheduledStartAt) {
      shiftedEnd = shiftIsoToCompanyDate(job.scheduledEndAt, input.scheduledDate);
    }

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
