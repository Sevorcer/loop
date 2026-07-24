import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logDbHealthAlert, logDbHealthRunSummary } from "@/lib/observability/dbHealth";
import {
  listDbHealthRuns,
  getDbHealthRun,
  insertDbHealthRun,
  insertDbHealthResults,
  updateDbHealthRunSummary,
} from "@/repositories/dbHealth";
import type {
  DbHealthCheckRun,
  DbHealthCheckRunDetail,
  TriggerCheckResponse,
  RunTrigger,
  CheckStatus,
  CheckSeverity,
  OverallStatus,
} from "@/features/admin/db-health/types";

export type { DbHealthCheckRun, DbHealthCheckRunDetail };

// ---------------------------------------------------------------------------
// Read operations (used by the dashboard)
// ---------------------------------------------------------------------------

/** List recent DB health check runs, newest first. */
export async function listHealthRuns(limit = 14): Promise<DbHealthCheckRun[]> {
  return listDbHealthRuns(limit);
}

/** Get a single run with all check results. Returns null if not found. */
export async function getHealthRun(runId: string): Promise<DbHealthCheckRunDetail | null> {
  return getDbHealthRun(runId);
}

// ---------------------------------------------------------------------------
// Individual check runners
// ---------------------------------------------------------------------------

interface CheckResult {
  checkName: string;
  checkCategory: string;
  status: CheckStatus;
  severity: CheckSeverity;
  owner: string;
  message: string | null;
}

async function runNullOrgIdChecks(client: ReturnType<typeof createSupabaseAdminClient>): Promise<CheckResult[]> {
  const { data, error } = await client.rpc("dbhc_null_org_id");

  if (error) {
    return [
      {
        checkName: "null_org_id_check",
        checkCategory: "schema",
        status: "fail",
        severity: "critical",
        owner: "on-call",
        message: `RPC call failed: ${error.message}`,
      },
    ];
  }

  return ((data as Array<{ table_name: string; null_count: number }>) ?? []).map((row) => ({
    checkName: `${row.table_name}_org_id_not_null`,
    checkCategory: "schema",
    status: row.null_count === 0 ? "pass" : "fail",
    severity: "critical" as CheckSeverity,
    owner: "on-call",
    message:
      row.null_count === 0
        ? null
        : `${row.null_count} row(s) with null org_id in table '${row.table_name}'`,
  }));
}

async function runOrphanFkChecks(client: ReturnType<typeof createSupabaseAdminClient>): Promise<CheckResult[]> {
  const { data, error } = await client.rpc("dbhc_orphan_fk");

  if (error) {
    return [
      {
        checkName: "orphan_fk_check",
        checkCategory: "integrity",
        status: "fail",
        severity: "warning",
        owner: "platform-team",
        message: `RPC call failed: ${error.message}`,
      },
    ];
  }

  return ((data as Array<{ relationship: string; orphan_count: number }>) ?? []).map((row) => ({
    checkName: `orphan_fk_${row.relationship.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`,
    checkCategory: "integrity",
    status: row.orphan_count === 0 ? "pass" : "fail",
    severity: "warning" as CheckSeverity,
    owner: "platform-team",
    message:
      row.orphan_count === 0
        ? null
        : `${row.orphan_count} orphan row(s) for relationship: ${row.relationship}`,
  }));
}

async function runIndexChecks(client: ReturnType<typeof createSupabaseAdminClient>): Promise<CheckResult[]> {
  const { data, error } = await client.rpc("dbhc_required_indexes");

  if (error) {
    return [
      {
        checkName: "index_check",
        checkCategory: "indexes",
        status: "fail",
        severity: "warning",
        owner: "platform-team",
        message: `RPC call failed: ${error.message}`,
      },
    ];
  }

  return ((data as Array<{ index_name: string; index_exists: boolean }>) ?? []).map((row) => ({
    checkName: `index_present_${row.index_name}`,
    checkCategory: "indexes",
    status: row.index_exists ? "pass" : "fail",
    severity: "warning" as CheckSeverity,
    owner: "platform-team",
    message: row.index_exists ? null : `Required index '${row.index_name}' is missing`,
  }));
}

async function runRlsChecks(client: ReturnType<typeof createSupabaseAdminClient>): Promise<CheckResult[]> {
  const { data, error } = await client.rpc("dbhc_rls_coverage");

  if (error) {
    return [
      {
        checkName: "rls_check",
        checkCategory: "rls",
        status: "fail",
        severity: "critical",
        owner: "on-call",
        message: `RPC call failed: ${error.message}`,
      },
    ];
  }

  return ((data as Array<{ table_name: string; rls_enabled: boolean }>) ?? []).map((row) => ({
    checkName: `rls_enabled_${row.table_name}`,
    checkCategory: "rls",
    status: row.rls_enabled ? "pass" : "fail",
    severity: "critical" as CheckSeverity,
    owner: "on-call",
    message: row.rls_enabled ? null : `RLS is NOT enabled on table '${row.table_name}'`,
  }));
}

