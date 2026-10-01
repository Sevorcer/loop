import "server-only";

import type { Job, JobPriority, JobStatus, JobType } from "@/features/jobs/types/job";
import type { JobActivity } from "@/features/jobs/types/jobActivity";
import type { CreateJobInput, UpdateJobInput } from "@/features/jobs/types/jobStore";
import type { AppRole } from "@/services/authorization";
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
  toJob,
  updateJob as updateJobRecord,
} from "@/repositories/jobs";
import {
  createDispatchPlan,
  updateDispatchPlanStatusByJobId, listDispatchPlans,
} from "@/repositories/dispatch";
import { getContractorById } from "@/repositories/contractors";
import { syncCustomerCounters } from "@/services/customers";
import { resolvePropertyIdByName, syncPropertyCounters } from "@/services/properties";
import { getInstalledSystemsSnapshot } from "@/services/installedSystems";
import { listFiles } from "@/services/storage";

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
  if (!input.title) throw new Error("Job title is required.");
  if (!input.customerName) throw new Error("Customer name is required.");
  if (!input.propertyName) throw new Error("Property name is required.");
  if (!input.assignedTo) throw new Error("Assigned technician is required.");
  if (!input.location) throw new Error("Location is required.");
  if (!input.summary) throw new Error("Work summary is required.");
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

