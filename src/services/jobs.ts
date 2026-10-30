import "server-only";

import type { Job, JobPriority, JobStatus, JobType } from "@/features/jobs/types/job";
import type { JobActivity } from "@/features/jobs/types/jobActivity";
import type { CreateJobInput, UpdateJobInput } from "@/features/jobs/types/jobStore";
import type { AppRole } from "@/services/authorization";
import { formatMissingJobFields, missingPersistedJobFields } from "@/features/jobs/utils/jobFormSubmit";
import { canTransitionStatus } from "@/features/jobs/utils/jobWorkspace";
import {
  isRequiredQaChecklistComplete,
  normalizeQaChecklist,
  parseLatestQaChecklist,
  type JobCompletionChecklistStatus,
  type RequiredQaChecklist,
} from "@/features/jobs/utils/jobCompletionChecklist";
import { resolveCustomerIdByName } from "@/repositories/properties";
import {
  DEFAULT_JOB_APPOINTMENT_HOUR,
  isValidJobAppointmentHour,
} from "@/features/jobs/utils/appointmentWindow";
import type { SessionRepositoryContextInput } from "@/repositories/supabaseContext";
import { formatDateOnly } from "@/lib/dates"; import { actorDisplayName } from "@/lib/actors";
import { companyCalendarDate, todayInCompanyTimeZone } from "@/lib/timezone";
import { chooseDispatchPlanToKeep } from "@/features/dispatch/utils/dispatchPlanIdentity";
import { dispatchStatusForJob, scheduledWindowClock, scheduledWindowHours } from "@/features/dispatch/utils/jobSchedule";
import {
  EARLIER_NOTE_AUTHOR,
  JOB_NOTE_ACTIVITY_TITLE,
  jobNoteRoleLabel,
  noteBodiesToAppend,
} from "@/features/jobs/utils/jobNotes";
import {
  getMaxJobNumberSuffix,
  createJob as createJobRecord,
  createJobActivity as createJobActivityRecord,
  deleteJob as deleteJobRecord,
  getJobById,
  getJobRowById,
  listActivityByJobId,
  listJobActivity as listAllJobActivity,
  listJobs,
  listJobsByCustomerId,
  listJobsByPropertyId,
  listJobsForDispatch,
  toJob,
  updateJob as updateJobRecord,
} from "@/repositories/jobs";
import {
  createDispatchPlan,
  deleteDispatchPlansByJobId,
  deleteDispatchPlansForJobExcept,
  updateDispatchPlanStatusByJobId, listDispatchPlansByJobId,
  updateDispatchPlanPlacement,
  upsertScheduleBlock,
} from "@/repositories/dispatch";
import { getContractorById } from "@/repositories/contractors";
import { syncCustomerCounters } from "@/services/customers";
import { resolvePropertyIdByName, syncPropertyCounters } from "@/services/properties";
import { getInstalledSystemsSnapshot } from "@/services/installedSystems";
import { getCurrentOperator } from "@/services/currentOperator";
import { canSeeJobRevenue } from "@/features/reporting/utils/revenueAccess";
import { redactJobPriceActivity } from "@/features/jobs/utils/jobPrice";
import { listFiles } from "@/services/storage";
import { insertJobNote, listJobNotes } from "@/repositories/jobNotes";

const JOB_TYPES = new Set<JobType>(["Install", "Service", "Maintenance", "Inspection", "Estimate", "Callback"]);
const JOB_STATUSES = new Set<JobStatus>([
  "Scheduled",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
]);
const JOB_PRIORITIES = new Set<JobPriority>(["Low", "Medium", "High"]);

interface JobMutationContext {
  actorId?: string;
  role?: AppRole;
}

/**
 * Formats a date value as YYYY-MM-DD (ISO date-only) for dispatch plan
 * target dates. Unlike formatDateOnly (which returns a display string like
 * "Oct 2, 2026"), this produces a string safe for date arithmetic and for
 * matching against existing plan targetDate values.
 */
function toIsoDateOnly(value: string | null | undefined): string | undefined {
  return companyCalendarDate(value) ?? undefined;
}

