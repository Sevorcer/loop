import "server-only";

import type { Job } from "@/features/jobs/types/job";
import type { DispatchPlan } from "@/features/dispatch/types/dispatch";
import type { CommandCenterSnapshot } from "@/features/command-center/types/commandCenter";
import { getStatusVariants } from "@/lib/jobs/status";
import {
  computeKPIs,
  aggregateCrewWorkload,
  buildProblemJobs,
} from "@/features/command-center/utils/commandCenterUtils";

import { getRepositoryContext } from "./supabaseContext";
import { OPEN_JOB_STATUS_EXCLUSION_FILTER } from "./shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

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
// Main query
// ---------------------------------------------------------------------------

/**
 * Fetches all data required by the Command Center screen.
 *
 * Runs ~9 Supabase queries in parallel for a single-roundtrip feel.
 * All queries are scoped to the caller's org via the repository context.
 *
 * Throws on any query failure so the caller can handle the error uniformly
 * and fall back to an empty-state snapshot.
 */
export async function getCommandCenterSnapshot(): Promise<CommandCenterSnapshot> {
  const { supabase, orgId } = await getRepositoryContext();
  const today = todayISO();
  const inProgressStatuses = getStatusVariants(["In Progress"]);
  const onHoldStatuses = getStatusVariants(["On Hold"]);
  const completedStatuses = getStatusVariants(["Completed"]);

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
  ] = await Promise.all([
    // 1. Scheduled today (status ≠ Cancelled)
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .eq("scheduled_for", today)
      .neq("status", "Cancelled")
      .order("priority", { ascending: true }),

    // 2. In Progress
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .in("status", inProgressStatuses)
      .order("scheduled_for", { ascending: true }),

    // 3. On Hold — label honestly kept as "On Hold" (not "Waiting on Parts")
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .in("status", onHoldStatuses)
      .order("scheduled_for", { ascending: true }),

    // 4. Inspections (type=Inspection, open)
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .eq("type", "Inspection")
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
      .order("scheduled_for", { ascending: true }),

    // 5. Callbacks — ILIKE pattern match on title or notes
    //    NOTE: no dedicated type/flag in current schema; Sprint 8 should add one.
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
      .or("title.ilike.%callback%,notes.ilike.%callback%")
      .order("scheduled_for", { ascending: true }),

    // 6. Unassigned (assigned_to is null or empty string)
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
      .or("assigned_to.is.null,assigned_to.eq.")
      .order("scheduled_for", { ascending: true }),

    // 7. Late (scheduled_for < today AND status open)
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .lt("scheduled_for", today)
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
      .order("scheduled_for", { ascending: true }),

    // 8. Completed today
    //    Fallback source for legacy rows without explicit completion activity.
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .in("status", completedStatuses)
      .gte("updated_at", today)
      .order("updated_at", { ascending: false }),

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
    dispatchPlansRes.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

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
  };

  const allOpenJobs = [
    ...scheduledToday,
    ...inProgress,
    ...onHold,
    ...inspections,
    ...callbacks,
    ...unassigned,
    ...late,
  ];

  const kpis = computeKPIs(rawSnapshot);
  const crewWorkload = aggregateCrewWorkload(allOpenJobs, today);
  const problemJobs = buildProblemJobs(late, unassigned, onHold);

  return {
    ...rawSnapshot,
    kpis,
    crewWorkload,
    problemJobs,
  };
}

/**
 * Returns a zero-state snapshot used as a fallback when the DB is
 * unavailable or returns an error. Ensures the screen always renders.
 */
export function getEmptyCommandCenterSnapshot(): CommandCenterSnapshot {
  const today = todayISO();
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
    crewWorkload: [],
    problemJobs: [],
  };
}
