/**
 * DB Health Check — types and pure evaluation functions.
 *
 * This module defines the check catalogue and the logic for turning raw
 * query results (violation counts) into structured pass/fail reports.  It
 * contains NO I/O — all DB interaction lives in scripts/db-health-check.sh.
 * Keeping this layer pure makes it fully unit-testable.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = "critical" | "warning";
export type CheckStatus = "pass" | "fail" | "skipped";
export type ReportStatus = "pass" | "fail";

/** Static description of a single health check. */
export interface CheckSpec {
  /** Stable identifier used in JSON output and the shell script. */
  id: string;
  /** Human-readable name shown in summaries. */
  name: string;
  /** critical = blocks pass; warning = noted but does not flip report to fail */
  severity: Severity;
  /** Brief explanation of what is being verified. */
  description: string;
}

/** Raw result fed back from a DB query: violation count or -1 if skipped. */
export interface RawCheckResult {
  checkId: string;
  /** Number of violations found. 0 = no violations = PASS. -1 = check was skipped. */
  count: number;
}

/** Fully evaluated result for one check. */
export interface CheckResult {
  spec: CheckSpec;
  status: CheckStatus;
  count: number;
  message: string;
}

/** Aggregated health report for a single run. */
export interface HealthReport {
  runAt: string;
  status: ReportStatus;
  criticalFailures: number;
  warningFailures: number;
  totalChecks: number;
  passedChecks: number;
  skippedChecks: number;
  checks: CheckResult[];
}

// ---------------------------------------------------------------------------
// Check catalogue
// ---------------------------------------------------------------------------

/**
 * Canonical list of all health checks.
 *
 * The shell script runs one SQL query per check and passes back the violation
 * count.  Adding a new check here requires a matching query in the script.
 */
export const CHECK_SPECS: CheckSpec[] = [
  {
    id: "null_profile_columns",
    name: "Required non-null columns — user_profiles",
    severity: "critical",
    description:
      "Counts user_profiles rows where org_id or app_role is NULL. " +
      "Both columns drive RLS policy expressions and must always be set.",
  },
  {
    id: "orphan_jobs_customer",
    name: "Orphan foreign keys — jobs → customers",
    severity: "critical",
    description:
      "Counts jobs rows where customer_id references a customer that does not exist.",
  },
  {
    id: "orphan_jobs_property",
    name: "Orphan foreign keys — jobs → properties",
    severity: "critical",
    description:
      "Counts jobs rows where property_id references a property that does not exist.",
  },
  {
    id: "orphan_job_activity",
    name: "Orphan foreign keys — job_activity → jobs",
    severity: "critical",
    description:
      "Counts job_activity rows where job_id references a job that does not exist.",
  },
  {
    id: "orphan_portal_memberships",
    name: "Orphan foreign keys — portal_memberships → portal_users",
    severity: "critical",
    description:
      "Counts portal_memberships rows where portal_user_id references a portal_user that does not exist.",
  },
  {
    id: "missing_indexes",
    name: "Required indexes present",
    severity: "critical",
    description:
      "Counts critical indexes that are absent from pg_indexes. " +
      "Missing indexes degrade query performance on key read/write paths.",
  },
  {
    id: "rls_disabled",
    name: "RLS enabled on protected tables",
    severity: "critical",
    description:
      "Counts protected tables where Row Level Security is not enabled. " +
      "Every table that stores multi-tenant data must have RLS enabled.",
  },
  {
    id: "migration_count",
    name: "Migration history consistency",
    severity: "critical",
    description:
      "Verifies that the number of applied migrations in the database matches " +
      "the number of migration files on disk. A mismatch signals unapplied or " +
      "extra migrations.",
  },
];

/** Returns the CheckSpec for a given id, or undefined if not found. */
export function getCheckSpec(id: string): CheckSpec | undefined {
  return CHECK_SPECS.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Evaluation logic
// ---------------------------------------------------------------------------

/**
 * Converts a raw violation count into a CheckResult.
 *
 * @param spec   The check specification.
 * @param count  Violation count returned by the SQL query. -1 = skipped.
 */
export function evaluateCheck(spec: CheckSpec, count: number): CheckResult {
  if (count === -1) {
    return { spec, status: "skipped", count: 0, message: "Check was skipped." };
  }

  if (count === 0) {
    return {
      spec,
      status: "pass",
      count: 0,
      message: `No violations found.`,
    };
  }

  const noun = count === 1 ? "violation" : "violations";
  return {
    spec,
    status: "fail",
    count,
    message: `${count} ${noun} found — action required.`,
  };
}

/**
 * Builds a HealthReport from raw check results.
 *
 * @param rawResults  Array of raw results from the shell script.
 * @param runAt       ISO-8601 timestamp of when the run started.
 */
export function buildHealthReport(
  rawResults: RawCheckResult[],
  runAt: string
): HealthReport {
  const resultMap = new Map<string, number>(
    rawResults.map((r) => [r.checkId, r.count])
  );

  const checks: CheckResult[] = CHECK_SPECS.map((spec) => {
    const count = resultMap.get(spec.id) ?? -1;
    return evaluateCheck(spec, count);
  });

  const criticalFailures = checks.filter(
    (c) => c.status === "fail" && c.spec.severity === "critical"
  ).length;

  const warningFailures = checks.filter(
    (c) => c.status === "fail" && c.spec.severity === "warning"
  ).length;

  const passedChecks = checks.filter((c) => c.status === "pass").length;
  const skippedChecks = checks.filter((c) => c.status === "skipped").length;

  return {
    runAt,
    status: criticalFailures > 0 ? "fail" : "pass",
    criticalFailures,
    warningFailures,
    totalChecks: checks.length,
    passedChecks,
    skippedChecks,
    checks,
  };
}

/**
 * Returns a human-readable text summary of the report.
 * Suitable for printing to a terminal or a CI log section.
 */
export function formatSummary(report: HealthReport): string {
  const lines: string[] = [];
  const statusLabel = report.status === "pass" ? "✓ PASS" : "✗ FAIL";

  lines.push(`DB Health Check — ${statusLabel}`);
  lines.push(`Run at: ${report.runAt}`);
  lines.push(
    `Results: ${report.passedChecks} passed, ` +
      `${report.criticalFailures + report.warningFailures} failed, ` +
      `${report.skippedChecks} skipped / ${report.totalChecks} total`
  );
  lines.push("");

  for (const check of report.checks) {
    const icon =
      check.status === "pass"
        ? "  ✓"
        : check.status === "fail"
          ? "  ✗"
          : "  –";
    const sev =
      check.status === "fail"
        ? ` [${check.spec.severity.toUpperCase()}]`
        : "";
    lines.push(`${icon} ${check.spec.name}${sev}`);
    if (check.status !== "pass") {
      lines.push(`      ${check.message}`);
    }
  }

  if (report.criticalFailures > 0) {
    lines.push("");
    lines.push(
      `${report.criticalFailures} critical failure(s) — see runbook: docs/runbooks/db-health-check.md`
    );
  }

  return lines.join("\n");
}