function normalizeJobInput(input: CreateJobInput | UpdateJobInput): CreateJobInput | UpdateJobInput {
  return {
    ...input,
    estimateId: input.estimateId?.trim() || undefined,
    equipmentBundleId: input.equipmentBundleId?.trim() || undefined,
    title: input.title.trim(),
    customerName: input.customerName.trim(),
    propertyName: input.propertyName.trim(),
    assignedTo: input.assignedTo.trim(), assigneeIds: input.assigneeIds,
    scheduledFor: input.scheduledFor,
    appointmentHour: input.appointmentHour,
    scheduledStartAt: input.scheduledStartAt,
    scheduledEndAt: input.scheduledEndAt,
    arrivalWindowStartAt: input.arrivalWindowStartAt,
    arrivalWindowEndAt: input.arrivalWindowEndAt,
    location: input.location.trim(),
    summary: input.summary.trim(),
    notes: input.notes.trim(),
  };
}

/** Returns true when value is a non-empty string that parses to a valid Date. */
function isValidDateString(value: string | null | undefined): boolean {
  return !!value && !Number.isNaN(new Date(value).getTime());
}

function validateJobInput(input: CreateJobInput | UpdateJobInput) {
  const missing = missingPersistedJobFields(input);
  const missingMessage = formatMissingJobFields(missing);
  if (missingMessage) throw new Error(missingMessage);
  if (!JOB_TYPES.has(input.type)) throw new Error("Invalid job type.");
  if (!JOB_PRIORITIES.has(input.priority)) throw new Error("Invalid job priority.");

  // Validate the primary scheduling field (PR3C) when provided
  const hasNewScheduling = isValidDateString(input.scheduledStartAt);
  const hasLegacyScheduling = isValidDateString(input.scheduledFor);
  // A scheduled start time must be valid when explicitly provided (non-null).
  // Null/undefined means the job is intentionally unscheduled — that is valid.
  if (input.scheduledStartAt != null && !hasNewScheduling) {
    throw new Error("Scheduled start time is invalid.");
  }
  if (input.scheduledFor != null && !hasLegacyScheduling) {
    throw new Error("Scheduled date is invalid.");
  }

  if (input.appointmentHour !== undefined && !isValidJobAppointmentHour(input.appointmentHour)) {
    throw new Error("Invalid appointment hour.");
  }

  // Validate time window ordering
  if (
    input.scheduledStartAt &&
    input.scheduledEndAt &&
    new Date(input.scheduledStartAt) > new Date(input.scheduledEndAt)
  ) {
    throw new Error("Scheduled end time must be at or after the start time.");
  }

  if (
    input.arrivalWindowStartAt &&
    input.arrivalWindowEndAt &&
    new Date(input.arrivalWindowStartAt) > new Date(input.arrivalWindowEndAt)
  ) {
    throw new Error("Arrival window end time must be at or after the start time.");
  }
}

async function syncRelatedCounters(
  job: Pick<Job, "customerName" | "propertyName" | "status">,
  contextInput?: SessionRepositoryContextInput,
) {
  const [customerId, propertyId] = await Promise.all([
    resolveCustomerIdByName(job.customerName, contextInput),
    resolvePropertyIdByName(job.propertyName, contextInput),
  ]);

  if (customerId) {
    await syncCustomerCounters(customerId);
  }

  if (propertyId) {
    await syncPropertyCounters(propertyId, contextInput);
  }
}

function createJobNumber(suffix: number) {
  // Job numbers start at JOB-1001.
  return `JOB-${Math.max(suffix, 1001)}`;
}

