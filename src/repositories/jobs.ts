import "server-only";

import type {
  Job,
  JobAppointmentHour,
  JobPriority,
  JobStatus,
  JobType,
} from "@/features/jobs/types/job";
import { DEFAULT_JOB_APPOINTMENT_HOUR } from "@/features/jobs/utils/appointmentWindow";
import { deriveScheduledStartAt } from "@/features/jobs/utils/schedulingTime";
import type { JobActivity, JobActivityType } from "@/features/jobs/types/jobActivity";

import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

// ─── Scheduling column names ──────────────────────────────────────────────────
// Kept as constants to avoid typos in error-detection logic and select strings.
const COL_APPOINTMENT_WINDOW = "appointment_window";
const COL_SCHEDULED_START_AT = "scheduled_start_at";
const COL_SCHEDULED_END_AT = "scheduled_end_at";
const COL_ARRIVAL_WINDOW_START_AT = "arrival_window_start_at";
const COL_ARRIVAL_WINDOW_END_AT = "arrival_window_end_at";

// Warning messages — defined once to keep all fallback log lines consistent.
const WARN_PR3C_FALLBACK_LEGACY =
  "[jobs] scheduling column missing – PR3C migration not yet applied or schema cache not refreshed. Falling back to legacy select.";
const WARN_LEGACY_FALLBACK_BASE =
  "[jobs] Legacy appointment_window also missing. Falling back to base select.";
const WARN_PR3C_INSERT_FALLBACK =
  "[jobs] scheduling column missing – PR3C migration not yet applied or schema cache not refreshed. Falling back to legacy insert.";
const WARN_LEGACY_INSERT_FALLBACK =
  "[jobs] Legacy appointment_window also missing. Falling back to base insert.";
const WARN_PR3C_UPDATE_FALLBACK =
  "[jobs] scheduling column missing – PR3C migration not yet applied or schema cache not refreshed. Falling back to legacy update.";

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
  // Legacy scheduling column (PR3A/PR3B) — absent when migration not yet applied.
  // @deprecated Use scheduled_start_at instead.
  appointment_window?: number | null;
  // PR3C clock-time columns — absent when migration 20260729000003 not yet applied.
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  arrival_window_start_at?: string | null;
  arrival_window_end_at?: string | null;
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
  // PR3C fields (primary)
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  arrivalWindowStartAt?: string | null;
  arrivalWindowEndAt?: string | null;
  // Legacy fields (deprecated — kept for one release window)
  /** @deprecated Use scheduledStartAt */
  scheduledFor?: string;
  /** @deprecated Use scheduledStartAt */
  appointmentHour?: JobAppointmentHour;
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
  const rawHour = row.appointment_window;
  const appointmentHour: JobAppointmentHour =
    typeof rawHour === "number" && rawHour >= 1 && rawHour <= 12
      ? (rawHour as JobAppointmentHour)
      : DEFAULT_JOB_APPOINTMENT_HOUR;

  const scheduledFor = row.scheduled_for ?? row.created_at.slice(0, 10);

  // Use PR3C columns as primary truth; fall back to derived value from legacy fields.
  const scheduledStartAt =
    row.scheduled_start_at ?? deriveScheduledStartAt(scheduledFor, appointmentHour);

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
    // PR3C fields
    scheduledStartAt,
    scheduledEndAt: row.scheduled_end_at ?? null,
    arrivalWindowStartAt: row.arrival_window_start_at ?? null,
    arrivalWindowEndAt: row.arrival_window_end_at ?? null,
    // Legacy fields (deprecated but kept for backward compat)
    scheduledFor,
    appointmentHour,
    summary: row.summary,
    location: row.location,
    notes: row.notes,
  };
}

const JOB_SELECT_BASE =
  "id,job_number,estimate_id,equipment_bundle_id,title,type,status,priority,customer_id,customer_name,property_id,property_name,assigned_to,scheduled_for,summary,location,notes,created_at";

// PR3A/PR3B column (legacy, deprecated)
const JOB_SELECT_WITH_LEGACY = JOB_SELECT_BASE + ",appointment_window";

// PR3C adds real clock-time columns; also still selects the legacy hour column.
const JOB_SELECT =
  JOB_SELECT_WITH_LEGACY +
  ",scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at";

/**
 * Returns true when the Supabase/PostgREST error indicates that a scheduling
 * column does not exist yet (migration not applied, or schema cache not
 * refreshed).  Detects errors for any of the legacy or PR3C scheduling columns.
 *
 * Used to trigger safe read/write fallback so the app remains usable in
 * environments that are behind on migrations or pending a schema cache reload.
 */
function isSchedulingColumnMissingError(error: {
  message?: string;
  code?: string;
}): boolean {
  // PostgreSQL error code 42703 = undefined_column (most reliable signal)
  if (error.code === "42703") return true;
  const raw = error.message ?? "";
  // Only inspect the message when it actually mentions one of our columns
  const schedulingColumns = [
    COL_APPOINTMENT_WINDOW,
    COL_SCHEDULED_START_AT,
    COL_SCHEDULED_END_AT,
    COL_ARRIVAL_WINDOW_START_AT,
    COL_ARRIVAL_WINDOW_END_AT,
  ];
  const mentionsColumn = schedulingColumns.some((col) => raw.includes(col));
  if (!mentionsColumn) return false;
  const msg = raw.toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("undefined column") ||
    msg.includes("schema cache") ||
    msg.includes("could not find")
  );
}

