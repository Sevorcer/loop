import "server-only";

import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  /** Jobs with status 'In Progress' or 'Scheduled' (dispatched/active). */
  activeJobs: number;
  /** Jobs completed today (updated_at date matches today). */
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
    completedTodayRes,
    scheduledTodayRes,
    blockedJobsRes,
    unassignedJobsRes,
    newCustomersRes,
    totalPropertiesRes,
  ] = await Promise.all([
    // Active: In Progress or Scheduled
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["In Progress", "Scheduled"]),

    // Completed today
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "Completed")
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
      .eq("status", "On Hold"),

    // Unassigned (assigned_to is blank)
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .not("status", "in", '("Completed","Cancelled")')
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
  ]);

  return {
    activeJobs: activeJobsRes.count ?? 0,
    completedToday: completedTodayRes.count ?? 0,
    scheduledToday: scheduledTodayRes.count ?? 0,
    blockedJobs: blockedJobsRes.count ?? 0,
    unassignedJobs: unassignedJobsRes.count ?? 0,
    newCustomersThisMonth: newCustomersRes.count ?? 0,
    totalProperties: totalPropertiesRes.count ?? 0,
  };
}