async function ensureDispatchPlanForJob(job: Job): Promise<void> {
  try {
    const targetDate = job.scheduledStartAt ? toIsoDateOnly(job.scheduledStartAt) : job.scheduledFor ?? undefined;
    if (!targetDate) return;
    const hours = scheduledWindowHours(job.scheduledStartAt, job.scheduledEndAt, 4);
    const status = dispatchStatusForJob(job.status, true);
    const clock = scheduledWindowClock(job.scheduledStartAt, job.scheduledEndAt);
    const existingPlansResult = await listDispatchPlansByJobId(job.id);
    const existingPlans = existingPlansResult.ok ? existingPlansResult.data : [];
    // One plan per job. A date range used to insert a plan per day, and those
    // copies were all drawn on the company day.
    const keeper = chooseDispatchPlanToKeep(existingPlans, targetDate);
    let planId = keeper?.id;
    if (keeper) {
      await updateDispatchPlanPlacement(keeper.id, {
        targetDate,
        dispatchStatus: status,
        estimatedDurationHours: hours,
      });
      const removed = await deleteDispatchPlansForJobExcept(job.id, keeper.id);
      if (!removed.ok) throw new Error(removed.error.message);
    } else {
      const created = await createDispatchPlan({
        jobId: job.id,
        jobNumber: job.jobNumber,
        customerName: job.customerName,
        propertyName: job.propertyName,
        jobType: job.type,
        dispatchStatus: status,
        dispatchability: {
          isDispatchable: status === "scheduled",
          materialReadiness: { state: "not_satisfied", reason: "" },
          technicalReadiness: { state: "not_satisfied", reason: "" },
          customerReadiness: { state: "not_satisfied", reason: "" },
          crewReadiness: { state: job.assignedTo ? "satisfied" : "not_satisfied", reason: "" },
        },
        targetDate,
        estimatedDurationHours: hours,
        priority: job.priority === "High" ? "high" : job.priority === "Low" ? "low" : "normal",
        constraints: [],
      });
      if (created.ok) planId = created.data.id;
    }

    if (planId && status !== "ready_to_schedule" && status !== "cancelled") {
      await upsertScheduleBlock({
        dispatchPlanId: planId,
        jobId: job.id,
        crewName: job.assignedTo || "Unassigned",
        scheduledDate: targetDate,
        scheduledStartTime: clock.start,
        scheduledEndTime: clock.end,
        estimatedDurationHours: hours,
        jobType: job.type,
        customerName: job.customerName,
        propertyName: job.propertyName,
        dispatchStatus: status === "completed" ? "completed" : "scheduled",
      });
    }
  } catch {
    return;
  }
}
  export async function listJobsForDispatchService() {
  return listJobsForDispatch();
}

/**
 * The calendar and the jobs list share this loader. The repository default
 * of 50 rows hid the rest of a busy month, so page until the schedule is
 * complete (or a high safety cap).
 */
const WORKSPACE_JOB_PAGE_SIZE = 200;
const WORKSPACE_JOB_MAX_PAGES = 15;

async function listWorkspaceJobs(): Promise<Job[]> {
  const jobs: Job[] = [];
  for (let page = 1; page <= WORKSPACE_JOB_MAX_PAGES; page += 1) {
    const batch = await listJobs({ page, pageSize: WORKSPACE_JOB_PAGE_SIZE });
    jobs.push(...batch);
    if (batch.length < WORKSPACE_JOB_PAGE_SIZE) break;
  }
  return jobs;
}

async function viewerCanSeePrice(): Promise<boolean> {
  try {
    const operator = await getCurrentOperator();
    return canSeeJobRevenue(operator.appRole);
  } catch {
    return false;
  }
}

export async function listJobsWithActivity(): Promise<{ jobs: Job[]; activity: JobActivity[] }> {
  const [jobs, activity, canSeePrice] = await Promise.all([
    listWorkspaceJobs(),
    listAllJobActivity(),
    viewerCanSeePrice(),
  ]);
  return { jobs, activity: redactJobPriceActivity(activity, canSeePrice) };
}

export async function listJobsForCustomer(customerId: string): Promise<Job[]> {
  return listJobsByCustomerId(customerId);
}

export async function listJobsForProperty(propertyId: string): Promise<Job[]> {
  return listJobsByPropertyId(propertyId);
}

export async function fetchJobById(id: string): Promise<Job | null> {
  return getJobById(id);
}

export async function getJob(id: string): Promise<Job | null> {
  return fetchJobById(id);
}

export async function listJobActivity(jobId: string): Promise<JobActivity[]> {
  const [activity, canSeePrice] = await Promise.all([
    listActivityByJobId(jobId),
    viewerCanSeePrice(),
  ]);
  return redactJobPriceActivity(activity, canSeePrice);
}

export async function createJobActivity(
  jobId: string,
  activity: Pick<JobActivity, "type" | "title" | "description">,
) {
  return createJobActivityRecord({ jobId, ...activity });
}

