import "server-only";

import type { FollowUpItem, JobFollowUpState } from "@/features/follow-ups/types/followUp";
import type { FollowUpColumns } from "@/features/follow-ups/utils/followUpPatch";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Job follow-ups: jobs.follow_up_* columns (migration 20261122000000).
// Kept apart from repositories/jobs.ts on purpose so the shared job SELECT /
// fallback chain does not depend on a migration that may not be applied yet.
// Before the migration, reads degrade to "no follow-ups" instead of erroring.
// ---------------------------------------------------------------------------

function columnsUnavailable(error: { code?: string; message?: string }): boolean {
  return error.code === "42703" || error.code === "PGRST204" || (error.message ?? "").includes("follow_up");
}

interface FollowUpStateRow {
  follow_up_needed: boolean | null;
  follow_up_note: string | null;
  follow_up_marked_at: string | null;
  follow_up_marked_by: string | null;
}

function mapState(row: FollowUpStateRow): JobFollowUpState {
  return {
    needed: row.follow_up_needed === true,
    note: row.follow_up_note ?? null,
    markedAt: row.follow_up_marked_at ?? null,
    markedBy: row.follow_up_marked_by ?? null,
  };
}

const EMPTY_STATE: JobFollowUpState = { needed: false, note: null, markedAt: null, markedBy: null };

export async function getJobFollowUp(jobId: string): Promise<JobFollowUpState | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .select("follow_up_needed,follow_up_note,follow_up_marked_at,follow_up_marked_by")
    .eq("org_id", orgId)
    .eq("id", jobId)
    .maybeSingle();
  if (error) {
    if (columnsUnavailable(error)) return EMPTY_STATE;
    throw new Error(error.message);
  }
  return data ? mapState(data as FollowUpStateRow) : null;
}

/** Writes the follow-up columns. Returns the saved state, or null when no row was updated. */
export async function writeJobFollowUp(
  jobId: string,
  columns: FollowUpColumns,
): Promise<JobFollowUpState | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .update(columns)
    .eq("org_id", orgId)
    .eq("id", jobId)
    .select("follow_up_needed,follow_up_note,follow_up_marked_at,follow_up_marked_by");
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as FollowUpStateRow | undefined;
  return row ? mapState(row) : null;
}

interface FollowUpListRow {
  id: string;
  job_number: string | null;
  title: string | null;
  status: string | null;
  customer_name: string | null;
  property_name: string | null;
  scheduled_for: string | null;
  follow_up_note: string | null;
  follow_up_marked_at: string | null;
  follow_up_marked_by: string | null;
}

/** Open follow-ups, newest mark first. */
export async function listOpenFollowUps(limit = 200): Promise<FollowUpItem[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id,job_number,title,status,customer_name,property_name,scheduled_for,follow_up_note,follow_up_marked_at,follow_up_marked_by",
    )
    .eq("org_id", orgId)
    .eq("follow_up_needed", true)
    .order("follow_up_marked_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    if (columnsUnavailable(error)) return [];
    throw new Error(error.message);
  }
  const rows = (data ?? []) as FollowUpListRow[];

  const markerIds = Array.from(
    new Set(rows.map((row) => row.follow_up_marked_by).filter((id): id is string => Boolean(id))),
  );
  const names = new Map<string, string>();
  if (markerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id,full_name")
      .in("id", markerIds);
    for (const profile of (profiles ?? []) as { id: string; full_name: string | null }[]) {
      if (profile.full_name?.trim()) names.set(profile.id, profile.full_name.trim());
    }
  }

  return rows.map((row) => ({
    jobId: row.id,
    jobNumber: row.job_number ?? "",
    title: row.title ?? "",
    status: row.status ?? "",
    customerName: row.customer_name ?? "",
    propertyName: row.property_name ?? "",
    scheduledFor: row.scheduled_for ?? null,
    note: row.follow_up_note ?? null,
    markedAt: row.follow_up_marked_at ?? null,
    markedByName: row.follow_up_marked_by ? (names.get(row.follow_up_marked_by) ?? null) : null,
  }));
}
