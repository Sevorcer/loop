import "server-only";

import type {
  ProductionCompletion,
  ProductionSourceJob,
} from "@/features/reporting/utils/productionReport";

import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

const PAGE_SIZE = 1000;

interface JobRow {
  id: string;
  job_number: string;
  status: string;
  title: string;
  customer_name: string;
  assigned_to: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  updated_at: string;
}

function missingRelation(error: { code?: string; message?: string }, name: string): boolean {
  const message = error.message ?? "";
  return error.code === "42P01" || error.code === "PGRST205" || message.includes(name);
}

async function eachPage<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 50; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await load(from, to);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function listProductionSources(
  includeRevenue: boolean,
  contextInput?: SessionRepositoryContextInput,
): Promise<{ jobs: ProductionSourceJob[]; completions: ProductionCompletion[] }> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  const jobRows = await eachPage<JobRow>((from, to) =>
    supabase
      .from("jobs")
      .select(
        "id,job_number,status,title,customer_name,assigned_to,scheduled_start_at,scheduled_end_at,updated_at",
      )
      .eq("org_id", orgId)
      .eq("status", "Completed")
      .order("id", { ascending: true })
      .range(from, to),
  );

  const completionRows = await eachPage<{ job_id: string; created_at: string }>((from, to) =>
    supabase
      .from("job_activity")
      .select("job_id,created_at")
      .eq("org_id", orgId)
      .eq("type", "status")
      .eq("title", "Job completed")
      .order("created_at", { ascending: true })
      .range(from, to),
  );
  const completions: ProductionCompletion[] = completionRows.map((row) => ({
    jobId: row.job_id,
    createdAt: row.created_at,
  }));

  const jobIds = jobRows.map((row) => row.id);
  const [assignees, completionTeams, estimates, revenue] = await Promise.all([
    readAssignees(supabase, orgId, jobIds),
    readCompletionTeams(supabase, orgId, jobIds),
    readEstimates(supabase, orgId, jobIds),
    includeRevenue ? readRevenue(supabase, orgId, jobIds) : Promise.resolve(new Map<string, number | null>()),
  ]);

  const jobs: ProductionSourceJob[] = jobRows.map((row) => ({
    id: row.id,
    jobNumber: row.job_number ?? "",
    status: row.status,
    title: row.title ?? "",
    customerName: row.customer_name ?? "",
    assignedTo: row.assigned_to ?? "",
    assignees: assignees.get(row.id) ?? [],
    completionTeam: completionTeams.get(row.id) ?? [],
    scheduledStartAt: row.scheduled_start_at,
    scheduledEndAt: row.scheduled_end_at,
    estimatedDurationHours: estimates.get(row.id) ?? null,
    revenueCents: includeRevenue ? (revenue.get(row.id) ?? null) : null,
    updatedAt: row.updated_at ?? "",
  }));

  return { jobs, completions };
}

type Client = Awaited<ReturnType<typeof getRepositoryContext>>["supabase"];

async function readAssignees(
  supabase: Client,
  orgId: string,
  jobIds: string[],
): Promise<Map<string, { id: string | null; name: string }[]>> {
  const byJob = new Map<string, { id: string | null; name: string }[]>();
  if (jobIds.length === 0) return byJob;
  const { data, error } = await supabase
    .from("job_assignees")
    .select("job_id,user_id")
    .eq("org_id", orgId)
    .in("job_id", jobIds);
  if (error) {
    if (missingRelation(error, "job_assignees")) return byJob;
    throw new Error(error.message);
  }
  const rows = (data ?? []) as Array<{ job_id: string; user_id: string }>;
  const names = await profileNames(supabase, orgId, rows.map((row) => row.user_id));
  for (const row of rows) {
    const list = byJob.get(row.job_id) ?? [];
    list.push({ id: row.user_id, name: names.get(row.user_id) ?? "Team member" });
    byJob.set(row.job_id, list);
  }
  return byJob;
}

async function readCompletionTeams(
  supabase: Client,
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
    if (missingRelation(error, "job_completion_team")) return byJob;
    throw new Error(error.message);
  }
  for (const row of (data ?? []) as Array<{ job_id: string; user_id: string | null; person_name: string }>) {
    const list = byJob.get(row.job_id) ?? [];
    list.push({ id: row.user_id, name: row.person_name });
    byJob.set(row.job_id, list);
  }
  return byJob;
}

async function readEstimates(
  supabase: Client,
  orgId: string,
  jobIds: string[],
): Promise<Map<string, number>> {
  const hours = new Map<string, number>();
  if (jobIds.length === 0) return hours;
  const { data, error } = await supabase
    .from("dispatch_plans")
    .select("job_id,estimated_duration_hours")
    .eq("org_id", orgId)
    .in("job_id", jobIds);
  if (error) {
    if (missingRelation(error, "dispatch_plans")) return hours;
    throw new Error(error.message);
  }
  for (const row of (data ?? []) as Array<{ job_id: string | null; estimated_duration_hours: number | string | null }>) {
    if (!row.job_id) continue;
    const value = typeof row.estimated_duration_hours === "number"
      ? row.estimated_duration_hours
      : Number(row.estimated_duration_hours);
    if (!Number.isFinite(value) || value <= 0) continue;
    const previous = hours.get(row.job_id) ?? 0;
    if (value > previous) hours.set(row.job_id, value);
  }
  return hours;
}

async function readRevenue(
  supabase: Client,
  orgId: string,
  jobIds: string[],
): Promise<Map<string, number | null>> {
  const amounts = new Map<string, number | null>();
  if (jobIds.length === 0) return amounts;
  const { data, error } = await supabase
    .from("job_financials")
    .select("job_id,revenue_cents")
    .eq("org_id", orgId)
    .in("job_id", jobIds);
  if (error) {
    if (missingRelation(error, "job_financials")) return amounts;
    throw new Error(error.message);
  }
  for (const row of (data ?? []) as Array<{ job_id: string; revenue_cents: number | string | null }>) {
    if (row.revenue_cents == null) {
      amounts.set(row.job_id, null);
      continue;
    }
    const cents = typeof row.revenue_cents === "number" ? row.revenue_cents : Number(row.revenue_cents);
    amounts.set(row.job_id, Number.isFinite(cents) ? cents : null);
  }
  return amounts;
}

async function profileNames(
  supabase: Client,
  orgId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return names;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,full_name,email")
    .eq("org_id", orgId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
    names.set(row.id, (row.full_name ?? "").trim() || (row.email ?? "").trim() || "Team member");
  }
  return names;
}
