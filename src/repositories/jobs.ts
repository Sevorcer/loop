import "server-only";

import type {
  Job,
  JobAppointmentWindow,
  JobPriority,
  JobStatus,
  JobType,
} from "@/features/jobs/types/job";
import { DEFAULT_JOB_APPOINTMENT_WINDOW } from "@/features/jobs/utils/appointmentWindow";
import type { JobActivity, JobActivityType } from "@/features/jobs/types/jobActivity";

import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

interface JobRow {
  id: string;
  job_number: string;
  estimate_id: string | null;
  equipment_bundle_id: string | null;
  title: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  customer_id: string | null;
  customer_name: string;
  property_id: string | null;
  property_name: string;
  assigned_to: string;
  scheduled_for: string | null;
  // Optional: absent when the PR3A scheduling migration has not yet been applied.
  appointment_window?: JobAppointmentWindow | null;
  summary: string;
  location: string;
  notes: string;
  created_at: string;
}

interface JobActivityRow {
  id: string;
  job_id: string;
  actor_id: string | null;
  type: JobActivityType;
  title: string;
  description: string;
  created_at: string;
}

export interface JobWriteInput {
  estimateId?: string;
  equipmentBundleId?: string;
  title: string;
  type: JobType;
  status?: JobStatus;
  priority: JobPriority;
  customerId?: string | null;
  customerName: string;
  propertyId?: string | null;
  propertyName: string;
  assignedTo: string;
  scheduledFor: string;
  appointmentWindow?: JobAppointmentWindow;
  summary: string;
  location: string;
  notes: string;
}

export interface JobActivityWriteInput {
  jobId: string;
  actorId?: string;
  type: JobActivityType;
  title: string;
  description: string;
}

function mapJob(row: JobRow): Job {
  return {
    id: row.id,
    jobNumber: row.job_number,
    estimateId: row.estimate_id ?? undefined,
    equipmentBundleId: row.equipment_bundle_id ?? undefined,
    title: row.title,
    type: row.type,
    status: row.status,
    priority: row.priority,
    customerId: row.customer_id,
    customerName: row.customer_name,
    propertyId: row.property_id,
    propertyName: row.property_name,
    assignedTo: row.assigned_to,
    scheduledFor: row.scheduled_for ?? row.created_at.slice(0, 10),
    appointmentWindow: row.appointment_window ?? DEFAULT_JOB_APPOINTMENT_WINDOW,
    summary: row.summary,
    location: row.location,
    notes: row.notes,
  };
}

const JOB_SELECT_BASE =
  "id,job_number,estimate_id,equipment_bundle_id,title,type,status,priority,customer_id,customer_name,property_id,property_name,assigned_to,scheduled_for,summary,location,notes,created_at";

const JOB_SELECT = JOB_SELECT_BASE + ",appointment_window";

/**
 * Returns true when the Supabase/PostgREST error indicates that the
 * `appointment_window` column does not exist yet — i.e. migration
 * 20260729000001_pr3a_job_appointment_window.sql has not been applied.
 * Used to trigger a safe read/write fallback so the app remains usable
 * in environments that are behind on migrations.
 */
function isSchedulingColumnMissingError(error: { message?: string }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("appointment_window") &&
    (msg.includes("does not exist") || msg.includes("undefined column"))
  );
}

function mapActivity(row: JobActivityRow): JobActivity {
  return {
    id: row.id,
    jobId: row.job_id,
    actorId: row.actor_id ?? undefined,
    type: row.type,
    title: row.title,
    description: row.description,
    timestamp: row.created_at,
  };
}

export async function listJobsByCustomerId(customerId: string): Promise<Job[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const result = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  let data = result.data as unknown as JobRow[] | null;
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(
      "[jobs] appointment_window column missing – migration 20260729000001_pr3a_job_appointment_window.sql not yet applied. Falling back to base select.",
    );
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_BASE)
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    data = fallback.data as unknown as JobRow[] | null;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JobRow[]).map(mapJob);
}

export async function listJobs(): Promise<Job[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const result = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  let data = result.data as unknown as JobRow[] | null;
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(
      "[jobs] appointment_window column missing – migration 20260729000001_pr3a_job_appointment_window.sql not yet applied. Falling back to base select.",
    );
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_BASE)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    data = fallback.data as unknown as JobRow[] | null;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JobRow[]).map(mapJob);
}

export async function listJobActivity(): Promise<JobActivity[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_activity")
    .select("id,job_id,actor_id,type,title,description,created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JobActivityRow[]).map(mapActivity);
}

export async function getJobById(id: string): Promise<Job | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const result = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  let data = result.data as unknown as JobRow | null;
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(
      "[jobs] appointment_window column missing – migration 20260729000001_pr3a_job_appointment_window.sql not yet applied. Falling back to base select.",
    );
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_BASE)
      .eq("org_id", orgId)
      .eq("id", id)
      .maybeSingle();
    data = fallback.data as unknown as JobRow | null;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapJob(data) : null;
}

