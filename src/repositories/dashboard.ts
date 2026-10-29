import "server-only";

import { getStatusVariants } from "@/lib/jobs/status";

import { getRepositoryContext } from "./supabaseContext";
import { OPEN_JOB_STATUS_EXCLUSION_FILTER } from "./shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  /** Jobs with status 'In Progress' or 'Scheduled' (dispatched/active). */
  activeJobs: number;
  /** Jobs completed today (completion activity preferred, updated_at fallback). */
  completedToday: number;
  /** Jobs scheduled for today (scheduled_for date matches today). */
  scheduledToday: number;
  /** Jobs with status 'On Hold' (blocked / at-risk). */
  blockedJobs: number;
  /** Jobs with no assigned technician. */
  unassignedJobs: number;
  /** Customers created in the current calendar month. */
  newCustomersThisMonth: number;
  /** Total properties in portfolio (not soft-deleted). */
  totalProperties: number;
  /** Distinct technicians named on jobs scheduled for today. */
  activeCrews: number;
  /** Open jobs whose type is Callback. */
  openCallbacks: number;
  /** Open jobs whose type is Estimate. Null is not used — zero means none are open. */
  openEstimates: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthISO(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Returns live KPI counts for the Operations Home dashboard.
 *
 * All queries are scoped to the caller's org via the repository context and
 * exclude soft-deleted records (deleted_at IS NULL guard handled by RLS and
 * the select filters below).
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { supabase, orgId } = await getRepositoryContext();
  const today = todayISO();
  const monthStart = firstDayOfMonthISO();

  // Run all counts in parallel for a single-roundtrip feel.
  const [
    activeJobsRes,
    completedTodayByActivityRes,
    completedTodayFallbackRes,
    scheduledTodayRes,
    blockedJobsRes,
    unassignedJobsRes,
    newCustomersRes,
    totalPropertiesRes,
    todayAssignmentsRes,
    openCallbacksRes,
    openEstimatesRes,
  ] = await Promise.all([
    // Active: In Progress or Scheduled
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", getStatusVariants(["In Progress", "Scheduled"])),

    // Completed today (best signal: explicit completion activity)
    supabase
      .from("job_activity")
      .select("job_id")
      .eq("org_id", orgId)
      .eq("type", "status")
      .ilike("title", "Job completed%")
      .gte("created_at", today),

    // Fallback for legacy completion rows without activity event
    supabase
      .from("jobs")
      .select("id")
      .eq("org_id", orgId)
      .in("status", getStatusVariants(["Completed"]))
      .gte("updated_at", today),

    // Scheduled for today
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("scheduled_for", today),

    // Blocked (on hold / at-risk)
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", getStatusVariants(["On Hold"])),

    // Unassigned (assigned_to is blank)
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
      .or("assigned_to.is.null,assigned_to.eq."),

    // New customers this month
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .gte("created_at", monthStart),

    // Total properties
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),

    // Technicians named on today's jobs
    supabase
      .from("jobs")
      .select("assigned_to")
      .eq("org_id", orgId)
      .eq("scheduled_for", today)
      .not("assigned_to", "is", null),

    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("type", ["Callback", "callback"])
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER),

    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("type", ["Estimate", "estimate"])
      .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER),
  ]);

  const assignedToday = new Set<string>();
  for (const row of todayAssignmentsRes.data ?? []) {
    const name = typeof row.assigned_to === "string" ? row.assigned_to.trim() : "";
    if (name) assignedToday.add(name.toLowerCase());
  }
  return {
    activeJobs: activeJobsRes.count ?? 0,
    completedToday: (() => {
      const completedIds = new Set<string>();
      for (const row of completedTodayByActivityRes.data ?? []) {
        if (typeof row.job_id === "string" && row.job_id.length > 0) {
          completedIds.add(row.job_id);
        }
      }
      for (const row of completedTodayFallbackRes.data ?? []) {
        if (typeof row.id === "string" && row.id.length > 0) {
          completedIds.add(row.id);
        }
      }
      return completedIds.size;
    })(),
    scheduledToday: scheduledTodayRes.count ?? 0,
    blockedJobs: blockedJobsRes.count ?? 0,
    unassignedJobs: unassignedJobsRes.count ?? 0,
    newCustomersThisMonth: newCustomersRes.count ?? 0,
    totalProperties: totalPropertiesRes.count ?? 0,
    activeCrews: assignedToday.size,
    openCallbacks: openCallbacksRes.count ?? 0,
    openEstimates: openEstimatesRes.count ?? 0,
  };
}

export interface DashboardAttentionJob {
  id: string;
  jobNumber: string;
  title: string;
  status: string;
  type: string;
  assignedTo: string;
}

/** Open jobs the dashboard can turn into an attention list. Capped for the home screen. */
export async function listDashboardAttentionJobs(): Promise<DashboardAttentionJob[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .select("id,job_number,title,status,type,assigned_to")
    .eq("org_id", orgId)
    .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    jobNumber: typeof row.job_number === "string" ? row.job_number : "",
    title: typeof row.title === "string" ? row.title : "Job",
    status: typeof row.status === "string" ? row.status : "",
    type: typeof row.type === "string" ? row.type : "",
    assignedTo: typeof row.assigned_to === "string" ? row.assigned_to : "",
  }));
}
