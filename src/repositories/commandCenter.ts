import "server-only";

import type { Job } from "@/features/jobs/types/job";
import type { DispatchPlan } from "@/features/dispatch/types/dispatch";
import type { CommandCenterSnapshot, CommandCenterCounts } from "@/features/command-center/types/commandCenter";
import { getStatusVariants } from "@/lib/jobs/status";
import { todayInCompanyTimeZone } from "@/lib/timezone";
import { CALLBACK_TYPE_QUERY_VARIANTS } from "@/lib/callbacks";
import {
  computeKPIs,
  aggregatePersonWorkload,
  aggregateTeamWorkload,
  buildProblemJobs,
} from "@/features/command-center/utils/commandCenterUtils";

import { getRepositoryContext } from "./supabaseContext";
import { OPEN_JOB_STATUS_EXCLUSION_FILTER } from "./shared";

// ---------------------------------------------------------------------------
// Row shape (re-uses the same fields as jobs repository)
// ---------------------------------------------------------------------------

interface JobRow {
  id: string;
  job_number: string;
  estimate_id: string | null;
  equipment_bundle_id: string | null;
  title: string;
  type: string;
  status: string;
  priority: string;
  customer_id: string | null;
  customer_name: string;
  property_id: string | null;
  property_name: string;
  assigned_to: string;
  scheduled_for: string | null;
  summary: string;
  location: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

const JOB_COLUMNS =
  "id,job_number,estimate_id,equipment_bundle_id,title,type,status,priority,customer_id,customer_name,property_id,property_name,assigned_to,scheduled_for,summary,location,notes,created_at,updated_at";

function mapJobRow(row: JobRow): Job {
  return {
    id: row.id,
    jobNumber: row.job_number,
    estimateId: row.estimate_id ?? undefined,
    equipmentBundleId: row.equipment_bundle_id ?? undefined,
    title: row.title,
    type: row.type as Job["type"],
    status: row.status as Job["status"],
    priority: row.priority as Job["priority"],
    customerId: row.customer_id,
    customerName: row.customer_name,
    propertyId: row.property_id,
    propertyName: row.property_name,
    assignedTo: row.assigned_to,
    scheduledFor: row.scheduled_for ?? null,
    summary: row.summary,
    location: row.location,
    notes: row.notes,
  };
}

// ---------------------------------------------------------------------------
// Dispatch plan row (minimal fields needed by Command Center)
// ---------------------------------------------------------------------------

interface DispatchPlanRow {
  id: string;
  job_id: string | null;
  job_number: string;
  customer_name: string;
  property_name: string;
  job_type: string;
  dispatch_status: string;
  dispatchability: unknown;
  target_date: string | null;
  estimated_duration_hours: number;
  priority: string;
  sequencing_notes: string | null;
  constraints: unknown;
  created_at: string;
  updated_at: string;
}

interface CompletionActivityRow {
  job_id: string;
}

const DISPATCH_PLAN_COLUMNS =
  "id,job_id,job_number,customer_name,property_name,job_type,dispatch_status,dispatchability,target_date,estimated_duration_hours,priority,sequencing_notes,constraints,created_at,updated_at";

function mapDispatchPlanRow(row: DispatchPlanRow): DispatchPlan {
  return {
    id: row.id,
    jobId: row.job_id ?? "",
    jobNumber: row.job_number,
    customerName: row.customer_name,
    propertyName: row.property_name,
    jobType: row.job_type,
    dispatchStatus: row.dispatch_status as DispatchPlan["dispatchStatus"],
    dispatchability: (row.dispatchability as DispatchPlan["dispatchability"]) ?? {
      isDispatchable: false,
      materialReadiness: { state: "not_satisfied", reason: "" },
      technicalReadiness: { state: "not_satisfied", reason: "" },
      customerReadiness: { state: "not_satisfied", reason: "" },
      crewReadiness: { state: "not_satisfied", reason: "" },
    },
    targetDate: row.target_date ?? "",
    estimatedDurationHours: row.estimated_duration_hours,
    priority: row.priority as DispatchPlan["priority"],
    sequencingNotes: row.sequencing_notes ?? undefined,
    constraints: (row.constraints as DispatchPlan["constraints"]) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Minimal row shape for workload aggregation (avoids full-row selects)
// ---------------------------------------------------------------------------

interface WorkloadJobRow {
  id: string;
  status: string;
  priority: string;
  assigned_to: string;
  scheduled_for: string | null;
}

const WORKLOAD_COLUMNS = "id,status,priority,assigned_to,scheduled_for";

function mapWorkloadRow(row: WorkloadJobRow): Job {
  return {
    id: row.id,
    jobNumber: "",
    title: "",
    type: "" as Job["type"],
    status: row.status as Job["status"],
    priority: row.priority as Job["priority"],
    customerName: "",
    propertyName: "",
    assignedTo: row.assigned_to,
    scheduledFor: row.scheduled_for ?? null,
    summary: "",
    location: "",
    notes: "",
  };
}

// ---------------------------------------------------------------------------
// Widget display cap — widgets show at most 6 rows, so we fetch a small
// buffer. The true total comes from the server-side count.
// ---------------------------------------------------------------------------

const WIDGET_ROW_LIMIT = 25;

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

/**
 * Fetches all data required by the Command Center screen.
 *
 * Uses server-side COUNT queries for KPIs instead of fetching full row sets
 * and deriving counts from `.length`. Row fetches for widget display are
 * capped at WIDGET_ROW_LIMIT. A separate lightweight query fetches minimal
 * columns for all open jobs to compute workload aggregation.
 *
 * Throws on any query failure so the caller can handle the error uniformly
 * and fall back to an empty-state snapshot.
 */
export async function getCommandCenterSnapshot(): Promise<CommandCenterSnapshot> {
  const { supabase, orgId } = await getRepositoryContext();
  // "Today" is the company's wall-clock day, not UTC. A UTC "today" flipped the
  // day early after ~4–5 PM Pacific, so scheduled/late/completed-today reads
  // jumped to tomorrow. Matches Calendar/Dispatch/JobTable's company timezone.
  const today = todayInCompanyTimeZone();
  const inProgressStatuses = getStatusVariants(["In Progress"]);
  const onHoldStatuses = getStatusVariants(["On Hold"]);
  const completedStatuses = getStatusVariants(["Completed"]);

  // Phase 1: Parallel count+row queries for each category.
  // Using { count: "exact" } with .limit() gives us both the true total
  // and a capped set of rows for widget display.
  const [
    scheduledTodayRes,
    inProgressRes,
    onHoldRes,
    inspectionsRes,
    callbacksRes,
    unassignedRes,
    lateRes,
    completedTodayFallbackRes,
    completionActivityRes,
    dispatchPlansRes,
    workloadRes,
  ] = await Promise.all([
    // 1. Scheduled today (status ≠ Cancelled)
    supabase
      .from("jobs")
      .select(JOB_COLUMNS, { count: "exact" })
      .eq("org_id", orgId)
      .eq("scheduled_for", today)
      .neq("status", "Cancelled")
      .order("priority", { ascending: true })
      .limit(WIDGET_ROW_LIMIT),

    // 2. In Progress
    supabase
      .from("jobs")
      .select(JOB_COLUMNS, { count: "exact" })
      .eq("org_id", orgId)
      .in("status", inProgressStatuses)
      .order("scheduled_for", { ascending: true })
      .limit(WIDGET_ROW_LIMIT),

    // 3. On Hold
    supabase
      .from("jobs")
      .select(JOB_COLUMNS, { count: "exact" })
      .eq("org_id", orgId)
      .in("status", onHoldStatuses)
      .order("scheduled_for", { ascending: true })
      .limit(WIDGET_ROW_LIMIT),

    // 4. Inspections (type=Inspection, open)
    supabase
      .from("jobs")
      .select(JOB_COLUMNS, { count: "exact" })
      .eq("org_id", orgId)
      .eq("type", "Inspection")
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
      .order("scheduled_for", { ascending: true })
      .limit(WIDGET_ROW_LIMIT),

    // 5. Open callbacks
    supabase
      .from("jobs")
      .select(JOB_COLUMNS, { count: "exact" })
      .eq("org_id", orgId)
      .in("type", CALLBACK_TYPE_QUERY_VARIANTS)
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
      .order("scheduled_for", { ascending: true })
      .limit(WIDGET_ROW_LIMIT),

    // 6. Unassigned — ACTIONABLE only: open status + blank assignee +
    //    NOT scheduled in the past. Past-scheduled unassigned jobs are
    //    covered by the "late" bucket. This excludes imported historical
    //    jobs with blank assignees that inflate the count.
    //    Matches the dashboard's aligned definition.
    supabase
      .from("jobs")
      .select(JOB_COLUMNS, { count: "exact" })
      .eq("org_id", orgId)
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
      .or("assigned_to.is.null,assigned_to.eq.")
      .or(`scheduled_for.gte.${today},scheduled_for.is.null`)
      .order("scheduled_for", { ascending: true })
      .limit(WIDGET_ROW_LIMIT),

    // 7. Late (scheduled_for < today AND status open)
    supabase
      .from("jobs")
      .select(JOB_COLUMNS, { count: "exact" })
      .eq("org_id", orgId)
      .lt("scheduled_for", today)
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
      .order("scheduled_for", { ascending: true })
      .limit(WIDGET_ROW_LIMIT),

    // 8. Completed today
    //    Fallback source for legacy rows without explicit completion activity.
    supabase
      .from("jobs")
      .select(JOB_COLUMNS, { count: "exact" })
      .eq("org_id", orgId)
      .in("status", completedStatuses)
      .gte("updated_at", today)
      .order("updated_at", { ascending: false })
      .limit(WIDGET_ROW_LIMIT),

    // 8b. Preferred completion signal for completed-today KPI/list.
    supabase
      .from("job_activity")
      .select("job_id")
      .eq("org_id", orgId)
      .eq("type", "status")
      .ilike("title", "Job completed%")
      .gte("created_at", today),

    // 9. Dispatch plans (all, for permit KPI + avg completion time)
    supabase
      .from("dispatch_plans")
      .select(DISPATCH_PLAN_COLUMNS)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),

    // 10. Workload query — minimal columns for all open jobs.
    //     Used for per-person and per-team workload aggregation, which needs
    //     the complete set of open jobs (not capped).
    supabase
      .from("jobs")
      .select(WORKLOAD_COLUMNS)
      .eq("org_id", orgId)
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
      .order("scheduled_for", { ascending: true }),
  ]);

  // Surface the first error encountered
  const firstError =
    scheduledTodayRes.error ??
    inProgressRes.error ??
    onHoldRes.error ??
    inspectionsRes.error ??
    callbacksRes.error ??
    unassignedRes.error ??
    lateRes.error ??
    completedTodayFallbackRes.error ??
    completionActivityRes.error ??
    dispatchPlansRes.error ??
    workloadRes.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  // Map rows for widget display (capped at WIDGET_ROW_LIMIT)
  const scheduledToday = ((scheduledTodayRes.data ?? []) as JobRow[]).map(mapJobRow);
  const inProgress = ((inProgressRes.data ?? []) as JobRow[]).map(mapJobRow);
  const onHold = ((onHoldRes.data ?? []) as JobRow[]).map(mapJobRow);
  const inspections = ((inspectionsRes.data ?? []) as JobRow[]).map(mapJobRow);
  const callbacks = ((callbacksRes.data ?? []) as JobRow[]).map(mapJobRow);
  const unassigned = ((unassignedRes.data ?? []) as JobRow[]).map(mapJobRow);
  const late = ((lateRes.data ?? []) as JobRow[]).map(mapJobRow);
  const completedTodayFromFallback = ((completedTodayFallbackRes.data ?? []) as JobRow[]).map(
    mapJobRow,
  );
  const dispatchPlans = ((dispatchPlansRes.data ?? []) as DispatchPlanRow[]).map(
    mapDispatchPlanRow,
  );

  // Server-side counts from the count queries.
  // completedToday is computed below after merging activity + fallback sources.
  const counts: CommandCenterCounts = {
    scheduledToday: scheduledTodayRes.count ?? scheduledToday.length,
    inProgress: inProgressRes.count ?? inProgress.length,
    onHold: onHoldRes.count ?? onHold.length,
    inspections: inspectionsRes.count ?? inspections.length,
    callbacks: callbacksRes.count ?? callbacks.length,
    unassigned: unassignedRes.count ?? unassigned.length,
    late: lateRes.count ?? late.length,
    completedTodayFallback: completedTodayFallbackRes.count ?? completedTodayFromFallback.length,
    completedToday: 0,
  };

  const completionJobIds = Array.from(
    new Set(
      ((completionActivityRes.data ?? []) as CompletionActivityRow[])
        .map((row) => row.job_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  let completedTodayFromActivity: Job[] = [];
  if (completionJobIds.length > 0) {
    const completedActivityJobsRes = await supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .in("id", completionJobIds)
      .in("status", completedStatuses)
      .order("updated_at", { ascending: false });

    if (completedActivityJobsRes.error) {
      throw new Error(completedActivityJobsRes.error.message);
    }

    completedTodayFromActivity = ((completedActivityJobsRes.data ?? []) as JobRow[]).map(
      mapJobRow,
    );
  }

  const completedToday = Array.from(
    new Map(
      [...completedTodayFromActivity, ...completedTodayFromFallback].map((job) => [job.id, job]),
    ).values(),
  );

  // Completed today count: union of activity-based ids and fallback ids
  const completedTodayCount = new Set([
    ...completionJobIds,
    ...completedTodayFromFallback.map((job) => job.id),
  ]).size;
  counts.completedToday = completedTodayCount;

  // Workload computation uses the minimal-column query for all open jobs
  const workloadJobs = ((workloadRes.data ?? []) as WorkloadJobRow[]).map(mapWorkloadRow);

  // Attach assignees only to the capped widget rows (not the full workload set)
  const widgetJobs = [
    ...scheduledToday,
    ...inProgress,
    ...onHold,
    ...inspections,
    ...callbacks,
    ...unassigned,
    ...late,
  ];

  await Promise.all([
    attachAssignees(supabase, orgId, widgetJobs),
    attachAssignees(supabase, orgId, workloadJobs),
  ]);

  const rawSnapshot = {
    today,
    scheduledToday,
    inProgress,
    onHold,
    inspections,
    callbacks,
    unassigned,
    late,
    completedToday,
    dispatchPlans,
    counts,
  };

  const kpis = computeKPIs(rawSnapshot);
  const personWorkload = aggregatePersonWorkload(workloadJobs, today);
  const teamWorkload = aggregateTeamWorkload(workloadJobs, today);
  const problemJobs = buildProblemJobs(late, unassigned, onHold);

  return {
    ...rawSnapshot,
    kpis,
    personWorkload,
    teamWorkload,
    problemJobs,
  };
}

/**
 * Returns a zero-state snapshot used as a fallback when the DB is
 * unavailable or returns an error. Ensures the screen always renders.
 */
export function getEmptyCommandCenterSnapshot(): CommandCenterSnapshot {
  const today = todayInCompanyTimeZone();
  return {
    today,
    scheduledToday: [],
    inProgress: [],
    onHold: [],
    inspections: [],
    callbacks: [],
    unassigned: [],
    late: [],
    completedToday: [],
    dispatchPlans: [],
    counts: {
      scheduledToday: 0,
      inProgress: 0,
      onHold: 0,
      inspections: 0,
      callbacks: 0,
      unassigned: 0,
      late: 0,
      completedTodayFallback: 0,
      completedToday: 0,
    },
    kpis: {
      jobsToday: 0,
      crewsDispatched: 0,
      waitingOnInspection: 0,
      waitingOnPermit: 0,
      callbacks: 0,
      completedToday: 0,
      jobsRunningLate: 0,
      avgCompletionHours: null,
    },
    personWorkload: [],
    teamWorkload: [],
    problemJobs: [],
  };
}

async function attachAssignees(
  supabase: Awaited<ReturnType<typeof getRepositoryContext>>["supabase"],
  orgId: string,
  jobs: Job[],
): Promise<void> {
  const ids = [...new Set(jobs.map((job) => job.id))];
  if (ids.length === 0) return;
  const { data, error } = await supabase
    .from("job_assignees")
    .select("job_id,user_id")
    .eq("org_id", orgId)
    .in("job_id", ids);
  if (error) {
    const message = error.message ?? "";
    if (error.code === "42P01" || error.code === "PGRST205" || message.includes("job_assignees")) return;
    throw new Error(error.message);
  }
  const rows = (data ?? []) as Array<{ job_id: string; user_id: string }>;
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const profiles = await supabase.from("user_profiles").select("id,full_name,email").in("id", userIds);
    if (profiles.error) throw new Error(profiles.error.message);
    for (const profile of (profiles.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      names.set(profile.id, (profile.full_name ?? "").trim() || (profile.email ?? "").trim() || "Team member");
    }
  }
  const byJob = new Map<string, { id: string; name: string }[]>();
  for (const row of rows) {
    const list = byJob.get(row.job_id) ?? [];
    list.push({ id: row.user_id, name: names.get(row.user_id) ?? "Team member" });
    byJob.set(row.job_id, list);
  }
  for (const job of jobs) {
    const people = byJob.get(job.id);
    if (people && people.length > 0) job.assignees = people;
  }
}
