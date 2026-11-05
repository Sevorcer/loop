import "server-only";

import {
  completedInRangePredicate,
  type DateRange,
  type ProductionCompletion,
  type ProductionSourceJob,
} from "@/features/reporting/utils/productionReport";

import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

const PAGE_SIZE = 1000;
// Keep every id list short enough for the gateway in front of PostgREST: an
// unchunked .in() over ~2,500 job ids builds a ~90 KB request URL that the
// gateway rejects with a 414 before it ever reaches the database. Matches
// the chunk size used in repositories/properties.ts.
const ID_CHUNK_SIZE = 80;
// How many id chunks are read at once per related table. The chunks used to
// be read strictly one after another (~45 sequential round trips per table
// for the full post-import job set); a small fixed pool keeps the request
// count identical but overlaps the waiting.
const CHUNK_CONCURRENCY = 4;

interface QueryError {
  code?: string;
  message?: string;
}

function upstreamError(error: QueryError): Error {
  const message = (error.message ?? "").trim();
  // postgrest-js surfaces a non-JSON upstream body (e.g. a proxy error page)
  // as the error message verbatim. Never let raw markup reach the UI.
  if (!message || message.startsWith("<") || message.includes("<html")) {
    return new Error("Production report query failed.");
  }
  return new Error(message);
}

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
    if (error) throw upstreamError(error);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

// Reads rows for a large id list without ever putting the whole list in one
// request: ids are chunked (see ID_CHUNK_SIZE) and each chunk is paged, so a
// chunk that matches more than PAGE_SIZE rows is read in full instead of
// silently truncating at the PostgREST row cap. The first error stops the
// read and is returned (not thrown) so callers keep their missing-relation
// handling.
async function readByIdsInChunks<Row>(
  ids: string[],
  load: (
    chunk: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: QueryError | null }>,
): Promise<{ rows: Row[]; error: QueryError | null }> {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += ID_CHUNK_SIZE) {
    chunks.push(ids.slice(index, index + ID_CHUNK_SIZE));
  }
  const results: Array<{ rows: Row[]; error: QueryError | null }> = new Array(chunks.length);
  let failed = false;

  async function readChunk(chunk: string[]): Promise<{ rows: Row[]; error: QueryError | null }> {
    const rows: Row[] = [];
    for (let page = 0; page < 50; page += 1) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await load(chunk, from, to);
      if (error) return { rows, error };
      const batch = data ?? [];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
    return { rows, error: null };
  }

  let next = 0;
  async function worker(): Promise<void> {
    while (!failed && next < chunks.length) {
      const index = next;
      next += 1;
      const result = await readChunk(chunks[index]);
      results[index] = result;
      if (result.error) failed = true;
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CHUNK_CONCURRENCY, chunks.length) }, () => worker()),
  );

  // Merge in chunk order so output is deterministic; the first failing chunk
  // (in id order) wins, matching the old sequential behaviour.
  const rows: Row[] = [];
  for (const result of results) {
    if (!result) continue;
    if (result.error) return { rows, error: result.error };
    rows.push(...result.rows);
  }
  return { rows, error: null };
}

/**
 * Optional report window. When given, only jobs whose completion day falls in
 * the range (same rule as computeProductionReport) are enriched with
 * assignees / completion team / estimates / revenue — the report drops every
 * other job anyway, so those reads were pure waste on a short range.
 */
export interface ProductionSourceWindow {
  range: DateRange;
  timeZone: string;
}

export async function listProductionSources(
  includeRevenue: boolean,
  contextInput?: SessionRepositoryContextInput,
  reportWindow?: ProductionSourceWindow,
): Promise<{ jobs: ProductionSourceJob[]; completions: ProductionCompletion[] }> {
  const { supabase, orgId } = await getRepositoryContext(contextInput);

  // The two base reads are independent — run them together.
  const [allJobRows, completionRows] = await Promise.all([
    eachPage<JobRow>((from, to) =>
      supabase
        .from("jobs")
        .select(
          "id,job_number,status,title,customer_name,assigned_to,scheduled_start_at,scheduled_end_at,updated_at",
        )
        .eq("org_id", orgId)
        .eq("status", "Completed")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    eachPage<{ job_id: string; created_at: string }>((from, to) =>
      supabase
        .from("job_activity")
        .select("job_id,created_at")
        .eq("org_id", orgId)
        .eq("type", "status")
        .eq("title", "Job completed")
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
  ]);
  // Keep the instant. The report turns it into the company calendar day.
  const completions: ProductionCompletion[] = completionRows.map((row) => ({
    jobId: row.job_id,
    createdAt: row.created_at,
  }));

  const inWindow = reportWindow
    ? completedInRangePredicate(completions, reportWindow.range, reportWindow.timeZone)
    : null;
  const jobRows = inWindow
    ? allJobRows.filter((row) => inWindow({ id: row.id, updatedAt: row.updated_at ?? "" }))
    : allJobRows;

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
  const { rows, error } = await readByIdsInChunks<{ job_id: string; user_id: string }>(
    jobIds,
    (chunk, from, to) =>
      supabase
        .from("job_assignees")
        .select("job_id,user_id")
        .eq("org_id", orgId)
        .in("job_id", chunk)
        .order("job_id", { ascending: true })
        .order("user_id", { ascending: true })
        .range(from, to),
  );
  if (error) {
    if (missingRelation(error, "job_assignees")) return byJob;
    throw upstreamError(error);
  }
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
  const { rows, error } = await readByIdsInChunks<{
    job_id: string;
    user_id: string | null;
    person_name: string;
  }>(jobIds, (chunk, from, to) =>
    supabase
      .from("job_completion_team")
      .select("job_id,user_id,person_name")
      .eq("org_id", orgId)
      .in("job_id", chunk)
      .order("job_id", { ascending: true })
      .order("person_name", { ascending: true })
      .range(from, to),
  );
  if (error) {
    if (missingRelation(error, "job_completion_team")) return byJob;
    throw upstreamError(error);
  }
  for (const row of rows) {
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
  const { rows, error } = await readByIdsInChunks<{
    job_id: string | null;
    estimated_duration_hours: number | string | null;
  }>(jobIds, (chunk, from, to) =>
    supabase
      .from("dispatch_plans")
      .select("job_id,estimated_duration_hours")
      .eq("org_id", orgId)
      .in("job_id", chunk)
      .order("job_id", { ascending: true })
      .range(from, to),
  );
  if (error) {
    if (missingRelation(error, "dispatch_plans")) return hours;
    throw upstreamError(error);
  }
  for (const row of rows) {
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
  const { rows, error } = await readByIdsInChunks<{
    job_id: string;
    revenue_cents: number | string | null;
  }>(jobIds, (chunk, from, to) =>
    supabase
      .from("job_financials")
      .select("job_id,revenue_cents")
      .eq("org_id", orgId)
      .in("job_id", chunk)
      .order("job_id", { ascending: true })
      .range(from, to),
  );
  if (error) {
    if (missingRelation(error, "job_financials")) return amounts;
    throw upstreamError(error);
  }
  for (const row of rows) {
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
  // One row per id, so chunking alone (no paging) keeps every request small.
  for (let index = 0; index < ids.length; index += ID_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + ID_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,full_name,email")
      .eq("org_id", orgId)
      .in("id", chunk);
    if (error) throw upstreamError(error);
    for (const row of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      names.set(row.id, (row.full_name ?? "").trim() || (row.email ?? "").trim() || "Team member");
    }
  }
  return names;
}