/**
 * Type helper: cast Supabase response data to JobRow[].
 * Supabase infers a generic string error type when the select literal
 * contains columns not present in generated types; this helper centralises
 * the necessary cast rather than repeating `as unknown as` at every call site.
 */
function toJobRows(data: unknown): JobRow[] | null {
  return data as JobRow[] | null;
}

/** Single-row variant of {@link toJobRows}. */
function toJobRow(data: unknown): JobRow | null {
  return data as JobRow | null;
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

  let data = toJobRows(result.data);
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_WITH_LEGACY)
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    data = toJobRows(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const base = await supabase
        .from("jobs")
        .select(JOB_SELECT_BASE)
        .eq("org_id", orgId)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      data = toJobRows(base.data);
      error = base.error;
    }
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

  let data = toJobRows(result.data);
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_WITH_LEGACY)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    data = toJobRows(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const base = await supabase
        .from("jobs")
        .select(JOB_SELECT_BASE)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      data = toJobRows(base.data);
      error = base.error;
    }
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

  let data = toJobRow(result.data);
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_WITH_LEGACY)
      .eq("org_id", orgId)
      .eq("id", id)
      .maybeSingle();
    data = toJobRow(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const base = await supabase
        .from("jobs")
        .select(JOB_SELECT_BASE)
        .eq("org_id", orgId)
        .eq("id", id)
        .maybeSingle();
      data = toJobRow(base.data);
      error = base.error;
    }
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

  let data = toJobRow(result.data);
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_WITH_LEGACY)
      .eq("org_id", orgId)
      .eq("id", id)
      .maybeSingle();
    data = toJobRow(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const base = await supabase
        .from("jobs")
        .select(JOB_SELECT_BASE)
        .eq("org_id", orgId)
        .eq("id", id)
        .maybeSingle();
      data = toJobRow(base.data);
      error = base.error;
    }
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
    // Legacy fields (may be absent when caller uses PR3C fields only)
    scheduled_for: input.scheduledFor ?? null,
    appointment_window: input.appointmentHour ?? DEFAULT_JOB_APPOINTMENT_HOUR,
    // PR3C clock-time fields
    scheduled_start_at: input.scheduledStartAt ?? null,
    scheduled_end_at: input.scheduledEndAt ?? null,
    arrival_window_start_at: input.arrivalWindowStartAt ?? null,
    arrival_window_end_at: input.arrivalWindowEndAt ?? null,
    summary: input.summary,
    location: input.location,
    notes: input.notes,
  };

  const writeResult = await supabase
    .from("jobs")
    .insert(insertPayload)
    .select(JOB_SELECT)
    .single();

  let data = toJobRow(writeResult.data);
  let error = writeResult.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_INSERT_FALLBACK);
    const legacyPayload = { ...insertPayload };
    delete legacyPayload.scheduled_start_at;
    delete legacyPayload.scheduled_end_at;
    delete legacyPayload.arrival_window_start_at;
    delete legacyPayload.arrival_window_end_at;
    const fallback = await supabase
      .from("jobs")
      .insert(legacyPayload)
      .select(JOB_SELECT_WITH_LEGACY)
      .single();
    data = toJobRow(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_INSERT_FALLBACK);
      const basePayload = { ...legacyPayload };
      delete basePayload.appointment_window;
      const base = await supabase
        .from("jobs")
        .insert(basePayload)
        .select(JOB_SELECT_BASE)
        .single();
      data = toJobRow(base.data);
      error = base.error;
    }
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
  if (input.appointmentHour !== undefined) {
    updatePayload.appointment_window = input.appointmentHour;
  }
  // PR3C clock-time fields
  if ("scheduledStartAt" in input) updatePayload.scheduled_start_at = input.scheduledStartAt ?? null;
  if ("scheduledEndAt" in input) updatePayload.scheduled_end_at = input.scheduledEndAt ?? null;
  if ("arrivalWindowStartAt" in input) {
    updatePayload.arrival_window_start_at = input.arrivalWindowStartAt ?? null;
  }
  if ("arrivalWindowEndAt" in input) {
    updatePayload.arrival_window_end_at = input.arrivalWindowEndAt ?? null;
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

  let data = toJobRow(updateResult.data);
  let error = updateResult.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_UPDATE_FALLBACK);
    // Remove PR3C columns and retry with legacy select
    const legacyPayload = { ...updatePayload };
    delete legacyPayload.scheduled_start_at;
    delete legacyPayload.scheduled_end_at;
    delete legacyPayload.arrival_window_start_at;
    delete legacyPayload.arrival_window_end_at;
    const fallback = await supabase
      .from("jobs")
      .update(legacyPayload)
      .eq("org_id", orgId)
      .eq("id", id)
      .select(JOB_SELECT_WITH_LEGACY)
      .maybeSingle();
    data = toJobRow(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const basePayload = { ...legacyPayload };
      delete basePayload.appointment_window;
      const base = await supabase
        .from("jobs")
        .update(basePayload)
        .eq("org_id", orgId)
        .eq("id", id)
        .select(JOB_SELECT_BASE)
        .maybeSingle();
      data = toJobRow(base.data);
      error = base.error;
    }
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

  let data = toJobRows(result.data);
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_WITH_LEGACY)
      .eq("org_id", orgId)
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });
    data = toJobRows(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const base = await supabase
        .from("jobs")
        .select(JOB_SELECT_BASE)
        .eq("org_id", orgId)
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      data = toJobRows(base.data);
      error = base.error;
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JobRow[]).map(mapJob);
}