export async function getJobRowById(id: string): Promise<JobRow | null> {
  const { supabase, orgId } = await getRepositoryContext();

  const result = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();

  let data = result.data as unknown as JobRow | null;
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(
      "[jobs] appointment_window column missing – migration 20260729000001_pr3a_job_appointment_window.sql not yet applied. Falling back to base select.",
    );
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_BASE)
      .eq("org_id", orgId)
      .eq("id", id)
      .maybeSingle();
    data = fallback.data as unknown as JobRow | null;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function createJob(
  jobNumber: string,
  input: JobWriteInput,
  contextInput?: SessionRepositoryContextInput,
): Promise<Job> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  const insertPayload: Record<string, unknown> = {
    org_id: orgId,
    job_number: jobNumber,
    estimate_id: input.estimateId ?? null,
    equipment_bundle_id: input.equipmentBundleId ?? null,
    title: input.title,
    type: input.type,
    status: input.status ?? "Scheduled",
    priority: input.priority,
    customer_id: input.customerId ?? null,
    customer_name: input.customerName,
    property_id: input.propertyId ?? null,
    property_name: input.propertyName,
    assigned_to: input.assignedTo,
    scheduled_for: input.scheduledFor,
    appointment_window: input.appointmentWindow ?? DEFAULT_JOB_APPOINTMENT_WINDOW,
    summary: input.summary,
    location: input.location,
    notes: input.notes,
  };

  const writeResult = await supabase
    .from("jobs")
    .insert(insertPayload)
    .select(JOB_SELECT)
    .single();

  let data = writeResult.data as unknown as JobRow | null;
  let error = writeResult.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(
      "[jobs] appointment_window column missing – migration 20260729000001_pr3a_job_appointment_window.sql not yet applied. Falling back to base insert.",
    );
    const fallbackPayload = { ...insertPayload };
    delete fallbackPayload.appointment_window;
    const fallback = await supabase
      .from("jobs")
      .insert(fallbackPayload)
      .select(JOB_SELECT_BASE)
      .single();
    data = fallback.data as unknown as JobRow | null;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return mapJob(data as JobRow);
}

export async function updateJob(
  id: string,
  input: Partial<JobWriteInput>,
): Promise<Job | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const updatePayload: Record<string, unknown> = {};

  if (input.estimateId !== undefined) updatePayload.estimate_id = input.estimateId || null;
  if (input.equipmentBundleId !== undefined) {
    updatePayload.equipment_bundle_id = input.equipmentBundleId || null;
  }
  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.type !== undefined) updatePayload.type = input.type;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.priority !== undefined) updatePayload.priority = input.priority;
  if (input.customerId !== undefined) updatePayload.customer_id = input.customerId;
  if (input.customerName !== undefined) updatePayload.customer_name = input.customerName;
  if (input.propertyId !== undefined) updatePayload.property_id = input.propertyId;
  if (input.propertyName !== undefined) updatePayload.property_name = input.propertyName;
  if (input.assignedTo !== undefined) updatePayload.assigned_to = input.assignedTo;
  if (input.scheduledFor !== undefined) updatePayload.scheduled_for = input.scheduledFor;
  if (input.appointmentWindow !== undefined) {
    updatePayload.appointment_window = input.appointmentWindow;
  }
  if (input.summary !== undefined) updatePayload.summary = input.summary;
  if (input.location !== undefined) updatePayload.location = input.location;
  if (input.notes !== undefined) updatePayload.notes = input.notes;

  const updateResult = await supabase
    .from("jobs")
    .update(updatePayload)
    .eq("org_id", orgId)
    .eq("id", id)
    .select(JOB_SELECT)
    .maybeSingle();

  let data = updateResult.data as unknown as JobRow | null;
  let error = updateResult.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(
      "[jobs] appointment_window column missing – migration 20260729000001_pr3a_job_appointment_window.sql not yet applied. Falling back to base update.",
    );
    delete updatePayload.appointment_window;
    const fallback = await supabase
      .from("jobs")
      .update(updatePayload)
      .eq("org_id", orgId)
      .eq("id", id)
      .select(JOB_SELECT_BASE)
      .maybeSingle();
    data = fallback.data as unknown as JobRow | null;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapJob(data) : null;
}

export async function deleteJob(id: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error, count } = await supabase
    .from("jobs")
    .delete({ count: "exact" })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(count);
}

export async function createJobActivity(
  input: JobActivityWriteInput,
  contextInput?: SessionRepositoryContextInput,
): Promise<JobActivity> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("job_activity")
    .insert({
      org_id: orgId,
      job_id: input.jobId,
      actor_id: input.actorId ?? null,
      type: input.type,
      title: input.title,
      description: input.description,
    })
    .select("id,job_id,actor_id,type,title,description,created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapActivity(data as JobActivityRow);
}

export async function listActivityByJobId(jobId: string): Promise<JobActivity[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_activity")
    .select("id,job_id,actor_id,type,title,description,created_at")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JobActivityRow[]).map(mapActivity);
}

export async function listActivityByJobIds(jobIds: string[]): Promise<JobActivity[]> {
  if (jobIds.length === 0) {
    return [];
  }

  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_activity")
    .select("id,job_id,actor_id,type,title,description,created_at")
    .eq("org_id", orgId)
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JobActivityRow[]).map(mapActivity);
}

export async function countJobs(
  contextInput?: SessionRepositoryContextInput,
): Promise<number> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export function toJob(row: JobRow): Job {
  return mapJob(row);
}


export async function listJobsByPropertyId(propertyId: string): Promise<Job[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const result = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("org_id", orgId)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  let data = result.data as unknown as JobRow[] | null;
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(
      "[jobs] appointment_window column missing – migration 20260729000001_pr3a_job_appointment_window.sql not yet applied. Falling back to base select.",
    );
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_BASE)
      .eq("org_id", orgId)
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });
    data = fallback.data as unknown as JobRow[] | null;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JobRow[]).map(mapJob);
}