async function runMigrationChecks(
  client: ReturnType<typeof createSupabaseAdminClient>,
  expectedMigrationCount: number,
): Promise<CheckResult[]> {
  const { data, error } = await client.rpc("dbhc_migration_count");

  if (error) {
    return [
      {
        checkName: "migration_history_consistency",
        checkCategory: "migrations",
        status: "fail",
        severity: "critical",
        owner: "on-call",
        message: `RPC call failed: ${error.message}`,
      },
    ];
  }

  const rows = (data as Array<{ applied_count: number }>) ?? [];
  const appliedCount = rows[0]?.applied_count ?? 0;
  const ok = appliedCount === expectedMigrationCount;

  return [
    {
      checkName: "migration_history_consistency",
      checkCategory: "migrations",
      status: ok ? "pass" : "fail",
      severity: "critical" as CheckSeverity,
      owner: "on-call",
      message: ok
        ? null
        : `Migration count mismatch: DB has ${appliedCount} applied, expected ${expectedMigrationCount}. Run \`supabase migration list\` to diagnose.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Main trigger function
// ---------------------------------------------------------------------------

/**
 * Runs all DB health checks, persists results, emits alert logs.
 *
 * @param trigger  — who/what initiated this run
 * @param ciRunUrl — URL to the CI job (included in alert context links)
 * @param gitSha   — git SHA at time of check
 * @param expectedMigrationCount — how many migrations should be applied
 */
export async function runDbHealthChecks(opts: {
  trigger: RunTrigger;
  ciRunUrl?: string | null;
  gitSha?: string | null;
  expectedMigrationCount?: number;
}): Promise<TriggerCheckResponse> {
  const startedAt = Date.now();
  const client = createSupabaseAdminClient();

  // Create the run record upfront so we have a runId for context links.
  const runId = await insertDbHealthRun({
    trigger: opts.trigger,
    ciRunUrl: opts.ciRunUrl,
    gitSha: opts.gitSha,
  });

  // Run all check categories in parallel.
  // The migration count check uses: explicit caller value → env var → skip (undefined).
  const envMigrationCount = process.env.LOOP_EXPECTED_MIGRATION_COUNT
    ? parseInt(process.env.LOOP_EXPECTED_MIGRATION_COUNT, 10)
    : undefined;
  const migrationCount = opts.expectedMigrationCount ?? envMigrationCount;

  const [nullOrgResults, orphanResults, indexResults, rlsResults, migrationResults] =
    await Promise.all([
      runNullOrgIdChecks(client),
      runOrphanFkChecks(client),
      runIndexChecks(client),
      runRlsChecks(client),
      // Skip migration count check when no expected count is available — avoids
      // false positives when the check is triggered without the CI file count.
      migrationCount !== undefined
        ? runMigrationChecks(client, migrationCount)
        : Promise.resolve<CheckResult[]>([]),
    ]);

  const allResults = [
    ...nullOrgResults,
    ...orphanResults,
    ...indexResults,
    ...rlsResults,
    ...migrationResults,
  ];

  const checkCount = allResults.length;
  const passCount = allResults.filter((r) => r.status === "pass").length;
  const failCount = allResults.filter((r) => r.status === "fail").length;
  const durationMs = Date.now() - startedAt;

  const overallStatus: OverallStatus =
    failCount === 0 ? "pass" : passCount === 0 ? "fail" : "partial";

  // Persist results.
  await insertDbHealthResults(
    allResults.map((r) => ({
      runId,
      ...r,
    })),
  );

  // Update the run summary.
  await updateDbHealthRunSummary({
    runId,
    overallStatus,
    checkCount,
    passCount,
    failCount,
    durationMs,
  });

  // Emit summary log.
  logDbHealthRunSummary({
    runId,
    overallStatus,
    checkCount,
    passCount,
    failCount,
    durationMs,
    ciRunUrl: opts.ciRunUrl,
  });

  // Emit per-failure alert logs.
  for (const result of allResults) {
    if (result.status === "fail") {
      logDbHealthAlert({
        runId,
        checkName: result.checkName,
        checkCategory: result.checkCategory,
        severity: result.severity,
        owner: result.owner,
        message: result.message,
        ciRunUrl: opts.ciRunUrl,
        gitSha: opts.gitSha,
      });
    }
  }

  return {
    runId,
    overallStatus,
    checkCount,
    passCount,
    failCount,
    durationMs,
    results: allResults.map((r) => ({
      checkName: r.checkName,
      checkCategory: r.checkCategory,
      status: r.status,
      severity: r.severity,
      message: r.message,
    })),
  };
}
