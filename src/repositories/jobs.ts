import "server-only";

import type {
  Job,
  JobAppointmentHour,
  JobCloseoutMode,
  JobPriority,
  JobStatus,
  JobType,
} from "@/features/jobs/types/job";
import { DEFAULT_JOB_APPOINTMENT_HOUR } from "@/features/jobs/utils/appointmentWindow";
import { deriveScheduledStartAt } from "@/features/jobs/utils/schedulingTime";
import type { JobActivity, JobActivityType } from "@/features/jobs/types/jobActivity";

import { jobOverlapsDateRange } from "@/features/calendar/utils/calendarSchedule";
import { getStatusVariants } from "@/lib/jobs/status";
import { formatTeamLabel } from "@/lib/teamLabel";
import { addCalendarDays } from "@/lib/timezone";

import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

// ─── Scheduling column names ──────────────────────────────────────────────────
// Kept as constants to avoid typos in error-detection logic and select strings.
const COL_APPOINTMENT_WINDOW = "appointment_window";
const COL_SCHEDULED_START_AT = "scheduled_start_at";
const COL_SCHEDULED_END_AT = "scheduled_end_at";
const COL_ARRIVAL_WINDOW_START_AT = "arrival_window_start_at";
const COL_ARRIVAL_WINDOW_END_AT = "arrival_window_end_at";
const COL_CLOSEOUT_MODE = "closeout_mode";

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