export async function createJob(
  input: CreateJobInput,
  contextInput?: SessionRepositoryContextInput,
) {
  const normalized = normalizeJobInput(input) as CreateJobInput;
  const appointmentHour = normalized.appointmentHour ?? DEFAULT_JOB_APPOINTMENT_HOUR;
  normalized.appointmentHour = appointmentHour;
  validateJobInput(normalized);

  // Next number = highest JOB-<n> in use + 1. Never derive this from the
  // job count: deleting a job drops the count and reuses a live number.
  // The number lookup does not depend on resolving the customer or property.
  const [nextIndex, resolvedCustomerId, resolvedPropertyId] = await Promise.all([
    getMaxJobNumberSuffix(contextInput).then((suffix) => suffix + 1),
    normalized.customerId
      ? Promise.resolve(normalized.customerId)
      : resolveCustomerIdByName(normalized.customerName, contextInput),
    normalized.propertyId
      ? Promise.resolve(normalized.propertyId)
      : resolvePropertyIdByName(normalized.propertyName, contextInput),
  ]);
  const customerId = resolvedCustomerId;
  const propertyId = resolvedPropertyId;
  if (!customerId && normalized.customerName.trim()) throw new Error("Customer not found: " + normalized.customerName.trim() + ". Use '+ Create new'."); if (!propertyId && normalized.propertyName.trim()) throw new Error("Property not found: " + normalized.propertyName.trim() + ". Use '+ Create new'."); const createdJob = await createJobRecord(
    createJobNumber(nextIndex),
    {
      ...normalized,
      appointmentHour,
      customerId,
      propertyId,
      status: "Scheduled",
    },
    contextInput,
  );

  await Promise.all([
    createJobActivityRecord({
      jobId: createdJob.id,
      type: "created",
      title: "Job created",
      description: `New ${createdJob.type.toLowerCase()} job created from the job form.`,
    }, contextInput),
    createJobActivityRecord({
      jobId: createdJob.id,
      type: "assigned",
      title: "Technician assigned",
      description: `${createdJob.assignedTo} assigned to this job.`,
    }, contextInput),
    createJobActivityRecord({
      jobId: createdJob.id,
      type: "scheduled",
      title: "Schedule confirmed",
      description: createdJob.scheduledStartAt
        ? `Job scheduled for ${formatDateOnly(createdJob.scheduledStartAt)}.`
        : createdJob.scheduledFor
          ? `Job scheduled for ${formatDateOnly(createdJob.scheduledFor)}.`
          : "Job created without a scheduled date.",
    }, contextInput),
  ]);

  // Counters and the dispatch card do not depend on each other.
  await Promise.all([
    syncRelatedCounters(createdJob, contextInput),
    ensureDispatchPlanForJob(createdJob),
  ]);
  if (createdJob.notes.trim()) {
    try {
      await appendJobNote(createdJob.id, createdJob.notes, {
        actorId: contextInput?.userId,
      });
    } catch {
      // jobs.notes still holds the text if the history table is not ready yet.
    }
  }
  return createdJob;
}

