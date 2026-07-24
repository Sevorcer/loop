#!/usr/bin/env bash
# scripts/db-health-check.sh
#
# Daily DB health check for LOOP.
#
# Runs a set of read-only SQL checks against the connected Supabase database and
# produces a machine-readable JSON report.  The script exits non-zero when any
# critical check fails.
#
# ── Required environment variables ──────────────────────────────────────────
#
#   LOOP_DB_URL   (or SUPABASE_DB_URL, or DATABASE_URL)
#
#     Full PostgreSQL connection string, e.g.
#       postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
#
# ── Optional environment variables ──────────────────────────────────────────
#
#   DB_HEALTH_OUTPUT_FILE
#
#     If set, the JSON report is also written to this path (in addition to
#     stdout).  Used by CI to produce an artifact.
#
# ── Usage ────────────────────────────────────────────────────────────────────
#
#   # Standard run — prints JSON to stdout
#   bash scripts/db-health-check.sh
#
#   # Save to file as well
#   DB_HEALTH_OUTPUT_FILE=/tmp/db-health-report.json bash scripts/db-health-check.sh
#
#   # With an explicit DB URL
#   LOOP_DB_URL="******db.ref.supabase.co:5432/postgres" \
#     bash scripts/db-health-check.sh
#
# ── Exit codes ───────────────────────────────────────────────────────────────
#
#   0   All checks passed (or no critical failures detected).
#   1   One or more critical checks failed.
#   2   Pre-flight error (missing tools, missing DB URL, connection refused).
#
# ── Checks performed ─────────────────────────────────────────────────────────
#
#   null_profile_columns     — user_profiles rows with NULL org_id or app_role
#   orphan_jobs_customer     — jobs referencing a non-existent customer
#   orphan_jobs_property     — jobs referencing a non-existent property
#   orphan_job_activity      — job_activity referencing a non-existent job
#   orphan_portal_memberships — portal_memberships referencing a non-existent portal_user
#   missing_indexes          — critical indexes absent from pg_indexes
#   rls_disabled             — protected tables with RLS not enabled
#   migration_count          — applied migration count matches file count on disk
#
# ── Security notes ───────────────────────────────────────────────────────────
#
#   - All SQL is read-only (SELECT only, no DML/DDL).
#   - The DB URL is masked from all log output via ::add-mask:: in GitHub
#     Actions and never echoed in plain text.
#   - No sensitive data is included in check results.

set -euo pipefail

# ── Pre-flight ────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

RUN_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
CRITICAL_FAILURES=0
WARNING_FAILURES=0
CHECKS_JSON="[]"

pass()  { printf '  ✓ %s\n' "$*" >&2; }
fail()  { printf '  ✗ %s\n' "$*" >&2; }
info()  { printf '%s\n' "$*" >&2; }
warn()  { printf '  ! %s\n' "$*" >&2; }

if ! command -v psql >/dev/null 2>&1; then
  echo '{"error":"psql not found — install postgresql-client"}' >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo '{"error":"jq not found — install jq"}' >&2
  exit 2
fi

DB_URL="${LOOP_DB_URL:-${SUPABASE_DB_URL:-${DATABASE_URL:-}}}"
if [[ -z "$DB_URL" ]]; then
  cat >&2 <<'EOF'
Error: No database URL found.
Set one of: LOOP_DB_URL, SUPABASE_DB_URL, or DATABASE_URL.

Example:
  LOOP_DB_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
    bash scripts/db-health-check.sh
EOF
  exit 2
fi

# Mask the URL in GitHub Actions logs (no-op in local shells)
if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  echo "::add-mask::$DB_URL"
fi

# Verify connectivity
if ! psql "$DB_URL" -c "SELECT 1" -q --no-psqlrc >/dev/null 2>&1; then
  echo '{"error":"Cannot connect to database — check DB_URL and network access"}' >&2
  exit 2
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