function normalizeAssigneeValue(value: string | null | undefined): string { return (value ?? "").trim().toLowerCase(); } async function resolveAssignedUserId(supabase: Awaited<ReturnType<typeof getRepositoryContext>>["supabase"], orgId: string, assignedTo: string | null | undefined): Promise<string | null> { const normalized = normalizeAssigneeValue(assignedTo); if (!normalized) { return null; } const { data, error } = await supabase.from("user_profiles").select("id,full_name,email").eq("org_id", orgId); if (error) { return null; } const matches = ((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).filter((profile) => normalizeAssigneeValue(profile.full_name) === normalized || normalizeAssigneeValue(profile.email) === normalized); return matches.length === 1 ? matches[0].id : null; } async function writeJobAssignees(supabase: Awaited<ReturnType<typeof getRepositoryContext>>["supabase"], orgId: string, jobId: string, assigneeIds: string[] | undefined): Promise<void> { if (assigneeIds === undefined) { return; } const ids = Array.from(new Set(assigneeIds)); const { error: deleteError } = await supabase.from("job_assignees").delete().eq("org_id", orgId).eq("job_id", jobId); if (deleteError) { throw new Error(deleteError.message); } if (ids.length > 0) { const { error: insertError } = await supabase.from("job_assignees").insert(ids.map((userId) => ({ org_id: orgId, job_id: jobId, user_id: userId }))); if (insertError) { throw new Error(insertError.message); } } }

/** Upper bound for one .in(...) id list; keeps request URLs bounded. */
export const JOB_ID_QUERY_CHUNK_SIZE = 80;

async function readJobAssignees(supabase: Awaited<ReturnType<typeof getRepositoryContext>>["supabase"], orgId: string, jobIds: string[]): Promise<Map<string, { id: string; name: string }[]>> { const byJob = new Map<string, { id: string; name: string }[]>(); if (jobIds.length === 0) { return byJob; } const rows: Array<{ job_id: string; user_id: string }> = []; for (let index = 0; index < jobIds.length; index += JOB_ID_QUERY_CHUNK_SIZE) { const chunk = jobIds.slice(index, index + JOB_ID_QUERY_CHUNK_SIZE); const { data, error } = await supabase.from("job_assignees").select("job_id,user_id").eq("org_id", orgId).in("job_id", chunk).order("created_at", { ascending: true }); if (error) { throw new Error(error.message); } rows.push(...((data ?? []) as Array<{ job_id: string; user_id: string }>)); } if (rows.length === 0) { return byJob; } const userIds = Array.from(new Set(rows.map((row) => row.user_id))); const profiles: Array<{ id: string; full_name: string | null; email: string | null }> = []; for (let index = 0; index < userIds.length; index += JOB_ID_QUERY_CHUNK_SIZE) { const chunk = userIds.slice(index, index + JOB_ID_QUERY_CHUNK_SIZE); const { data, error: profileError } = await supabase.from("user_profiles").select("id,full_name,email").in("id", chunk); if (profileError) { throw new Error(profileError.message); } profiles.push(...((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>)); } const nameById = new Map<string, string>(); for (const profile of profiles) { nameById.set(profile.id, (profile.full_name ?? "").trim() || (profile.email ?? "").trim() || "Team member"); } for (const row of rows) { const list = byJob.get(row.job_id) ?? []; list.push({ id: row.user_id, name: nameById.get(row.user_id) ?? "Team member" }); byJob.set(row.job_id, list); } return byJob; } async function attachAssignees(supabase: Awaited<ReturnType<typeof getRepositoryContext>>["supabase"], orgId: string, jobsList: Job[]): Promise<void> { if (jobsList.length === 0) { return; } const byJob = await readJobAssignees(supabase, orgId, jobsList.map((job) => job.id)); for (const job of jobsList) { job.assignees = byJob.get(job.id) ?? []; } } interface JobRow {
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
  // F19: present once migration 20260929000003 is applied.
  contractor_ids?: string[] | null;
  // Legacy scheduling column (PR3A/PR3B) — absent when migration not yet applied.
  // @deprecated Use scheduled_start_at instead.
  appointment_window?: number | null;
  // PR3C clock-time columns — absent when migration 20260729000003 not yet applied.
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  arrival_window_start_at?: string | null;
  arrival_window_end_at?: string | null;
  // Closeout mode — absent when migration 20261102000000 not yet applied.
  closeout_mode?: string | null;
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
  closeoutMode?: JobCloseoutMode;
  customerId?: string | null;
  customerName: string;
  propertyId?: string | null;
  propertyName: string;
  assignedTo: string;
  assigneeIds?: string[];   // F19: contractor assignments, persisted to jobs.contractor_ids.
  contractorIds?: string[];
  // PR3C fields (primary)
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  arrivalWindowStartAt?: string | null;
  arrivalWindowEndAt?: string | null;
  // Legacy fields (deprecated — kept for one release window)
  /** @deprecated Use scheduledStartAt */
  scheduledFor?: string | null;
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

  // Fallback: when scheduled_for is NULL the job is unscheduled.
  const scheduledFor = row.scheduled_for ?? null;

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
    contractorIds: row.contractor_ids ?? [],
    // PR3C fields
    scheduledStartAt,
    scheduledEndAt: row.scheduled_end_at ?? null,
    arrivalWindowStartAt: row.arrival_window_start_at ?? null,
    arrivalWindowEndAt: row.arrival_window_end_at ?? null,
    // Legacy fields (deprecated but kept for backward compat)
    scheduledFor,
    appointmentHour,
    // Anything but an explicit "visit" reads as the default "full".
    closeoutMode: row.closeout_mode === "visit" ? "visit" : "full",
    summary: row.summary,
    location: row.location,
    notes: row.notes,
  };
}

const JOB_SELECT_BASE =
  "id,job_number,estimate_id,equipment_bundle_id,title,type,status,priority,customer_id,customer_name,property_id,property_name,assigned_to,contractor_ids,scheduled_for,summary,location,notes,created_at";

// PR3A/PR3B column (legacy, deprecated)
const JOB_SELECT_WITH_LEGACY = JOB_SELECT_BASE + ",appointment_window";

// PR3C adds real clock-time columns; also still selects the legacy hour column.
// closeout_mode (migration 20261102000000) rides the same top tier so the
// fallback chain drops it together with the PR3C columns pre-migration.
const JOB_SELECT =
  JOB_SELECT_WITH_LEGACY +
  ",scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,closeout_mode";

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
    COL_CLOSEOUT_MODE,
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
 * True when `error` is a unique-constraint violation on the job_number index
 * (Postgres 23505 / jobs_job_number_unique). The job-number allocator uses this
 * to detect the concurrent-create race — two creates reading the same MAX and
 * racing to insert the same JOB-<n> — and retry with the next number instead of
 * surfacing the error. Deliberately narrow: a 23505 on any OTHER unique index
 * (so not job_number) is not a number collision and must not trigger a retry.
 */
export function isJobNumberUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  const mentionsJobNumber =
    message.includes("job_number") || message.includes("jobs_job_number_unique");
  if (!mentionsJobNumber) return false;
  // 23505 = unique_violation. PostgREST surfaces the pg code; a raw Error
  // thrown from the repo re-exposes it via the attached `code` property.
  return code === "23505" || message.includes("duplicate key");
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

export async function listJobsByCustomerId(
  customerId: string,
  options?: { page?: number; pageSize?: number },
): Promise<Job[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();

  const result = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  let data = toJobRows(result.data);
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_WITH_LEGACY)
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    data = toJobRows(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const base = await supabase
        .from("jobs")
        .select(JOB_SELECT_BASE)
        .eq("org_id", orgId)
        .eq("customer_id", customerId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);
      data = toJobRows(base.data);
      error = base.error;
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  const jobsList = ((data ?? []) as JobRow[]).map(mapJob); await attachAssignees(supabase, orgId, jobsList); return jobsList;
}

export async function listJobs(
  options?: { page?: number; pageSize?: number },
): Promise<Job[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();

  const result = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  let data = toJobRows(result.data);
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_WITH_LEGACY)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    data = toJobRows(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const base = await supabase
        .from("jobs")
        .select(JOB_SELECT_BASE)
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);
      data = toJobRows(base.data);
      error = base.error;
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  const jobsList = ((data ?? []) as JobRow[]).map(mapJob); await attachAssignees(supabase, orgId, jobsList); return jobsList;
}

// ─── Server-side filtered + paginated listing ─────────────────────────────────