export async function updateJob(id: string, input: UpdateJobInput) {
  const existing = await getJobRowById(id);

  if (!existing) {
    return null;
  }

  const normalized = normalizeJobInput(input) as UpdateJobInput;
  const incomingNotes = normalized.notes.trim();
  const previousNotes = existing.notes.trim();
  if (!incomingNotes) {
    normalized.notes = existing.notes;
  }
  // Keep the previous persisted values available so missing update fields
  // (including appointmentHour for legacy callers) can be validated safely.
  const previousJob = toJob(existing);
  const appointmentHour =
    normalized.appointmentHour ?? previousJob.appointmentHour ?? DEFAULT_JOB_APPOINTMENT_HOUR;
  normalized.appointmentHour = appointmentHour;
  validateJobInput(normalized);
  if (incomingNotes && incomingNotes !== previousNotes) {
    await appendJobNote(id, incomingNotes);
  }
  const [customerId, propertyId] = await Promise.all([
    resolveCustomerIdByName(normalized.customerName),
    resolvePropertyIdByName(normalized.propertyName),
  ]);

  const updatedJob = await updateJobRecord(id, {
    ...normalized,
    appointmentHour,
    customerId,
    propertyId,
    status: existing.status,
  });

  if (!updatedJob) {
    return null;
  }

  const changedFields: string[] = [];
  if (existing.title !== updatedJob.title) changedFields.push("title");
  if ((existing.estimate_id ?? "") !== (updatedJob.estimateId ?? "")) changedFields.push("estimate");
  if ((existing.equipment_bundle_id ?? "") !== (updatedJob.equipmentBundleId ?? "")) {
    changedFields.push("equipment");
  }
  if (existing.customer_name !== updatedJob.customerName) changedFields.push("customer");
  if (existing.property_name !== updatedJob.propertyName) changedFields.push("property");
  if (existing.assigned_to !== updatedJob.assignedTo) changedFields.push("assignee");
  if ((existing.scheduled_for ?? null) !== (updatedJob.scheduledFor ?? null)) changedFields.push("schedule");
  if ((existing.appointment_window ?? DEFAULT_JOB_APPOINTMENT_HOUR) !== appointmentHour) {
    changedFields.push("appointment hour");
  }
  if (existing.type !== updatedJob.type) changedFields.push("type");
  if (existing.priority !== updatedJob.priority) changedFields.push("priority");
  if (existing.location !== updatedJob.location) changedFields.push("location");
  if (existing.summary !== updatedJob.summary) changedFields.push("summary");
  if (existing.notes !== updatedJob.notes) changedFields.push("notes");

  if (changedFields.length > 0) {
    await createJobActivityRecord({
      jobId: updatedJob.id,
      type: "edited",
      title: "Job updated",
      description: `Updated fields: ${changedFields.join(", ")}.`,
    });
  }

  await Promise.all([syncRelatedCounters(previousJob), syncRelatedCounters(updatedJob)]); await ensureDispatchPlanForJob(updatedJob);

  return updatedJob;
}

export async function updateJobStatus(id: string, status: JobStatus, context?: JobMutationContext) {
  if (!JOB_STATUSES.has(status)) {
    throw new Error("Invalid job status.");
  }

  const existing = await getJobById(id);

  if (!existing) {
    return null;
  }

  if (context?.role === "tech" && status === "Cancelled") {
    throw new Error("Technicians cannot cancel jobs.");
  }

  if (existing.status === status) {
    const dispatchStatus = existing.status === "In Progress" ? "in_progress" : existing.status === "Completed" ? "completed" : null;
    if (dispatchStatus) {
      const dispatchResult = await updateDispatchPlanStatusByJobId(existing.id, dispatchStatus, todayInCompanyTimeZone());
      if (!dispatchResult.ok) throw new Error(dispatchResult.error.message);
    }
    return existing;
  }
  if (!canTransitionStatus(existing.status, status)) {
    throw new Error(
      `Invalid transition: job cannot move from '${existing.status}' to '${status}'.`,
    );
  }

  if (status === "Completed") {
    const checklist = await getJobCompletionChecklist(id, context?.role);
    if (!checklist.canComplete) {
      const blockers: string[] = [];
      if (!checklist.photosUploaded) blockers.push("missing at least one photo");
      if (!checklist.installedSystemsEntered) blockers.push("missing installed systems");
      if (!checklist.jobNotesCompleted) blockers.push("missing job notes");
      if (!checklist.requiredQaItemsComplete) blockers.push("incomplete required QA items");
      throw new Error(`Cannot complete job — ${blockers.join(", ")}.`);
    }
  }

  const updatedJob = await updateJobRecord(id, { status });

  if (!updatedJob) {
    return null;
  }

  const sideEffects: Array<Promise<unknown>> = [
    createJobActivityRecord({
      jobId: id,
      actorId: context?.actorId,
      type: "status",
      title:
        status === "In Progress"
          ? "Job started"
          : status === "Completed"
            ? "Job completed"
            : "Status updated",
      description: `Status changed from ${existing.status} to ${status}${context?.actorId ? ` by ${actorDisplayName(context.actorId) ?? "a team member"}` : ""}.`,
    }),
  ];

  if (existing.status !== updatedJob.status) {
    sideEffects.push(syncRelatedCounters(updatedJob));
    if (updatedJob.status === "In Progress" || updatedJob.status === "Completed" || updatedJob.status === "On Hold") {
      const dispatchStatus =
        updatedJob.status === "In Progress"
          ? "in_progress"
          : updatedJob.status === "Completed"
            ? "completed"
            : "on_hold";
      sideEffects.push(
        updateDispatchPlanStatusByJobId(updatedJob.id, dispatchStatus, todayInCompanyTimeZone()).then((dispatchResult) => {
          if (!dispatchResult.ok) throw new Error(dispatchResult.error.message);
        }),
      );
    }
  }

  await Promise.all(sideEffects);

  return updatedJob;
}