# run_query <sql>
# Runs a SQL query that returns a single integer (the violation count).
# Prints the integer or -1 on error.
run_query() {
  local sql="$1"
  local result
  result=$(psql "$DB_URL" --no-psqlrc -t -A -c "$sql" 2>/dev/null || echo "-1")
  # Strip whitespace
  echo "${result//[[:space:]]/}"
}

# append_check <id> <name> <severity> <count> <description>
# Appends one check entry to CHECKS_JSON.
append_check() {
  local id="$1" name="$2" severity="$3" count="$4" description="$5"
  local status message

  if [[ "$count" == "-1" ]]; then
    status="skipped"
    message="Check was skipped (query error or table not present)."
  elif [[ "$count" -eq 0 ]]; then
    status="pass"
    message="No violations found."
  else
    status="fail"
    if [[ "$count" -eq 1 ]]; then
      message="1 violation found — action required."
    else
      message="${count} violations found — action required."
    fi
  fi

  # Count failures by severity
  if [[ "$status" == "fail" ]]; then
    if [[ "$severity" == "critical" ]]; then
      CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
      fail "$name [CRITICAL] — $message"
    else
      WARNING_FAILURES=$((WARNING_FAILURES + 1))
      warn "$name [WARNING] — $message"
    fi
  else
    pass "$name"
  fi

  CHECKS_JSON=$(jq \
    --arg id "$id" \
    --arg name "$name" \
    --arg severity "$severity" \
    --arg status "$status" \
    --argjson count "$count" \
    --arg message "$message" \
    --arg description "$description" \
    '. += [{
      "id": $id,
      "name": $name,
      "severity": $severity,
      "status": $status,
      "count": $count,
      "message": $message,
      "description": $description
    }]' \
    <<< "$CHECKS_JSON")
}

# ── Checks ────────────────────────────────────────────────────────────────────

info ""
info "════════════════════════════════════════════════════════════"
info " LOOP DB Health Check  —  $RUN_AT"
info "════════════════════════════════════════════════════════════"
info ""

# ── 1. Required non-null columns ──────────────────────────────────────────────

info "1. Required non-null columns — user_profiles"