export interface JobListFilter {
  status?: JobStatus | JobStatus[];
  type?: JobType | JobType[];
  priority?: JobPriority | JobPriority[];
  search?: string;
  assignee?: string;
  /** Filter to jobs completed on or after this date (YYYY-MM-DD). */
  completedDate?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface PaginatedJobsResult {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  created_at: "created_at",
  scheduled_for: "scheduled_for",
  customer_name: "customer_name",
  job_number: "job_number",
  status: "status",
  type: "type",
  priority: "priority",
};

/**
 * Server-side filtered and paginated job listing. Pushes filtering, search,
 * and pagination to the database so the client receives only the rows it
 * renders. The scheduling-column fallback chain mirrors listJobs.
 */
export async function listJobsPaginated(
  filter: JobListFilter = {},
): Promise<PaginatedJobsResult> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.max(1, Math.min(filter.pageSize ?? 50, 200));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  // Default board order is scheduled date (Option C removed priority as a
  // sort key). Explicit ?sort= still wins via the whitelist.
  const sortCol = ALLOWED_SORT_COLUMNS[filter.sort ?? ""] ?? "scheduled_for";
  const ascending = (filter.order ?? "asc") === "asc";

  const { supabase, orgId } = await getRepositoryContext();

  // When a completed-date filter is requested, resolve today's completion
  // activity ids first (the Command Center count's preferred signal), so
  // applyFilters can OR them into the jobs query.
  let completedActivityJobIds: string[] = [];
  if (filter.completedDate) {
    const activityRes = await supabase
      .from("job_activity")
      .select("job_id")
      .eq("org_id", orgId)
      .eq("type", "status")
      .ilike("title", "Job completed%")
      .gte("created_at", filter.completedDate);
    if (!activityRes.error) {
      completedActivityJobIds = Array.from(
        new Set(
          ((activityRes.data ?? []) as { job_id: string }[])
            .map((row) => row.job_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      );
    }
  }

  // Helper: apply shared filters to a query builder (works for both data
  // and count queries). The builder type is generic enough for both select
  // overloads Supabase provides.
  function applyFilters<Q extends { eq: Function; in: Function; ilike: Function; or: Function; is: Function; gte: Function }>(
    query: Q,
  ): Q {
    let q = (query.eq("org_id", orgId) as Q);
    q = q.is("deleted_at", null) as Q;

    // Status filter
    const statuses = Array.isArray(filter.status) ? filter.status : filter.status ? [filter.status] : [];
    if (statuses.length === 1) {
      q = q.eq("status", statuses[0]) as Q;
    } else if (statuses.length > 1) {
      q = q.in("status", statuses) as Q;
    }

    // Type filter
    const types = Array.isArray(filter.type) ? filter.type : filter.type ? [filter.type] : [];
    if (types.length === 1) {
      q = q.eq("type", types[0]) as Q;
    } else if (types.length > 1) {
      q = q.in("type", types) as Q;
    }

    // Priority filter
    const priorities = Array.isArray(filter.priority) ? filter.priority : filter.priority ? [filter.priority] : [];
    if (priorities.length === 1) {
      q = q.eq("priority", priorities[0]) as Q;
    } else if (priorities.length > 1) {
      q = q.in("priority", priorities) as Q;
    }

    // Text search — ilike across multiple columns
    const search = (filter.search ?? "").trim();
    if (search) {
      const pattern = `%${search}%`;
      q = q.or(
        `job_number.ilike.${pattern},customer_name.ilike.${pattern},property_name.ilike.${pattern},assigned_to.ilike.${pattern},title.ilike.${pattern}`,
      ) as Q;
    }

    // Assignee filter (exact match on the assigned_to column)
    if (filter.assignee) {
      q = q.ilike("assigned_to", `%${filter.assignee}%`) as Q;
    }

    // Completed-date filter: the "Completed today" rule, matching the
    // Command Center count — a job counts when its completion signal was
    // recorded today: either a "Job completed" status activity today
    // (preferred signal) or, as a fallback for legacy rows, an updated_at
    // on/after today. The two halves are ORed, exactly as commandCenter
    // merges them.
    if (filter.completedDate) {
      if (completedActivityJobIds.length > 0) {
        q = q.or(
          `updated_at.gte.${filter.completedDate},id.in.(${completedActivityJobIds.join(",")})`,
        ) as Q;
      } else {
        q = q.gte("updated_at", filter.completedDate) as Q;
      }
    }

    return q;
  }

  // Count query (head-only, no data returned)
  const countResponse = await applyFilters(
    supabase.from("jobs").select("id", { count: "exact", head: true }),
  );
  const total = countResponse.error ? 0 : (countResponse.count ?? 0);

  // Data query with the full select, ordering, and range
  const dataQuery = applyFilters(
    supabase.from("jobs").select(JOB_SELECT),
  )
    .order(sortCol, { ascending })
    .range(from, to);

  const result = await dataQuery;
  let data = toJobRows(result.data);
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    const fallbackQuery = applyFilters(
      supabase.from("jobs").select(JOB_SELECT_WITH_LEGACY),
    )
      .order(sortCol, { ascending })
      .range(from, to);
    const fallback = await fallbackQuery;
    data = toJobRows(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const baseQuery = applyFilters(
        supabase.from("jobs").select(JOB_SELECT_BASE),
      )
        .order(sortCol, { ascending })
        .range(from, to);
      const base = await baseQuery;
      data = toJobRows(base.data);
      error = base.error;
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  const jobsList = ((data ?? []) as JobRow[]).map(mapJob);
  await attachAssignees(supabase, orgId, jobsList);
  return { jobs: jobsList, total, page, pageSize };
}

/**
 * The most recently touched jobs, newest first, capped SERVER-SIDE with
 * `.limit`. Purpose-built for the dashboard "Recent Jobs" widget: unlike
 * listJobs/listWorkspaceJobs it never pages the whole workspace, so it cannot
 * time out on a large org. Assignees are intentionally not attached — the
 * widget does not render them, and skipping that keeps the read to a single
 * query. The scheduling-column fallback chain matches listJobs so the read
 * stays usable on schemas behind on migrations.
 */
export async function listRecentJobs(limit = 5): Promise<Job[]> {
  const take = Math.max(1, Math.min(limit, 50));
  const { supabase, orgId } = await getRepositoryContext();

  const result = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(take);

  let data = toJobRows(result.data);
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_WITH_LEGACY)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(take);
    data = toJobRows(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const base = await supabase
        .from("jobs")
        .select(JOB_SELECT_BASE)
        .eq("org_id", orgId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(take);
      data = toJobRows(base.data);
      error = base.error;
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JobRow[]).map(mapJob);
}

/**
 * Fetches the jobs for an explicit id list, in JOB_ID_QUERY_CHUNK_SIZE
 * chunks, newest first. Unlike listJobs this is not page-capped: every id
 * the caller names is looked up, so callers that already hold the ids they
 * need (the dispatch board holding plan job ids) never lose rows to the
 * 50-row default page. Missing ids are skipped. Runs through the session
 * client, so row security scopes technicians exactly as listJobs does, and
 * the scheduling-column fallback chain applies per chunk.
 */
export async function listJobsByIds(ids: string[]): Promise<Job[]> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const { supabase, orgId } = await getRepositoryContext();
  const rows: JobRow[] = [];

  for (let index = 0; index < uniqueIds.length; index += JOB_ID_QUERY_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(index, index + JOB_ID_QUERY_CHUNK_SIZE);
    const runChunk = (select: string) =>
      supabase
        .from("jobs")
        .select(select)
        .eq("org_id", orgId)
        .in("id", chunk)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

    const result = await runChunk(JOB_SELECT);
    let data = toJobRows(result.data);
    let error = result.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_PR3C_FALLBACK_LEGACY);
      const fallback = await runChunk(JOB_SELECT_WITH_LEGACY);
      data = toJobRows(fallback.data);
      error = fallback.error;

      if (error && isSchedulingColumnMissingError(error)) {
        console.warn(WARN_LEGACY_FALLBACK_BASE);
        const base = await runChunk(JOB_SELECT_BASE);
        data = toJobRows(base.data);
        error = base.error;
      }
    }

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as JobRow[]));
  }

  rows.sort((left, right) => right.created_at.localeCompare(left.created_at));
  const jobsList = rows.map(mapJob);
  await attachAssignees(supabase, orgId, jobsList);
  return jobsList;
}