async function noteAuthor(context?: JobMutationContext): Promise<{ name: string; role: string }> {
  let name = "Team";
  let role = context?.role ?? "";
  try {
    const operator = await getCurrentOperator();
    if (operator.name.trim()) name = operator.name.trim();
    if (!role && operator.appRole) role = operator.appRole;
  } catch {
    // The note still saves when the profile lookup is unavailable.
  }
  if (context?.role) role = context.role;
  return { name, role };
}

/**
 * Append a note. Does not replace jobs.notes. When history is empty, the
 * current column text is stored first so an office note is not lost.
 */
export async function appendJobNote(id: string, note: string, context?: JobMutationContext) {
  const trimmedNote = note.trim();
  if (!trimmedNote) {
    throw new Error("Note is required.");
  }

  const existing = await getJobById(id);
  if (!existing) {
    return null;
  }

  const history = await listJobNotes(id);
  const bodies = noteBodiesToAppend({
    existingColumn: existing.notes,
    historyCount: history.length,
    incoming: trimmedNote,
  });
  const author = await noteAuthor(context);
  const newest = bodies[bodies.length - 1] ?? trimmedNote;
  // Technicians can insert only as themselves. Copying the previous column
  // into history is left to the migration (and to office/owner edits) so a
  // tech save does not fail row-level security or claim the old note.
  const preserved = bodies.length > 1 ? bodies[0] : null;
  if (preserved && context?.role !== "tech") {
    await insertJobNote({
      jobId: id,
      body: preserved,
      authorId: null,
      authorName: EARLIER_NOTE_AUTHOR,
      authorRole: "",
    });
  }

  await insertJobNote({
    jobId: id,
    body: newest,
    authorId: context?.actorId ?? null,
    authorName: author.name,
    authorRole: author.role,
  });

  const roleLabel = jobNoteRoleLabel(author.role);
  const byline = [author.name, roleLabel].filter(Boolean).join(" · ");
  await createJobActivityRecord({
    jobId: id,
    actorId: context?.actorId,
    type: "note",
    title: JOB_NOTE_ACTIVITY_TITLE,
    description: byline ? `${byline}\n${newest}` : newest,
  });

  return existing;
}

function isMissingJobNotesTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /job_notes/i.test(message) && /does not exist|schema cache|could not find/i.test(message);
}

export async function listJobNotesForJob(jobId: string) {
  try {
    return await listJobNotes(jobId);
  } catch (error) {
    if (isMissingJobNotesTable(error)) return [];
    throw error;
  }
}

export async function addJobNote(id: string, note: string, context?: JobMutationContext) {
  return appendJobNote(id, note, context);
}

/** F19: persist a contractor assignment to jobs.contractor_ids + timeline event. */
export async function assignContractor(
  id: string,
  contractorId: string,
  context?: JobMutationContext,
) {
  const trimmedId = contractorId.trim();

  if (!trimmedId) {
    throw new Error("Contractor is required.");
  }

  const existing = await getJobById(id);

  if (!existing) {
    return null;
  }

  const currentIds = existing.contractorIds ?? [];

  if (currentIds.includes(trimmedId)) {
    throw new Error("This contractor is already assigned to the job.");
  }

  // Reject unknown/stale contractor ids before writing — without this a
  // crafted or deleted id persists silently and renders "Unknown Contractor".
  const contractor = await getContractorById(trimmedId);

  if (!contractor) {
    throw new Error("Contractor not found.");
  }

  const updatedJob = await updateJobRecord(id, {
    contractorIds: [...currentIds, trimmedId],
  });

  if (!updatedJob) {
    return null;
  }

  await createJobActivityRecord({
    jobId: id,
    actorId: context?.actorId,
    type: "contractor",
    title: "Contractor assigned",
    description: `${contractor.companyName} assigned to the job.`,
  });

  return updatedJob;
}

