import "server-only";

import {
  selectMyJobsToday,
  toMyJobCard,
  type MyJobCard,
  type MyJobsIdentity,
} from "@/features/my-jobs/utils/myJobs";
import { companyTimeZone, timeZoneOffsetMs, todayInCompanyTimeZone } from "@/lib/timezone";

import { listJobsByIds, listJobsInRange } from "./jobs";
import { getRepositoryContext } from "./supabaseContext";

/** UTC instant of 00:00 on `date` in the company timezone. */
export function companyDayStartUtcIso(date: string, timeZone = companyTimeZone()): string {
  const naive = new Date(`${date}T00:00:00.000Z`);
  const offset = timeZoneOffsetMs(naive, timeZone);
  const guess = new Date(naive.getTime() - offset);
  // Re-check the offset at the guessed instant so DST change days land right.
  const corrected = timeZoneOffsetMs(guess, timeZone);
  return new Date(naive.getTime() - corrected).toISOString();
}

/**
 * The signed-in user's jobs for today. Every read runs on the user's session,
 * so RLS applies: techs only ever get jobs they are assigned to, and the
 * customer phone only comes back for roles that may read customers.
 */
export async function listMyJobsToday(now = new Date()): Promise<{ today: string; cards: MyJobCard[] }> {
  const { supabase, orgId, userId } = await getRepositoryContext();
  const today = todayInCompanyTimeZone(now);
  if (!userId) return { today, cards: [] };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name,email")
    .eq("id", userId)
    .maybeSingle();
  const me: MyJobsIdentity = {
    userId,
    names: [profile?.full_name, profile?.email].filter((value): value is string => Boolean(value && value.trim())),
  };

  const scheduled = await listJobsInRange(today, today);

  // In Progress jobs started today (job_activity "Job started") whose
  // schedule does not touch today, e.g. a carry-over from yesterday.
  const { data: startedRows } = await supabase
    .from("job_activity")
    .select("job_id")
    .eq("org_id", orgId)
    .eq("type", "status")
    .eq("title", "Job started")
    .gte("created_at", companyDayStartUtcIso(today));
  const startedTodayJobIds = new Set(((startedRows ?? []) as Array<{ job_id: string }>).map((row) => row.job_id));
  const scheduledIds = new Set(scheduled.map((job) => job.id));
  const extraIds = [...startedTodayJobIds].filter((id) => !scheduledIds.has(id));
  const extra = extraIds.length > 0 ? await listJobsByIds(extraIds) : [];
  const candidates = [...scheduled, ...extra];

  // jobs.assigned_user_id is the other assignment signal the RLS policy honors.
  const candidateIds = candidates.map((job) => job.id);
  const assignedUserJobIds = new Set<string>();
  if (candidateIds.length > 0) {
    const { data: direct } = await supabase
      .from("jobs")
      .select("id")
      .eq("org_id", orgId)
      .eq("assigned_user_id", userId)
      .in("id", candidateIds);
    for (const row of (direct ?? []) as Array<{ id: string }>) assignedUserJobIds.add(row.id);
  }

  const mine = selectMyJobsToday({ jobs: candidates, me, today, assignedUserJobIds, startedTodayJobIds });

  // Customer phone: RLS returns no rows for roles that may not read customers (tech).
  const customerIds = [...new Set(mine.map((job) => job.customerId).filter((id): id is string => Boolean(id)))];
  const phoneByCustomer = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id,phone")
      .eq("org_id", orgId)
      .in("id", customerIds);
    for (const row of (customers ?? []) as Array<{ id: string; phone: string | null }>) {
      if (row.phone && row.phone.trim()) phoneByCustomer.set(row.id, row.phone.trim());
    }
  }

  return {
    today,
    cards: mine.map((job) => toMyJobCard(job, me, (job.customerId ? phoneByCustomer.get(job.customerId) : undefined) ?? null)),
  };
}