/**
 * Jobs whose scheduled span overlaps the inclusive company-date range
 * [from, to] (YYYY-MM-DD), for the calendar's range endpoint.
 *
 * The SQL filter is deliberately a superset: company-timezone day boundaries
 * can shift an instant across a UTC day, so the window is padded by two days
 * and the precise overlap check runs on the mapped jobs with
 * jobOverlapsDateRange — the same placement rules the calendar renders with
 * (clock-time start wins, legacy date fallback, multi-day spans included).
 * Runs through the session client, so row security scopes technicians to
 * their assigned jobs exactly as listJobs does.
 */
export async function listJobsInRange(from: string, to: string): Promise<Job[]> {
  const { supabase, orgId } = await getRepositoryContext();

  const windowStart = `${addCalendarDays(from, -2)}T00:00:00.000Z`;
  const windowEnd = `${addCalendarDays(to, 2)}T23:59:59.999Z`;
  const legacyFrom = addCalendarDays(from, -2);
  const legacyToExclusive = addCalendarDays(to, 3);

  // Timestamp jobs: the span (start through end, or the start alone when no
  // end is stored) reaches into the padded window. Legacy jobs carry only a
  // scheduled_for date.
  const rangeFilter = [
    `and(scheduled_start_at.lte.${windowEnd},scheduled_end_at.gte.${windowStart})`,
    `and(scheduled_start_at.lte.${windowEnd},scheduled_start_at.gte.${windowStart},scheduled_end_at.is.null)`,
    `and(scheduled_start_at.is.null,scheduled_for.gte.${legacyFrom},scheduled_for.lt.${legacyToExclusive})`,
  ].join(",");

  // Supabase (PostgREST) returns at most 1 000 rows by default. Page with
  // `.range()` so a year view with >1 000 jobs in the window gets them all.
  const RANGE_PAGE = 1000;

  const runQuery = (select: string, withTimestamps: boolean) => {
    const query = supabase.from("jobs").select(select).eq("org_id", orgId).is("deleted_at", null);
    const filtered = withTimestamps
      ? query.or(rangeFilter)
      : query.gte("scheduled_for", legacyFrom).lt("scheduled_for", legacyToExclusive);
    return filtered.order("created_at", { ascending: false });
  };

  const runPaginatedQuery = async (
    select: string,
    withTimestamps: boolean,
  ): Promise<{ data: JobRow[]; error: { message: string; code?: string } | null }> => {
    const allRows: JobRow[] = [];
    let offset = 0;
    for (;;) {
      const result = await runQuery(select, withTimestamps).range(offset, offset + RANGE_PAGE - 1);
      if (result.error) return { data: allRows, error: result.error };
      const page = toJobRows(result.data) as JobRow[];
      allRows.push(...page);
      if (page.length < RANGE_PAGE) break;
      offset += RANGE_PAGE;
    }
    return { data: allRows, error: null };
  };

  let { data, error } = await runPaginatedQuery(JOB_SELECT, true);

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    // The PR3C columns do not exist in this environment, so timestamps
    // cannot be filtered on — legacy jobs are the only scheduled kind.
    ({ data, error } = await runPaginatedQuery(JOB_SELECT_WITH_LEGACY, false));

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      ({ data, error } = await runPaginatedQuery(JOB_SELECT_BASE, false));
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  const jobsList = (data as JobRow[])
    .map(mapJob)
    .filter((job) => jobOverlapsDateRange(job, from, to));
  await attachAssignees(supabase, orgId, jobsList);
  return jobsList;
}

