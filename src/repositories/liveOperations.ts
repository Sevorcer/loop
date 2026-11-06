import "server-only";

import type { Job } from "@/features/jobs/types/job";
import type {
  LiveActivity,
  LiveJob,
  LiveNote,
  LiveOpsInput,
  LiveOpsSnapshot,
  LivePerson,
  LiveTimeOff,
} from "@/features/live-operations/types/liveOps";
import { buildLiveOpsSnapshot, companyDayBounds } from "@/features/live-operations/utils/liveOpsUtils";
import { todayInCompanyTimeZone } from "@/lib/timezone";

import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Live Operations repository (2026-11-05)
//
// One small read per table, scoped to today's jobs plus any open In Progress
// job. Polled every 60 s from the Live tab, so every select lists only the
// columns Live needs (no notes bodies, no file names, no activity text).
// ---------------------------------------------------------------------------

const JOB_COLUMNS =
  "id,job_number,estimate_id,equipment_bundle_id,title,type,status,priority,customer_id,customer_name,property_id,property_name,assigned_to,scheduled_for,summary,location,notes,scheduled_start_at,scheduled_end_at,arrival_window_start_at,arrival_window_end_at,en_route_at";

const INTERNAL_ROLES = ["owner", "manager", "dispatch", "tech", "office", "sales"];

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
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  arrival_window_start_at: string | null;
  arrival_window_end_at: string | null;
  en_route_at: string | null;
}

function mapJob(row: JobRow, assignees: { id: string; name: string }[]): LiveJob {
  const job: Job = {
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
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    arrivalWindowStartAt: row.arrival_window_start_at,
    arrivalWindowEndAt: row.arrival_window_end_at,
    enRouteAt: row.en_route_at,
    summary: row.summary,
    location: row.location,
    notes: row.notes,
    assignees: assignees.length > 0 ? assignees : undefined,
  };
  return {
    id: row.id,
    jobNumber: row.job_number,
    title: row.title,
    type: row.type,
    status: row.status as LiveJob["status"],
    customerName: row.customer_name,
    propertyName: row.property_name,
    scheduledFor: row.scheduled_for ?? null,
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    arrivalWindowStartAt: row.arrival_window_start_at,
    arrivalWindowEndAt: row.arrival_window_end_at,
    enRouteAt: row.en_route_at,
    assignees,
    job,
  };
}

function personName(row: { full_name: string | null; email: string | null }): string {
  return (row.full_name ?? "").trim() || (row.email ?? "").trim() || "Team member";
}

