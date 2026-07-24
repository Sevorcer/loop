/**
 * DB health observability.
 *
 * Emits structured `[DB_HEALTH_ALERT]` log events for failed health checks,
 * following the same conventions as src/lib/observability/auth.ts.
 *
 * Alert routing by severity:
 *   critical → console.error — triggers on-call via log-based alerting rules
 *   warning  → console.warn  — routes to team channel / queue
 *   info     → console.info  — informational, no alert
 *
 * Deduplication: one alert per (checkName, severity) per cooldown window.
 * Context links included in every alert payload (runId, ciRunUrl, checkName).
 *
 * Log format:
 *   [DB_HEALTH_ALERT] {"category":"db_health","schemaVersion":"1.0",...}
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DbHealthSeverity = "critical" | "warning" | "info";

export interface DbHealthAlertContext {
  /** UUID of the health check run that produced this failure. */
  runId: string;
  /** Name of the individual check that failed (e.g. "jobs_rls_enabled"). */
  checkName: string;
  /** Check category (schema | integrity | indexes | rls | migrations). */
  checkCategory: string;
  /** Severity level driving routing. */
  severity: DbHealthSeverity;
  /** Owner/team responsible for this check. */
  owner: string;
  /** Human-readable failure message — must not include raw DB details. */
  message?: string | null;
  /** URL of the CI run that triggered this check (context link). */
  ciRunUrl?: string | null;
  /** Git SHA at the time of the check run (context link). */
  gitSha?: string | null;
}

// ---------------------------------------------------------------------------
// Internal state (deduplication)
// ---------------------------------------------------------------------------

/** Track when we last fired an alert for each unique checkName+severity key. */
const lastAlertTimestamps = new Map<string, number>();

/** Minimum gap between repeated alerts for the same check+severity (10 min). */
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

function alertKey(checkName: string, severity: DbHealthSeverity): string {
  return `${checkName}::${severity}`;
}

function isDuplicate(checkName: string, severity: DbHealthSeverity, now: number): boolean {
  const key = alertKey(checkName, severity);
  const last = lastAlertTimestamps.get(key) ?? 0;
  return now - last < ALERT_COOLDOWN_MS;
}

function markAlerted(checkName: string, severity: DbHealthSeverity, now: number): void {
  lastAlertTimestamps.set(alertKey(checkName, severity), now);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Emits a structured DB health alert log event.
 *
 * The severity determines both the log level and the routing destination:
 *   - critical → console.error → on-call immediately
 *   - warning  → console.warn  → team channel/queue
 *   - info     → console.info  → no alert
 *
 * Calls within the cooldown window for the same checkName+severity are silently
 * dropped (deduplication). Never throws.
 */
export function logDbHealthAlert(ctx: DbHealthAlertContext, now = Date.now()): void {
  try {
    if (ctx.severity !== "info" && isDuplicate(ctx.checkName, ctx.severity, now)) {
      return;
    }

    const payload = {
      category: "db_health",
      schemaVersion: "1.0",
      timestamp: new Date(now).toISOString(),
      event: "db_health_check_failed",
      severity: ctx.severity,
      owner: ctx.owner,
      runId: ctx.runId,
      checkName: ctx.checkName,
      checkCategory: ctx.checkCategory,
      message: ctx.message ?? null,
      ciRunUrl: ctx.ciRunUrl ?? null,
      gitSha: ctx.gitSha ?? null,
    };

    if (ctx.severity === "critical") {
      console.error("[DB_HEALTH_ALERT]", JSON.stringify(payload));
    } else if (ctx.severity === "warning") {
      console.warn("[DB_HEALTH_ALERT]", JSON.stringify(payload));
    } else {
      console.info("[DB_HEALTH_ALERT]", JSON.stringify(payload));
    }

    if (ctx.severity !== "info") {
      markAlerted(ctx.checkName, ctx.severity, now);
    }
  } catch {
    // Logging must never throw or block the response path.
  }
}

/**
 * Emits a structured summary log for a completed health check run.
 * Always info-level — not an alert, just a run record.
 */
export function logDbHealthRunSummary(ctx: {
  runId: string;
  overallStatus: string;
  checkCount: number;
  passCount: number;
  failCount: number;
  durationMs: number;
  ciRunUrl?: string | null;
}): void {
  try {
    console.info(
      "[DB_HEALTH_RUN]",
      JSON.stringify({
        category: "db_health",
        schemaVersion: "1.0",
        timestamp: new Date().toISOString(),
        event: "db_health_run_complete",
        runId: ctx.runId,
        overallStatus: ctx.overallStatus,
        checkCount: ctx.checkCount,
        passCount: ctx.passCount,
        failCount: ctx.failCount,
        durationMs: ctx.durationMs,
        ciRunUrl: ctx.ciRunUrl ?? null,
      }),
    );
  } catch {
    // Never throws.
  }
}

/**
 * Resets in-memory deduplication state.
 * For use in tests only.
 */
export function resetDbHealthObservabilityStateForTests(): void {
  lastAlertTimestamps.clear();
}