/**
 * Count of jobs with no scheduled date — neither a clock-time start nor a
 * legacy scheduled_for date — matching isJobScheduled's definition. Backs
 * the calendar's "jobs without a scheduled date" note now that the calendar
 * only loads one range at a time. Session-scoped like every job read.
 */
export async function countUnscheduledJobs(): Promise<number> {
  const { supabase, orgId } = await getRepositoryContext();

  const full = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .is("scheduled_start_at", null)
    .is("scheduled_for", null);

  if (!full.error) {
    return full.count ?? 0;
  }

  if (!isSchedulingColumnMissingError(full.error)) {
    throw new Error(full.error.message);
  }

  const legacy = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .is("scheduled_for", null);

  if (legacy.error) {
    throw new Error(legacy.error.message);
  }

  return legacy.count ?? 0;
}

export async function listJobActivity(
  options?: { page?: number; pageSize?: number },
): Promise<JobActivity[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_activity")
    .select("id,job_id,actor_id,type,title,description,created_at")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JobActivityRow[]).map(mapActivity);
}

export async function getJobById(
  id: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<Job | null> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

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

  if (!data) { return null; }
  const fetchedJob = mapJob(data);
  await Promise.all([
    attachAssignees(supabase, orgId, [fetchedJob]),
    attachCompletionTeam(supabase, orgId, fetchedJob),
  ]);
  return fetchedJob;
}

/** True when this org can see the job. Does not load assignees or history. */
export async function jobExists(
  id: string,
  contextInput?: SessionRepositoryContextInput,
): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("jobs")
    .select("id")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
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

  const assigneeIds = input.assigneeIds?.filter((id) => id.trim().length > 0);
  const assignedUserId = assigneeIds && assigneeIds.length > 0
    ? assigneeIds[0]
    : input.assignedTo.trim()
      ? await resolveAssignedUserId(supabase, orgId, input.assignedTo)
      : null;
  const insertPayload: Record<string, unknown> = { assigned_user_id: assignedUserId,
    org_id: orgId,
    job_number: jobNumber,
    estimate_id: input.estimateId ?? null,
    equipment_bundle_id: input.equipmentBundleId ?? null,
    title: input.title,
    type: input.type,
    status: input.status ?? "Scheduled",
    priority: input.priority,
    closeout_mode: input.closeoutMode ?? "full",
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
    contractor_ids: input.contractorIds ?? [],
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
    delete legacyPayload.closeout_mode;
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
    // Preserve the Postgres error code so callers (the job-number allocator)
    // can detect a unique-violation on job_number and retry with the next
    // number. A bare `new Error(message)` would drop `error.code`.
    const thrown = new Error(error.message) as Error & { code?: string };
    if (error.code) thrown.code = error.code;
    throw thrown;
  }

  const createdJob = mapJob(data as JobRow);
  const ids = assigneeIds && assigneeIds.length > 0 ? assigneeIds : assignedUserId ? [assignedUserId] : [];
  await writeJobAssignees(supabase, orgId, createdJob.id, ids);
  if (ids.length > 0) {
    const names = createdJob.assignedTo.split(/\s*(?:\+|,)\s*/).map((name) => name.trim()).filter(Boolean);
    createdJob.assignees = ids.map((id, index) => ({
      id,
      name: names[index] ?? "Team member",
    }));
  } else {
    createdJob.assignees = [];
  }
  return createdJob;
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
  if (input.closeoutMode !== undefined) updatePayload.closeout_mode = input.closeoutMode;
  if (input.customerId !== undefined) updatePayload.customer_id = input.customerId;
  if (input.customerName !== undefined) updatePayload.customer_name = input.customerName;
  if (input.propertyId !== undefined) updatePayload.property_id = input.propertyId;
  if (input.propertyName !== undefined) updatePayload.property_name = input.propertyName;
  if (input.assignedTo !== undefined) updatePayload.assigned_to = input.assignedTo;
  // A known user id list is the source of truth. Looking up every profile
  // by the joined display name delays the write and rarely matches.
  if (input.assigneeIds !== undefined) {
    updatePayload.assigned_user_id = input.assigneeIds[0] ?? null;
  } else if (input.assignedTo !== undefined) {
    updatePayload.assigned_user_id = await resolveAssignedUserId(supabase, orgId, input.assignedTo);
  }
  if (input.contractorIds !== undefined) updatePayload.contractor_ids = input.contractorIds;
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
    delete legacyPayload.closeout_mode;
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

  if (!data) { return null; } const updatedJob = mapJob(data); await writeJobAssignees(supabase, orgId, updatedJob.id, input.assigneeIds); await attachAssignees(supabase, orgId, [updatedJob]); return updatedJob;
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