/** Load the raw inputs for one company day. Exported for tests. */
export async function loadLiveOpsInput(now = new Date()): Promise<LiveOpsInput> {
  const { supabase, orgId } = await getRepositoryContext();
  const date = todayInCompanyTimeZone(now);
  const day = companyDayBounds(date);
  const dayStartIso = new Date(day.start).toISOString();
  const dayEndIso = new Date(day.end).toISOString();

  const [todayRes, inProgressRes, peopleRes, timeOffRes, activationRes] = await Promise.all([
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .eq("scheduled_for", date)
      .is("deleted_at", null)
      .neq("status", "Cancelled"),
    supabase
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("org_id", orgId)
      .eq("status", "In Progress")
      .is("deleted_at", null),
    supabase
      .from("user_profiles")
      .select("id,full_name,email,app_role")
      .eq("org_id", orgId)
      .in("app_role", INTERNAL_ROLES),
    supabase
      .from("time_off")
      .select("user_id,starts_at,ends_at")
      .eq("org_id", orgId)
      .lt("starts_at", dayEndIso)
      .gt("ends_at", dayStartIso),
    supabase
      .from("daily_plan_activations")
      .select("status,started_at")
      .eq("org_id", orgId)
      .eq("date", date)
      .maybeSingle(),
  ]);

  const firstError =
    todayRes.error ?? inProgressRes.error ?? peopleRes.error ?? timeOffRes.error;
  if (firstError) throw new Error(firstError.message);

  const rowsById = new Map<string, JobRow>();
  for (const row of [...((todayRes.data ?? []) as JobRow[]), ...((inProgressRes.data ?? []) as JobRow[])]) {
    rowsById.set(row.id, row);
  }
  const jobIds = [...rowsById.keys()];
  const inProgressIds = [...rowsById.values()]
    .filter((row) => row.status === "In Progress")
    .map((row) => row.id);

  const people: LivePerson[] = (
    (peopleRes.data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; app_role: string | null }>
  ).map((row) => ({ id: row.id, name: personName(row), role: row.app_role }));
  const names = new Map(people.map((person) => [person.id, person.name]));

  let assigneeRows: Array<{ job_id: string; user_id: string }> = [];
  let activity: LiveActivity[] = [];
  let notes: LiveNote[] = [];

  if (jobIds.length > 0) {
    const [assigneeRes, todayActivityRes, startedRes, notesRes] = await Promise.all([
      supabase.from("job_assignees").select("job_id,user_id").eq("org_id", orgId).in("job_id", jobIds),
      supabase
        .from("job_activity")
        .select("id,job_id,type,title,created_at,actor_id")
        .eq("org_id", orgId)
        .in("job_id", jobIds)
        .gte("created_at", dayStartIso)
        .lt("created_at", dayEndIso)
        .order("created_at", { ascending: false })
        .limit(200),
      inProgressIds.length > 0
        ? supabase
            .from("job_activity")
            .select("id,job_id,type,title,created_at,actor_id")
            .eq("org_id", orgId)
            .in("job_id", inProgressIds)
            .eq("type", "status")
            .eq("title", "Job started")
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("job_notes")
        .select("id,job_id,created_at,author_id")
        .eq("org_id", orgId)
        .in("job_id", jobIds)
        .gte("created_at", dayStartIso)
        .lt("created_at", dayEndIso),
    ]);
    const nestedError = assigneeRes.error ?? todayActivityRes.error ?? startedRes.error ?? notesRes.error;
    if (nestedError) throw new Error(nestedError.message);

    assigneeRows = (assigneeRes.data ?? []) as Array<{ job_id: string; user_id: string }>;

    const activityById = new Map<string, LiveActivity>();
    for (const row of [
      ...((todayActivityRes.data ?? []) as ActivityRow[]),
      ...((startedRes.data ?? []) as ActivityRow[]),
    ]) {
      activityById.set(row.id, {
        id: row.id,
        jobId: row.job_id,
        type: row.type,
        title: row.title,
        createdAt: row.created_at,
        actorId: row.actor_id,
      });
    }
    activity = [...activityById.values()];
    notes = ((notesRes.data ?? []) as Array<{ id: string; job_id: string; created_at: string; author_id: string | null }>).map(
      (row) => ({ id: row.id, jobId: row.job_id, createdAt: row.created_at, authorId: row.author_id }),
    );
  }

  const assigneesByJob = new Map<string, { id: string; name: string }[]>();
  for (const row of assigneeRows) {
    const list = assigneesByJob.get(row.job_id) ?? [];
    list.push({ id: row.user_id, name: names.get(row.user_id) ?? "Team member" });
    assigneesByJob.set(row.job_id, list);
  }

  const jobs = [...rowsById.values()].map((row) => mapJob(row, assigneesByJob.get(row.id) ?? []));
  const timeOff: LiveTimeOff[] = (
    (timeOffRes.data ?? []) as Array<{ user_id: string; starts_at: string; ends_at: string }>
  ).map((row) => ({ userId: row.user_id, startsAt: row.starts_at, endsAt: row.ends_at }));

  // The activation table is optional context; ignore its errors.
  const activation = activationRes.error
    ? null
    : (activationRes.data as { status: string; started_at: string | null } | null);

  return {
    date,
    now: now.toISOString(),
    jobs,
    activity,
    notes,
    timeOff,
    people,
    dayStartedAt: activation?.status === "active" ? activation.started_at : null,
  };
}

interface ActivityRow {
  id: string;
  job_id: string;
  type: string;
  title: string;
  created_at: string;
  actor_id: string | null;
}

export async function getLiveOpsSnapshot(now = new Date()): Promise<LiveOpsSnapshot> {
  return buildLiveOpsSnapshot(await loadLiveOpsInput(now));
}
