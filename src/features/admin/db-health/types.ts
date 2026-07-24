/**
 * DB health check types — Sprint 28.
 *
 * Mirror of the db_health_check_runs / db_health_check_results tables.
 * Used by the dashboard screen and the API layer.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type CheckStatus = "pass" | "fail" | "skip";
export type CheckSeverity = "critical" | "warning" | "info";
export type RunTrigger = "scheduled" | "manual" | "pre_deploy";
export type OverallStatus = "pass" | "fail" | "partial" | "unknown";

export interface DbHealthCheckResult {
  id: string;
  runId: string;
  checkName: string;
  checkCategory: string;
  status: CheckStatus;
  severity: CheckSeverity;
  owner: string;
  message: string | null;
  createdAt: string;
}

export interface DbHealthCheckRun {
  id: string;
  runAt: string;
  trigger: RunTrigger;
  overallStatus: OverallStatus;
  checkCount: number;
  passCount: number;
  failCount: number;
  durationMs: number | null;
  ciRunUrl: string | null;
  gitSha: string | null;
  createdAt: string;
}

export interface DbHealthCheckRunDetail extends DbHealthCheckRun {
  results: DbHealthCheckResult[];
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface ListRunsResponse {
  runs: DbHealthCheckRun[];
}

export interface GetRunResponse {
  run: DbHealthCheckRunDetail;
}

export interface TriggerCheckResponse {
  runId: string;
  overallStatus: OverallStatus;
  checkCount: number;
  passCount: number;
  failCount: number;
  durationMs: number;
  results: Array<{
    checkName: string;
    checkCategory: string;
    status: CheckStatus;
    severity: CheckSeverity;
    message: string | null;
  }>;
}