/**
 * Soft-delete a job by setting its deleted_at timestamp.
 * Returns true when exactly one row was updated.
 */
export async function softDeleteJob(id: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).length > 0;
}

/**
 * Restore a soft-deleted job by clearing its deleted_at timestamp.
 * Returns true when exactly one row was updated.
 */
export async function restoreJob(id: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .update({ deleted_at: null })
    .eq("org_id", orgId)
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).length > 0;
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

export async function listActivityByJobId(
  jobId: string,
  options?: { page?: number; pageSize?: number },
): Promise<JobActivity[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_activity")
    .select("id,job_id,actor_id,type,title,description,created_at")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as JobActivityRow[]).map(mapActivity);
}

export async function listActivityByJobIds(
  jobIds: string[],
  options?: { page?: number; pageSize?: number },
): Promise<JobActivity[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (jobIds.length === 0) {
    return [];
  }

  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_activity")
    .select("id,job_id,actor_id,type,title,description,created_at")
    .eq("org_id", orgId)
    .in("job_id", jobIds)
    .order("created_at", { ascending: false })
    .range(from, to);

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
    .eq("org_id", orgId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export interface JobBoardCounts {
  total: number;
  inProgress: number;
  scheduled: number;
}

/**
 * Exact counts for the Jobs page stat cards, computed in the database with
 * three parallel head-only count queries. Replaces the old approach of paging
 * the ENTIRE job table into the browser (15 sequential pages of 200 + their
 * assignee lookups, capped at 3,000 rows) just to count it.
 *
 * Matches summarizeJobBoard(): soft-deleted jobs are excluded, statuses match
 * every stored casing (STATUS_QUERY_VARIANTS — production stores Title Case).
 * Priority is no longer shown on the board (Option C); the column stays in
 * the database for imports/callbacks. RLS still applies, so a tech sees
 * counts for only the jobs they can read — same as before.
 */
export async function countJobBoardStats(
  contextInput?: SessionRepositoryContextInput,
): Promise<JobBoardCounts> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const base = () =>
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("deleted_at", null);

  const [totalRes, inProgressRes, scheduledRes] = await Promise.all([
    base(),
    base().in("status", getStatusVariants(["In Progress"])),
    base().in("status", getStatusVariants(["Scheduled"])),
  ]);

  for (const res of [totalRes, inProgressRes, scheduledRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  return {
    total: totalRes.count ?? 0,
    inProgress: inProgressRes.count ?? 0,
    scheduled: scheduledRes.count ?? 0,
  };
}

const JOB_NUMBER_PATTERN = /^JOB-(\d+)$/;

/**
 * Highest numeric suffix among existing JOB-<n> numbers in the org.
 * Job numbers must be derived from this — never from the row count and
 * never from the newest row by created_at:
 *   - row count: a deleted job drops the count and the next create would
 *     reuse a number still in use (duplicate JOB-1006 incident, 2026-09-30).
 *   - newest by created_at: deleting the highest-numbered job(s) leaves the
 *     newest *remaining* row with a LOWER number, so the next create reuses a
 *     number that has already existed (JOB-1018/JOB-1019 reuse, 2026-11-02).
 *
 * MONOTONIC guarantee: we scan every JOB-<n> row and take the true MAX suffix,
 * so the next number is always max+1. This query deliberately does NOT filter
 * by status or deleted_at — cancelled and (once soft-delete lands) soft-deleted
 * rows keep their job_number visible here, so a number that has ever existed is
 * never reissued. SF-<n> import numbers are excluded (JOB-% only) and so cannot
 * disturb the JOB- sequence.
 *
 * Note: the max is computed in JS by parsing the numeric suffix rather than by
 * a lexical `order(job_number desc)` — lexical ordering would rank JOB-9999
 * above JOB-10000 once the sequence crosses into five digits.
 */
export async function getMaxJobNumberSuffix(
  contextInput?: SessionRepositoryContextInput,
): Promise<number> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const { data, error } = await supabase
    .from("jobs")
    .select("job_number")
    .eq("org_id", orgId)
    .like("job_number", "JOB-%");

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ job_number: string | null }>;
  let max = 0;
  for (const row of rows) {
    const match = JOB_NUMBER_PATTERN.exec(row.job_number ?? "");
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max;
}

export function toJob(row: JobRow): Job {
  return mapJob(row);
}


export async function listJobsByPropertyId(
  propertyId: string,
  options?: { page?: number; pageSize?: number },
): Promise<Job[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase, orgId } = await getRepositoryContext();

  const result = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("org_id", orgId)
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  let data = toJobRows(result.data);
  let error = result.error;

  if (error && isSchedulingColumnMissingError(error)) {
    console.warn(WARN_PR3C_FALLBACK_LEGACY);
    const fallback = await supabase
      .from("jobs")
      .select(JOB_SELECT_WITH_LEGACY)
      .eq("org_id", orgId)
      .eq("property_id", propertyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    data = toJobRows(fallback.data);
    error = fallback.error;

    if (error && isSchedulingColumnMissingError(error)) {
      console.warn(WARN_LEGACY_FALLBACK_BASE);
      const base = await supabase
        .from("jobs")
        .select(JOB_SELECT_BASE)
        .eq("org_id", orgId)
        .eq("property_id", propertyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);
      data = toJobRows(base.data);
      error = base.error;
    }
  }

  if (error) {
    throw new Error(error.message);
  }

  const jobsList = ((data ?? []) as JobRow[]).map(mapJob); await attachAssignees(supabase, orgId, jobsList); return jobsList;
}

// ─── Operational reporting (P3) ──────────────────────────────────────────────
// Lean row shapes for the reports API — includes the raw timestamps the
// mapped Job type omits (created_at / updated_at) for month bucketing and
// terminal-status dating.

export interface JobReportRow {
  id: string;
  jobNumber: string;
  type: string;
  status: string;
  title: string;
  customerName: string;
  propertyName: string;
  assignedTo: string;
  assignees?: { id: string | null; name: string }[];
  completionTeam?: { id: string | null; name: string }[];
  scheduledStartAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
}

function isMissingCompletionTeam(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("job_completion_team")
  );
}

async function readCompletionTeams(
  supabase: Awaited<ReturnType<typeof getRepositoryContext>>["supabase"],
  orgId: string,
  jobIds: string[],
): Promise<Map<string, { id: string | null; name: string }[]>> {
  const byJob = new Map<string, { id: string | null; name: string }[]>();
  if (jobIds.length === 0) return byJob;
  const { data, error } = await supabase
    .from("job_completion_team")
    .select("job_id,user_id,person_name")
    .eq("org_id", orgId)
    .in("job_id", jobIds);
  if (error) {
    if (isMissingCompletionTeam(error)) return byJob;
    throw new Error(error.message);
  }
  for (const row of (data ?? []) as Array<{ job_id: string; user_id: string | null; person_name: string }>) {
    const list = byJob.get(row.job_id) ?? [];
    list.push({ id: row.user_id, name: row.person_name });
    byJob.set(row.job_id, list);
  }
  return byJob;
}

async function attachCompletionTeam(
  supabase: Awaited<ReturnType<typeof getRepositoryContext>>["supabase"],
  orgId: string,
  job: Job,
): Promise<void> {
  const teams = await readCompletionTeams(supabase, orgId, [job.id]);
  const team = teams.get(job.id);
  if (team && team.length > 0) job.completionTeam = team;
}

export async function setJobPeople(
  jobId: string,
  assigneeIds: string[],
  contextInput?: SessionRepositoryContextInput,
): Promise<Job | null> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);
  const ids = [...new Set(assigneeIds.map((id) => id.trim()).filter(Boolean))];
  let names: string[] = [];
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,full_name,email")
      .eq("org_id", orgId)
      .in("id", ids);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>;
    if (rows.length !== ids.length) {
      throw new Error("Invalid person for this company.");
    }
    const nameById = new Map(
      rows.map((row) => [
        row.id,
        (row.full_name ?? "").trim() || (row.email ?? "").trim() || "Team member",
      ]),
    );
    names = ids.map((id) => nameById.get(id) ?? "Team member");
  }

  const assignedTo = formatTeamLabel(names);
  // The board reads job_assignees. Write that first so a reload during the
  // label update already shows the person as removed.
  await writeJobAssignees(supabase, orgId, jobId, ids);
  let updateResult = await supabase
    .from("jobs")
    .update({
      assigned_to: assignedTo,
      assigned_user_id: ids[0] ?? null,
    })
    .eq("org_id", orgId)
    .eq("id", jobId)
    .select(JOB_SELECT)
    .maybeSingle();

  if (updateResult.error && isSchedulingColumnMissingError(updateResult.error)) {
    // A not-yet-applied column (e.g. closeout_mode) must not break people
    // assignment — retry with the legacy select, like the other write paths.
    updateResult = await supabase
      .from("jobs")
      .update({
        assigned_to: assignedTo,
        assigned_user_id: ids[0] ?? null,
      })
      .eq("org_id", orgId)
      .eq("id", jobId)
      .select(JOB_SELECT_WITH_LEGACY)
      .maybeSingle();
  }

  if (updateResult.error) throw new Error(updateResult.error.message);
  const data = toJobRow(updateResult.data);
  if (!data) return null;
  const job = mapJob(data);
  job.assignees = ids.map((id, index) => ({ id, name: names[index] ?? "Team member" }));
  return job;
}