async function ensureDispatchPlanForJob(job: Job): Promise<void> { try { const startDate = job.scheduledStartAt ? formatDateOnly(job.scheduledStartAt) : job.scheduledFor ?? undefined; if (!startDate) { return; } const endDate = job.scheduledEndAt ? formatDateOnly(job.scheduledEndAt) : startDate; const existingPlansResult = await listDispatchPlans(); const existingPlans = existingPlansResult.ok ? existingPlansResult.data : []; const plannedDates = new Set(existingPlans.filter((plan) => plan.jobId === job.id).map((plan) => plan.targetDate)); const cursor = new Date(startDate + "T00:00:00Z"); const last = new Date(endDate + "T00:00:00Z"); while (cursor <= last) { const dateKey = cursor.toISOString().slice(0, 10); if (!plannedDates.has(dateKey)) { await createDispatchPlan({ jobId: job.id, jobNumber: job.jobNumber, customerName: job.customerName, propertyName: job.propertyName, jobType: job.type, dispatchStatus: "ready_to_schedule", dispatchability: { isDispatchable: false, materialReadiness: { state: "not_satisfied", reason: "" }, technicalReadiness: { state: "not_satisfied", reason: "" }, customerReadiness: { state: "not_satisfied", reason: "" }, crewReadiness: { state: "not_satisfied", reason: "" } }, targetDate: dateKey, estimatedDurationHours: 4, priority: job.priority === "High" ? "high" : job.priority === "Low" ? "low" : "normal", constraints: [] }); plannedDates.add(dateKey); } cursor.setUTCDate(cursor.getUTCDate() + 1); } } catch { return; } } export async function listJobsWithActivity(): Promise<{ jobs: Job[]; activity: JobActivity[] }> {
  const [jobs, activity] = await Promise.all([listJobs(), listAllJobActivity()]);
  return { jobs, activity };
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
  return listActivityByJobId(jobId);
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
  const nextIndex = (await getMaxJobNumberSuffix(contextInput)) + 1;
  const [customerId, propertyId] = await Promise.all([
    resolveCustomerIdByName(normalized.customerName, contextInput),
    resolvePropertyIdByName(normalized.propertyName, contextInput),
  ]);

  const createdJob = await createJobRecord(
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

  await syncRelatedCounters(createdJob, contextInput);

  // Every job needs a dispatch plan or it never shows on the dispatch board
  // (which reads dispatch_plans, not jobs). Before this, a job created via
  // the job form was structurally invisible to dispatch until someone created
  // a plan through the API. Best-effort: a dispatch hiccup must never fail
  // job creation — dispatch can backfill the plan later.
  try {
    await createDispatchPlan({
      jobId: createdJob.id,
      jobNumber: createdJob.jobNumber,
      customerName: createdJob.customerName,
      propertyName: createdJob.propertyName,
      jobType: createdJob.type,
      dispatchStatus: "ready_to_schedule",
      dispatchability: {
        isDispatchable: false,
        materialReadiness: { state: "not_satisfied", reason: "" },
        technicalReadiness: { state: "not_satisfied", reason: "" },
        customerReadiness: { state: "not_satisfied", reason: "" },
        crewReadiness: { state: "not_satisfied", reason: "" },
      },
      targetDate:
        createdJob.scheduledFor ??
        (createdJob.scheduledStartAt
          ? formatDateOnly(createdJob.scheduledStartAt)
          : undefined),
      estimatedDurationHours: 4,
      priority:
        createdJob.priority === "High"
          ? "high"
          : createdJob.priority === "Low"
            ? "low"
            : "normal",
      constraints: [],
    });
  } catch {
    // Job exists either way; leave dispatch to backfill.
  }

  await ensureDispatchPlanForJob(createdJob); return createdJob;
}

export async function updateJob(id: string, input: UpdateJobInput) {
  const existing = await getJobRowById(id);

  if (!existing) {
    return null;
  }

  const normalized = normalizeJobInput(input) as UpdateJobInput;
  // Keep the previous persisted values available so missing update fields
  // (including appointmentHour for legacy callers) can be validated safely.
  const previousJob = toJob(existing);
  const appointmentHour =
    normalized.appointmentHour ?? previousJob.appointmentHour ?? DEFAULT_JOB_APPOINTMENT_HOUR;
  normalized.appointmentHour = appointmentHour;
  validateJobInput(normalized);
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

  if (!canTransitionStatus(existing.status, status)) {
    throw new Error(
      `Invalid transition: job cannot move from '${existing.status}' to '${status}'.`,
    );
  }

  if (status === "Completed") {
    const checklist = await getJobCompletionChecklist(id, context?.role);
    if (!checklist.canComplete) {
      const blockers: string[] = [];
      if (!checklist.photosUploaded) blockers.push("at least one photo uploaded");
      if (!checklist.installedSystemsEntered) blockers.push("installed systems entered");
      if (!checklist.jobNotesCompleted) blockers.push("job notes completed");
      if (!checklist.requiredQaItemsComplete) blockers.push("required QA items complete");
      throw new Error(`Completion checklist incomplete: ${blockers.join(", ")}.`);
    }
  }

  const updatedJob = await updateJobRecord(id, { status });

  if (!updatedJob) {
    return null;
  }

  await createJobActivityRecord({
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
  });

  if (existing.status !== updatedJob.status) {
    await syncRelatedCounters(updatedJob);
    if (updatedJob.status === "In Progress" || updatedJob.status === "Completed") {
      const dispatchStatus = updatedJob.status === "In Progress" ? "in_progress" : "completed";
      const dispatchResult = await updateDispatchPlanStatusByJobId(updatedJob.id, dispatchStatus);
      if (!dispatchResult.ok) {
        throw new Error(dispatchResult.error.message);
      }
    }
  }

  return updatedJob;
}

export async function addJobNote(id: string, note: string, context?: JobMutationContext) {
  const trimmedNote = note.trim();

  if (!trimmedNote) {
    throw new Error("Note is required.");
  }

  const existing = await getJobById(id);

  if (!existing) {
    return null;
  }

  const nextNotes = existing.notes ? `${existing.notes}\n\n${trimmedNote}` : trimmedNote;
  const updatedJob = await updateJobRecord(id, { notes: nextNotes });

  if (!updatedJob) {
    return null;
  }

  await createJobActivityRecord({
    jobId: id,
    actorId: context?.actorId,
    type: "note",
    title: "Note added",
    description: trimmedNote,
  });

  return updatedJob;
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

export async function setJobNotes(id: string, notes: string, context?: JobMutationContext) {  const trimmedNotes = notes.trim();
  if (!trimmedNotes) {
    throw new Error("Notes are required.");
  }

  const existing = await getJobById(id);
  if (!existing) {
    return null;
  }

  const updatedJob = await updateJobRecord(id, { notes: trimmedNotes });
  if (!updatedJob) {
    return null;
  }

  await createJobActivityRecord({
    jobId: id,
    actorId: context?.actorId,
    type: "note",
    title: "Notes updated",
    description: "Job notes updated.",
  });

  return updatedJob;
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
  const jobNotesCompleted = job.notes.trim().length > 0;
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

  if (deleted && existing) {
    await syncRelatedCounters(existing);
  }

  return deleted;
}
