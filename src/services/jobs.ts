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
import {
  countJobs,
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
import { updateDispatchPlanStatusByJobId } from "@/repositories/dispatch";
import { syncCustomerCounters } from "@/services/customers";
import { resolvePropertyIdByName, syncPropertyCounters } from "@/services/properties";
import { getInstalledSystemsSnapshot } from "@/services/installedSystems";
import { listFiles } from "@/services/storage";

const JOB_TYPES = new Set<JobType>(["Install", "Service", "Maintenance", "Inspection"]);
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
    assignedTo: input.assignedTo.trim(),
    scheduledFor: input.scheduledFor,
    appointmentHour: input.appointmentHour,
    location: input.location.trim(),
    summary: input.summary.trim(),
    notes: input.notes.trim(),
  };
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
  if (Number.isNaN(new Date(input.scheduledFor).getTime())) {
    throw new Error("Scheduled date is invalid.");
  }
  if (input.appointmentHour !== undefined && !isValidJobAppointmentHour(input.appointmentHour)) {
    throw new Error("Invalid appointment hour.");
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

function createJobNumber(index: number) {
  return `JOB-${1000 + index}`;
}

export async function listJobsWithActivity(): Promise<{ jobs: Job[]; activity: JobActivity[] }> {
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

  const nextIndex = (await countJobs(contextInput)) + 1;
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
      description: `Job scheduled for ${new Date(createdJob.scheduledFor).toLocaleDateString()}.`,
    }, contextInput),
  ]);

  await syncRelatedCounters(createdJob, contextInput);
  return createdJob;
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
  if ((existing.scheduled_for ?? "") !== updatedJob.scheduledFor) changedFields.push("schedule");
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

  await Promise.all([syncRelatedCounters(previousJob), syncRelatedCounters(updatedJob)]);

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
    description: `Status changed from ${existing.status} to ${status}${context?.actorId ? ` by ${context.actorId}` : ""}.`,
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

export async function setJobNotes(id: string, notes: string, context?: JobMutationContext) {
  const trimmedNotes = notes.trim();
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
  const photosUploaded = files.some((file) => file.mimeType.toLowerCase().startsWith("image/"));
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