export interface JobStatusActivity {
  jobId: string;
  title: string;
  createdAt: string;
}

const JOB_REPORT_SELECT =
  "id,job_number,type,status,title,customer_name,property_name,assigned_to,scheduled_start_at,scheduled_for,created_at,updated_at";

const JOB_REPORT_PAGE_SIZE = 1000;
const JOB_REPORT_PAGE_LIMIT = 50;
export interface JobReportListOptions {
  /** "YYYY-MM". When set, only jobs that can affect that month's reports are read. */
  month?: string;
  /** @deprecated Single-page mode kept for tests; prefer omit to page through. */
  page?: number;
  pageSize?: number;
}

function monthBounds(month: string): { start: string; next: string } {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    throw new Error(`Invalid report month: ${month}`);
  }
  const start = `${yearRaw}-${monthRaw}-01`;
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  const nextYear = monthIndex === 12 ? year + 1 : year;
  const next = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, next };
}

function mapJobReportRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    jobNumber: String(row.job_number ?? ""),
    type: String(row.type ?? ""),
    status: String(row.status ?? ""),
    title: String(row.title ?? ""),
    customerName: String(row.customer_name ?? ""),
    propertyName: String(row.property_name ?? ""),
    assignedTo: String(row.assigned_to ?? ""),
    scheduledStartAt: (row.scheduled_start_at as string | null) ?? null,
    scheduledFor: (row.scheduled_for as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/**
 * Job rows for the four operational reports.
 *
 * Previously defaulted to a single page of 50 newest jobs, so installs /
 * pipeline / scorecards / callbacks ignored the rest of the company. Now
 * pages through every active job (PostgREST 1,000-row pages). Month filtering
 * stays in the pure compute layer; status-activity timing is month-scoped
 * in listJobStatusActivities so the activity log does not grow unbounded.
 */
export async function listJobReportRows(
  contextInput?: SessionRepositoryContextInput,
  options?: JobReportListOptions,
): Promise<JobReportRow[]> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  // Legacy single-page path (explicit page/pageSize without month).
  if (options?.page != null || (options?.pageSize != null && options?.month == null)) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("jobs")
      .select(JOB_REPORT_SELECT)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as Array<Record<string, unknown>>).map(mapJobReportRow);
    const jobIds = rows.map((row) => row.id);
    const [assignees, completionTeams] = await Promise.all([
      readJobAssignees(supabase, orgId, jobIds),
      readCompletionTeams(supabase, orgId, jobIds),
    ]);
    return rows.map((row) => ({
      ...row,
      assignees: assignees.get(row.id) ?? [],
      completionTeam: completionTeams.get(row.id) ?? [],
    }));
  }

  // Page through every active job. A month filter in SQL barely reduces the
  // set today (import stamped updated_at on nearly every row) and a nested
  // PostgREST or-filter over Title Case statuses is easy to get wrong. The
  // pure compute layer still scopes by month; paging removes the 50-row bug.
  const rows: ReturnType<typeof mapJobReportRow>[] = [];
  for (let page = 0; page < JOB_REPORT_PAGE_LIMIT; page += 1) {
    const from = page * JOB_REPORT_PAGE_SIZE;
    const to = from + JOB_REPORT_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("jobs")
      .select(JOB_REPORT_SELECT)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    const batch = ((data ?? []) as Array<Record<string, unknown>>).map(mapJobReportRow);
    rows.push(...batch);
    if (batch.length < JOB_REPORT_PAGE_SIZE) break;
  }

  const jobIds = rows.map((row) => row.id);
  const [assignees, completionTeams] = await Promise.all([
    readJobAssignees(supabase, orgId, jobIds),
    readCompletionTeams(supabase, orgId, jobIds),
  ]);
  return rows.map((row) => ({
    ...row,
    assignees: assignees.get(row.id) ?? [],
    completionTeam: completionTeams.get(row.id) ?? [],
  }));
}