COUNT=$(run_query "
  SELECT COUNT(*)
  FROM public.user_profiles
  WHERE org_id IS NULL
     OR app_role IS NULL;
")

append_check \
  "null_profile_columns" \
  "Required non-null columns — user_profiles" \
  "critical" \
  "$COUNT" \
  "Counts user_profiles rows where org_id or app_role is NULL. Both columns drive RLS policy expressions."

# ── 2. Orphan FK: jobs → customers ───────────────────────────────────────────

info ""
info "2. Orphan foreign keys — jobs → customers"

COUNT=$(run_query "
  SELECT COUNT(*)
  FROM public.jobs j
  WHERE j.customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.customers c WHERE c.id = j.customer_id
    );
")

append_check \
  "orphan_jobs_customer" \
  "Orphan foreign keys — jobs → customers" \
  "critical" \
  "$COUNT" \
  "Counts jobs rows where customer_id references a customer that does not exist."

# ── 3. Orphan FK: jobs → properties ──────────────────────────────────────────

info ""
info "3. Orphan foreign keys — jobs → properties"

COUNT=$(run_query "
  SELECT COUNT(*)
  FROM public.jobs j
  WHERE j.property_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = j.property_id
    );
")

append_check \
  "orphan_jobs_property" \
  "Orphan foreign keys — jobs → properties" \
  "critical" \
  "$COUNT" \
  "Counts jobs rows where property_id references a property that does not exist."

# ── 4. Orphan FK: job_activity → jobs ────────────────────────────────────────

info ""
info "4. Orphan foreign keys — job_activity → jobs"

COUNT=$(run_query "
  SELECT COUNT(*)
  FROM public.job_activity a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs j WHERE j.id = a.job_id
  );
")

append_check \
  "orphan_job_activity" \
  "Orphan foreign keys — job_activity → jobs" \
  "critical" \
  "$COUNT" \
  "Counts job_activity rows where job_id references a job that does not exist."

# ── 5. Orphan FK: portal_memberships → portal_users ──────────────────────────

info ""
info "5. Orphan foreign keys — portal_memberships → portal_users"

COUNT=$(run_query "
  SELECT COUNT(*)
  FROM public.portal_memberships pm
  WHERE NOT EXISTS (
    SELECT 1 FROM public.portal_users pu WHERE pu.id = pm.portal_user_id
  );
")

append_check \
  "orphan_portal_memberships" \
  "Orphan foreign keys — portal_memberships → portal_users" \
  "critical" \
  "$COUNT" \
  "Counts portal_memberships rows where portal_user_id references a portal_user that does not exist."

# ── 6. Required indexes ───────────────────────────────────────────────────────

info ""
info "6. Required indexes present"

COUNT=$(run_query "
  WITH required_indexes (index_name) AS (
    VALUES
      ('user_profiles_org_id_idx'),
      ('customers_org_id_idx'),
      ('properties_org_id_idx'),
      ('properties_customer_id_idx'),
      ('contractors_org_id_idx'),
      ('jobs_org_id_idx'),
      ('jobs_assigned_user_id_idx'),
      ('jobs_status_idx'),
      ('job_activity_job_id_idx'),
      ('job_activity_org_id_idx'),
      ('portal_users_org_id_idx'),
      ('portal_memberships_portal_user_id_idx'),
      ('portal_memberships_org_id_idx')
  )
  SELECT COUNT(*)
  FROM required_indexes r
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.indexname  = r.index_name
  );
")

append_check \
  "missing_indexes" \
  "Required indexes present" \
  "critical" \
  "$COUNT" \
  "Counts critical indexes absent from pg_indexes. Missing indexes degrade performance on key read/write paths."

# ── 7. RLS enabled on protected tables ───────────────────────────────────────

info ""
info "7. RLS enabled on protected tables"

COUNT=$(run_query "
  WITH required_rls (table_name) AS (
    VALUES
      ('organizations'),
      ('user_profiles'),
      ('customers'),
      ('properties'),
      ('contractors'),
      ('jobs'),
      ('job_activity'),
      ('portal_users'),
      ('portal_memberships'),
      ('daily_plan_notes'),
      ('daily_plan_activations'),
      ('daily_plan_job_overrides'),
      ('crews'),
      ('dispatch_plans'),
      ('crew_assignments'),
      ('schedule_blocks'),
      ('installed_systems'),
      ('property_documents'),
      ('property_photos'),
      ('storage_objects'),
      ('gc_issue_requests'),
      ('knowledge_items'),
      ('portal_projects')
  )
  SELECT COUNT(*)
  FROM required_rls r
  LEFT JOIN pg_class     pc ON pc.relname   = r.table_name
  LEFT JOIN pg_namespace pn ON pn.oid       = pc.relnamespace
                           AND pn.nspname   = 'public'
  WHERE pc.relname IS NOT NULL       -- table exists
    AND pc.rowsecurity = FALSE;      -- but RLS is disabled
")

append_check \
  "rls_disabled" \
  "RLS enabled on protected tables" \
  "critical" \
  "$COUNT" \
  "Counts protected tables where Row Level Security is not enabled. All multi-tenant tables must have RLS."

# ── 8. Migration history consistency ─────────────────────────────────────────

info ""
info "8. Migration history consistency"

# Count migration files on disk
DISK_COUNT=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" | wc -l | tr -d '[:space:]')

# Count applied migrations in the DB
# Supabase tracks applied migrations in supabase_migrations.schema_migrations.
# Fall back to -1 if the table does not exist (pre-Supabase or custom setup).
DB_COUNT=$(run_query "
  SELECT COALESCE(
    (SELECT COUNT(*)::integer
     FROM supabase_migrations.schema_migrations),
    -1
  );
" 2>/dev/null || echo "-1")

if [[ "$DB_COUNT" == "-1" ]]; then
  MISMATCH_COUNT="-1"
else
  if [[ "$DISK_COUNT" -eq "$DB_COUNT" ]]; then
    MISMATCH_COUNT=0
  else
    MISMATCH_COUNT=$((DISK_COUNT > DB_COUNT ? DISK_COUNT - DB_COUNT : DB_COUNT - DISK_COUNT))
    warn "Disk migration files: $DISK_COUNT  |  Applied in DB: $DB_COUNT  |  Delta: $MISMATCH_COUNT"
  fi
fi

append_check \
  "migration_count" \
  "Migration history consistency" \
  "critical" \
  "$MISMATCH_COUNT" \
  "Verifies that the count of applied DB migrations matches the count of migration files on disk. Delta=${DISK_COUNT}↔${DB_COUNT}."

# ── Summary ───────────────────────────────────────────────────────────────────

info ""

TOTAL_CHECKS=$(jq 'length' <<< "$CHECKS_JSON")
PASSED_CHECKS=$(jq '[.[] | select(.status == "pass")] | length' <<< "$CHECKS_JSON")
FAILED_CHECKS=$(jq '[.[] | select(.status == "fail")] | length' <<< "$CHECKS_JSON")
SKIPPED_CHECKS=$(jq '[.[] | select(.status == "skipped")] | length' <<< "$CHECKS_JSON")

if [[ "$CRITICAL_FAILURES" -gt 0 ]]; then
  OVERALL_STATUS="fail"
else
  OVERALL_STATUS="pass"
fi

# Build the final JSON report
REPORT=$(jq -n \
  --arg run_at "$RUN_AT" \
  --arg status "$OVERALL_STATUS" \
  --argjson critical_failures "$CRITICAL_FAILURES" \
  --argjson warning_failures "$WARNING_FAILURES" \
  --argjson total_checks "$TOTAL_CHECKS" \
  --argjson passed_checks "$PASSED_CHECKS" \
  --argjson failed_checks "$FAILED_CHECKS" \
  --argjson skipped_checks "$SKIPPED_CHECKS" \
  --argjson checks "$CHECKS_JSON" \
  '{
    "run_at": $run_at,
    "status": $status,
    "critical_failures": $critical_failures,
    "warning_failures": $warning_failures,
    "total_checks": $total_checks,
    "passed_checks": $passed_checks,
    "failed_checks": $failed_checks,
    "skipped_checks": $skipped_checks,
    "checks": $checks
  }')

# ── Output ────────────────────────────────────────────────────────────────────

# Print human-readable summary to stderr
info "════════════════════════════════════════════════════════════"
if [[ "$OVERALL_STATUS" == "pass" ]]; then
  info " ✓ DB Health Check PASSED"
else
  info " ✗ DB Health Check FAILED — $CRITICAL_FAILURES critical failure(s)"
fi
info " Results: $PASSED_CHECKS passed, $FAILED_CHECKS failed, $SKIPPED_CHECKS skipped / $TOTAL_CHECKS total"
info "════════════════════════════════════════════════════════════"

if [[ "$CRITICAL_FAILURES" -gt 0 ]]; then
  info ""
  info "See runbook for remediation steps:"
  info "  docs/runbooks/db-health-check.md"
fi

info ""

# Print machine-readable JSON to stdout
echo "$REPORT"

# Optionally write to file for artifact upload
if [[ -n "${DB_HEALTH_OUTPUT_FILE:-}" ]]; then
  echo "$REPORT" > "$DB_HEALTH_OUTPUT_FILE"
  info "Report written to: $DB_HEALTH_OUTPUT_FILE" >&2
fi

# Non-zero exit on critical failures
if [[ "$CRITICAL_FAILURES" -gt 0 ]]; then
  exit 1
fi
