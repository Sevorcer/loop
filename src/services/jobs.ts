import "server-only";

import type { Job, JobPriority, JobStatus, JobType } from "@/features/jobs/types/job";
import type { JobActivity } from "@/features/jobs/types/jobActivity";
import type { CreateJobInput, UpdateJobInput } from "@/features/jobs/types/jobStore";
import { resolveCustomerIdByName } from "@/repositories/properties";
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
import { syncCustomerCounters } from "@/services/customers";
import { resolvePropertyIdByName, syncPropertyCounters } from "@/services/properties";

const JOB_TYPES = new Set<JobType>(["Install", "Service", "Maintenance", "Inspection"]);
const JOB_STATUSES = new Set<JobStatus>([
  "Scheduled",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
]);
const JOB_PRIORITIES = new Set<JobPriority>(["Low", "Medium", "High"]);

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
}

async function syncRelatedCounters(
  job: Pick<Job, "customerId" | "propertyId" | "customerName" | "propertyName" | "status">,
  contextInput?: SessionRepositoryContextInput,
) {
  // Use pre-resolved IDs from the Job record to avoid redundant name-to-ID
  // lookups. Fall back to name resolution only when IDs are absent (legacy
  // paths where the job row pre-dates ID tracking).
  let customerId = job.customerId ?? null;
  let propertyId = job.propertyId ?? null;

  if (!customerId || !propertyId) {
    const [resolvedCustomerId, resolvedPropertyId] = await Promise.all([
      customerId ? Promise.resolve(customerId) : resolveCustomerIdByName(job.customerName, contextInput),
      propertyId ? Promise.resolve(propertyId) : resolvePropertyIdByName(job.propertyName, contextInput),
    ]);
    customerId = resolvedCustomerId;
    propertyId = resolvedPropertyId;
  }

  await Promise.all([
    customerId ? syncCustomerCounters(customerId, contextInput) : Promise.resolve(),
    propertyId ? syncPropertyCounters(propertyId, contextInput) : Promise.resolve(),
  ]);
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
  validateJobInput(normalized);

  const previousJob = toJob(existing);
  const [customerId, propertyId] = await Promise.all([
    resolveCustomerIdByName(normalized.customerName),
    resolvePropertyIdByName(normalized.propertyName),
  ]);

  const updatedJob = await updateJobRecord(id, {
    ...normalized,
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

  // Deduplicate counter syncs: only sync each unique customer/property ID once.
  // When customer and property haven't changed, the naive two-call approach would
  // run 2× the DB work for the same entities. Collect distinct IDs and sync once.
  const uniqueCustomerIds = new Set<string>(
    [previousJob.customerId, updatedJob.customerId].filter((id): id is string => Boolean(id)),
  );
  const uniquePropertyIds = new Set<string>(
    [previousJob.propertyId, updatedJob.propertyId].filter((id): id is string => Boolean(id)),
  );
  await Promise.all([
    ...[...uniqueCustomerIds].map((cid) => syncCustomerCounters(cid)),
    ...[...uniquePropertyIds].map((pid) => syncPropertyCounters(pid)),
  ]);

  return updatedJob;
}

export async function updateJobStatus(id: string, status: JobStatus) {
  if (!JOB_STATUSES.has(status)) {
    throw new Error("Invalid job status.");
  }

  const existing = await getJobById(id);

  if (!existing) {
    return null;
  }

  const updatedJob = await updateJobRecord(id, { status });

  if (!updatedJob) {
    return null;
  }

  const description =
    status === "In Progress"
      ? "Job moved to In Progress from the detail view."
      : status === "On Hold"
        ? "Job placed On Hold pending follow-up or issue resolution."
        : status === "Completed"
          ? "Job marked Completed from the detail view."
          : status === "Cancelled"
            ? "Job cancelled from the detail view."
            : "Job status updated from the detail view.";

  await createJobActivityRecord({
    jobId: id,
    type: "status",
    title: "Status updated",
    description,
  });

  if (existing.status !== updatedJob.status) {
    await syncRelatedCounters(updatedJob);
  }

  return updatedJob;
}

export async function addJobNote(id: string, note: string) {
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
    type: "note",
    title: "Note added",
    description: trimmedNote,
  });

  return updatedJob;
}

export async function deleteJob(id: string) {
  const existing = await getJobById(id);
  const deleted = await deleteJobRecord(id);

  if (deleted && existing) {
    await syncRelatedCounters(existing);
  }

  return deleted;
}
