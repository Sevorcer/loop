import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  DbHealthCheckRun,
  DbHealthCheckRunDetail,
  DbHealthCheckResult,
  OverallStatus,
  RunTrigger,
  CheckStatus,
  CheckSeverity,
} from "@/features/admin/db-health/types";

// ---------------------------------------------------------------------------
// Row types (DB → TS mapping)
// ---------------------------------------------------------------------------

interface RunRow {
  id: string;
  run_at: string;
  trigger: RunTrigger;
  overall_status: OverallStatus;
  check_count: number;
  pass_count: number;
  fail_count: number;
  duration_ms: number | null;
  ci_run_url: string | null;
  git_sha: string | null;
  created_at: string;
}

interface ResultRow {
  id: string;
  run_id: string;
  check_name: string;
  check_category: string;
  status: CheckStatus;
  severity: CheckSeverity;
  owner: string;
  message: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapRun(row: RunRow): DbHealthCheckRun {
  return {
    id: row.id,
    runAt: row.run_at,
    trigger: row.trigger,
    overallStatus: row.overall_status,
    checkCount: row.check_count,
    passCount: row.pass_count,
    failCount: row.fail_count,
    durationMs: row.duration_ms,
    ciRunUrl: row.ci_run_url,
    gitSha: row.git_sha,
    createdAt: row.created_at,
  };
}

function mapResult(row: ResultRow): DbHealthCheckResult {
  return {
    id: row.id,
    runId: row.run_id,
    checkName: row.check_name,
    checkCategory: row.check_category,
    status: row.status,
    severity: row.severity,
    owner: row.owner,
    message: row.message,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Returns the most recent health check runs, newest first. */
export async function listDbHealthRuns(limit = 14): Promise<DbHealthCheckRun[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createSupabaseAdminClient() as any;

  const { data, error } = await client
    .from("db_health_check_runs")
    .select(
      "id, run_at, trigger, overall_status, check_count, pass_count, fail_count, duration_ms, ci_run_url, git_sha, created_at",
    )
    .order("run_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list DB health runs: ${error.message}`);
  }

  return (data ?? []).map((row: RunRow) => mapRun(row));
}

/** Returns a single run with its full check results, or null if not found. */
export async function getDbHealthRun(runId: string): Promise<DbHealthCheckRunDetail | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createSupabaseAdminClient() as any;

  const { data: runData, error: runError } = await client
    .from("db_health_check_runs")
    .select(
      "id, run_at, trigger, overall_status, check_count, pass_count, fail_count, duration_ms, ci_run_url, git_sha, created_at",
    )
    .eq("id", runId)
    .maybeSingle();

  if (runError) {
    throw new Error(`Failed to get DB health run: ${runError.message}`);
  }
  if (!runData) return null;

  const { data: resultsData, error: resultsError } = await client
    .from("db_health_check_results")
    .select(
      "id, run_id, check_name, check_category, status, severity, owner, message, created_at",
    )
    .eq("run_id", runId)
    .order("check_category")
    .order("check_name");

  if (resultsError) {
    throw new Error(`Failed to get DB health results: ${resultsError.message}`);
  }

  return {
    ...mapRun(runData as RunRow),
    results: (resultsData ?? []).map((row: ResultRow) => mapResult(row)),
  };
}

// ---------------------------------------------------------------------------
// Writes (used by the /api/admin/db-health/check route only)
// ---------------------------------------------------------------------------

export interface InsertRunInput {
  trigger: RunTrigger;
  ciRunUrl?: string | null;
  gitSha?: string | null;
}

export interface InsertResultInput {
  runId: string;
  checkName: string;
  checkCategory: string;
  status: CheckStatus;
  severity: CheckSeverity;
  owner: string;
  message?: string | null;
}

export async function insertDbHealthRun(input: InsertRunInput): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createSupabaseAdminClient() as any;

  const { data, error } = await client
    .from("db_health_check_runs")
    .insert({
      trigger: input.trigger,
      overall_status: "unknown",
      check_count: 0,
      pass_count: 0,
      fail_count: 0,
      ci_run_url: input.ciRunUrl ?? null,
      git_sha: input.gitSha ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create DB health run: ${error?.message ?? "no data"}`);
  }

  return (data as { id: string }).id;
}

export async function insertDbHealthResults(inputs: InsertResultInput[]): Promise<void> {
  if (inputs.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createSupabaseAdminClient() as any;

  const rows = inputs.map((r) => ({
    run_id: r.runId,
    check_name: r.checkName,
    check_category: r.checkCategory,
    status: r.status,
    severity: r.severity,
    owner: r.owner,
    message: r.message ?? null,
  }));

  const { error } = await client.from("db_health_check_results").insert(rows);

  if (error) {
    throw new Error(`Failed to insert DB health results: ${error.message}`);
  }
}

export interface UpdateRunSummaryInput {
  runId: string;
  overallStatus: OverallStatus;
  checkCount: number;
  passCount: number;
  failCount: number;
  durationMs: number;
}

export async function updateDbHealthRunSummary(input: UpdateRunSummaryInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = createSupabaseAdminClient() as any;

  const { error } = await client
    .from("db_health_check_runs")
    .update({
      overall_status: input.overallStatus,
      check_count: input.checkCount,
      pass_count: input.passCount,
      fail_count: input.failCount,
      duration_ms: input.durationMs,
    })
    .eq("id", input.runId);

  if (error) {
    throw new Error(`Failed to update DB health run summary: ${error.message}`);
  }
}