export interface JobStatusActivityListOptions {
  month?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Status-activity rows for operational-report timing.
 * Pages through the full (or month-scoped) log instead of the old 50-row default.
 */
export async function listJobStatusActivities(
  contextInput?: SessionRepositoryContextInput,
  options?: JobStatusActivityListOptions,
): Promise<JobStatusActivity[]> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  if (options?.page != null || (options?.pageSize != null && options?.month == null)) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("job_activity")
      .select("job_id,title,created_at")
      .eq("org_id", orgId)
      .eq("type", "status")
      .order("created_at", { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      jobId: String(row.job_id),
      title: String(row.title ?? ""),
      createdAt: String(row.created_at ?? ""),
    }));
  }

  const bounds = options?.month ? monthBounds(options.month) : null;
  const rows: JobStatusActivity[] = [];
  for (let page = 0; page < JOB_REPORT_PAGE_LIMIT; page += 1) {
    const from = page * JOB_REPORT_PAGE_SIZE;
    const to = from + JOB_REPORT_PAGE_SIZE - 1;
    let query = supabase
      .from("job_activity")
      .select("job_id,title,created_at")
      .eq("org_id", orgId)
      .eq("type", "status")
      .order("created_at", { ascending: true })
      .range(from, to);
    if (bounds) {
      query = query.gte("created_at", bounds.start).lt("created_at", bounds.next);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const batch = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      jobId: String(row.job_id),
      title: String(row.title ?? ""),
      createdAt: String(row.created_at ?? ""),
    }));
    rows.push(...batch);
    if (batch.length < JOB_REPORT_PAGE_SIZE) break;
  }
  return rows;
}