/** F19: remove a contractor assignment, persisted + timeline event. */
export async function removeContractorAssignment(
  id: string,
  contractorId: string,
  context?: JobMutationContext,
) {
  const existing = await getJobById(id);

  if (!existing) {
    return null;
  }

  const nextIds = (existing.contractorIds ?? []).filter((entry) => entry !== contractorId);

  const updatedJob = await updateJobRecord(id, { contractorIds: nextIds });

  if (!updatedJob) {
    return null;
  }

  const contractor = await getContractorById(contractorId);

  await createJobActivityRecord({
    jobId: id,
    actorId: context?.actorId,
    type: "contractor",
    title: "Contractor unassigned",
    description: `${contractor?.companyName ?? contractorId} removed from the job.`,
  });

  return updatedJob;
}

export async function setJobNotes(id: string, notes: string, context?: JobMutationContext) {
  return appendJobNote(id, notes, context);
}

export async function updateRequiredQaChecklist(
  id: string,
  checklist: RequiredQaChecklist,
  context?: JobMutationContext,
) {
  const existing = await getJobById(id);
  if (!existing) {
    return null;
  }

  const normalizedChecklist = normalizeQaChecklist(checklist);

  await createJobActivityRecord({
    jobId: id,
    actorId: context?.actorId,
    type: "qa",
    title: "QA checklist updated",
    description: JSON.stringify(normalizedChecklist),
  });

  return normalizedChecklist;
}

export async function getJobCompletionChecklist(
  jobId: string,
  role?: AppRole,
): Promise<JobCompletionChecklistStatus> {
  if (!role) {
    throw new Error("Unable to validate completion checklist for this user.");
  }

  const [job, activity, files, snapshot] = await Promise.all([
    getJobById(jobId),
    listActivityByJobId(jobId),
    listFiles(role, { jobId }),
    getInstalledSystemsSnapshot(),
  ]);

  if (!job) {
    throw new Error(`Job '${jobId}' not found.`);
  }

  const qaChecklist = parseLatestQaChecklist(activity);
  const photosUploaded = files.some(
    (file) => file.mimeType.toLowerCase().startsWith("image/") && file.uploaderRole === "tech",
  );
  const installedSystemsEntered = snapshot.installedSystems.some(
    (system) => system.jobId === jobId || system.linkedWorkflowIds.includes(jobId),
  );
  const noteHistory = await listJobNotesForJob(jobId);
  const jobNotesCompleted = noteHistory.length > 0 || job.notes.trim().length > 0;
  const requiredQaItemsComplete = isRequiredQaChecklistComplete(qaChecklist);

  return {
    photosUploaded,
    installedSystemsEntered,
    jobNotesCompleted,
    requiredQaItemsComplete,
    customerSignaturePlaceholder: "optional",
    canComplete:
      photosUploaded &&
      installedSystemsEntered &&
      jobNotesCompleted &&
      requiredQaItemsComplete,
  };
}

export async function listJobFiles(jobId: string, role?: AppRole) {
  if (!role) {
    throw new Error("Unable to list job files for this user.");
  }
  return listFiles(role, { jobId });
}

export async function recordJobFileUpload(
  jobId: string,
  fileName: string,
  mimeType: string,
  context?: JobMutationContext,
) {
  const existing = await getJobById(jobId);
  if (!existing) {
    return null;
  }

  await createJobActivityRecord({
    jobId,
    actorId: context?.actorId,
    type: "file",
    title: "File uploaded",
    description: `${fileName} (${mimeType}) uploaded.`,
  });

  return true;
}

export async function deleteJob(id: string) {
  const existing = await getJobById(id);
  const deleted = await deleteJobRecord(id);

  if (deleted) {
    // Remove the job's dispatch plans so they don't linger as orphans.
    await deleteDispatchPlansByJobId(id);
  }

  if (deleted && existing) {
    await syncRelatedCounters(existing);
  }

  return deleted;
}
