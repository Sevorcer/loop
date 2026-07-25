#!/usr/bin/env bash
# scripts/db-integrity-check.sh
#
# Standalone relational and security integrity checks for LOOP.
#
# Requires a live database connection.  Complements verify-schema.sql (which
# checks schema structure) with runtime data integrity checks:
#
#   Schema integrity
#     a. Required NOT NULL columns (critical columns may not be nullable)
#     b. Required indexes present
#     c. Required helper SQL functions present
#     d. Required PostgreSQL extensions present
#
#   Relational integrity
#     a. Orphaned foreign key rows (org_id references with no parent)
#     b. Duplicate critical records (unique constraint violations)
#     c. Organization/tenant consistency (rows cross-referencing orgs)
#
#   Security integrity
#     a. RLS enabled on all required tables
#     b. Required RLS policies exist
#
# Usage:
#   DATABASE_URL="postgresql://..." bash scripts/db-integrity-check.sh
#   npm run db:integrity-check
#
# Environment variables:
#   DATABASE_URL — PostgreSQL connection string (required)
#   VERBOSE      — Set to "1" to print every individual check result
#
# Exit codes:
#   0  All checks passed — no integrity violations detected.
#   1  One or more CRITICAL checks failed.
#   2  Pre-flight error (missing DATABASE_URL, psql unavailable, etc.).

set -euo pipefail

SCRIPT_VERSION="1.0"
SCRIPT_NAME="db-integrity-check.sh"
VERBOSE="${VERBOSE:-0}"

# ── helpers ───────────────────────────────────────────────────────────────────

CRITICAL_FAILURES=0
WARNINGS=0

_ts()       { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_header()   { echo ""; echo "════════════════════════════════════════════════════"; echo "  $*"; echo "════════════════════════════════════════════════════"; }
_section()  { echo ""; echo "── $* ──────────────────────────────────────────────"; }
_pass()     { echo "  ✓ $*"; }
_warn()     { echo "  ⚠ $*"; WARNINGS=$((WARNINGS + 1)); }
_critical() { echo "  ✗ [CRITICAL] $*" >&2; CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1)); }
_hint()     { echo "    → $*"; }
_info()     { echo "    $*"; }

# Run a single-value psql query and return the result.
_query() {
  psql "$DATABASE_URL" -t -A -c "$1" 2>/dev/null || echo "ERROR"
}

# Run psql and print output; return exit code.
_run_sql() {
  psql "$DATABASE_URL" -t -A -c "$1" 2>&1
}

# ── pre-flight ────────────────────────────────────────────────────────────────

_header "LOOP DB Integrity Check  v${SCRIPT_VERSION}"
echo "  Script : $SCRIPT_NAME"
echo "  Started: $(_ts)"

if ! command -v psql &>/dev/null; then
  echo "::error::psql not found — install PostgreSQL client tools." >&2
  exit 2
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "::error::DATABASE_URL is not set." >&2
  echo "  Set it to a valid PostgreSQL connection string, e.g.:" >&2
  echo "    export DATABASE_URL=\"postgresql://postgres:[password]@[host]:5432/postgres\"" >&2
  exit 2
fi

# Quick connectivity test.
if ! psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
  echo "::error::Cannot connect to database at DATABASE_URL." >&2
  echo "  Check that the URL is correct and the database is reachable." >&2
  exit 2
fi

_info "Connected to database successfully."

# ── 1. Schema integrity ───────────────────────────────────────────────────────

_section "1a. Required PostgreSQL extensions"

REQUIRED_EXTENSIONS=("uuid-ossp" "pgcrypto")
EXTENSIONS_OK=true
for EXT in "${REQUIRED_EXTENSIONS[@]}"; do
  FOUND=$(_query "SELECT COUNT(*) FROM pg_extension WHERE extname = '$EXT'")
  if [ "$FOUND" = "1" ]; then
    [ "$VERBOSE" = "1" ] && _pass "Extension $EXT is present"
  else
    _critical "Extension $EXT is missing — required by baseline migration"
    _hint "Apply 20260719000001_baseline_core_schema.sql to install it."
    EXTENSIONS_OK=false
  fi
done
[ "$EXTENSIONS_OK" = "true" ] && _pass "All required extensions present"

_section "1b. Required helper functions"

REQUIRED_FUNCTIONS=("current_org_id" "current_app_role")
for FN in "${REQUIRED_FUNCTIONS[@]}"; do
  FOUND=$(_query "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = '$FN'")
  if [ "$FOUND" = "1" ]; then
    [ "$VERBOSE" = "1" ] && _pass "Function $FN() exists"
  else
    _critical "Helper function $FN() is missing — required for RLS enforcement"
    _hint "Apply 20260719000001_baseline_core_schema.sql to create it."
  fi
done

_section "1c. Required NOT NULL columns"

# Verify that critical columns retain their NOT NULL constraint.
NOTNULL_SQL="
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = '%s'
  AND column_name  = '%s'
  AND is_nullable  = 'NO'
"

check_not_null() {
  local table="$1" column="$2"
  local sql
  printf -v sql "$NOTNULL_SQL" "$table" "$column"
  FOUND=$(_query "$sql")
  if [ "$FOUND" = "1" ]; then
    [ "$VERBOSE" = "1" ] && _pass "$table.$column is NOT NULL"
  else
    _critical "$table.$column must be NOT NULL but is nullable or missing"
    _hint "Schema has drifted — verify migration 20260719000001 was applied."
  fi
}

check_not_null "organizations" "id"
check_not_null "organizations" "name"
check_not_null "user_profiles" "org_id"
check_not_null "user_profiles" "app_role"
check_not_null "customers"     "org_id"
check_not_null "properties"    "org_id"
check_not_null "properties"    "customer_id"
check_not_null "jobs"          "org_id"
check_not_null "jobs"          "job_number"
check_not_null "jobs"          "status"
check_not_null "job_activity"  "org_id"
check_not_null "job_activity"  "job_id"
check_not_null "job_activity"  "actor_id"

_section "1d. Required indexes"

check_index() {
  local table="$1" index="$2"
  FOUND=$(_query "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = '$table' AND indexname = '$index'")
  if [ "$FOUND" = "1" ]; then
    [ "$VERBOSE" = "1" ] && _pass "Index $index on $table exists"
  else
    _critical "Index $index is missing on $table"
    _hint "This index may have been dropped out-of-band.  Create a recovery migration."
  fi
}

check_index "customers"          "customers_org_id_idx"
check_index "properties"         "properties_org_id_idx"
check_index "properties"         "properties_customer_id_idx"
check_index "jobs"               "jobs_org_id_idx"
check_index "jobs"               "jobs_status_idx"
check_index "organizations"      "organizations_deleted_at_idx"
check_index "db_health_check_runs" "db_health_check_runs_run_at_idx"

# ── 2. Relational integrity ───────────────────────────────────────────────────

_section "2a. Orphaned foreign key rows"

# Counts rows referencing an org_id that no longer exists in organizations.
orphan_check() {
  local label="$1" sql="$2"
  COUNT=$(_query "$sql")
  if [ "$COUNT" = "0" ] || [ "$COUNT" = "" ]; then
    [ "$VERBOSE" = "1" ] && _pass "$label: no orphans"
  elif [ "$COUNT" = "ERROR" ]; then
    _warn "$label: query failed (table may not exist yet)"
  else
    _critical "$label: $COUNT orphaned row(s) found"
    _hint "Rows reference an org_id that does not exist in organizations."
    _hint "Investigate with: SELECT * FROM $label WHERE org_id NOT IN (SELECT id FROM organizations)"
  fi
}

orphan_check "customers"   "SELECT COUNT(*) FROM customers c WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.org_id)"
orphan_check "properties"  "SELECT COUNT(*) FROM properties p WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = p.org_id)"
orphan_check "jobs"        "SELECT COUNT(*) FROM jobs j WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = j.org_id)"
orphan_check "user_profiles" "SELECT COUNT(*) FROM user_profiles u WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = u.org_id)"

# Check for orphaned property → customer references.
ORPHAN_PROP=$(_query "SELECT COUNT(*) FROM properties p WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = p.customer_id)")
if [ "$ORPHAN_PROP" = "0" ] || [ "$ORPHAN_PROP" = "" ]; then
  [ "$VERBOSE" = "1" ] && _pass "properties.customer_id: no orphans"
else
  _critical "properties.customer_id: $ORPHAN_PROP orphaned row(s) referencing a non-existent customer"
fi

_section "2b. Duplicate critical records"

# job_number must be unique per org.
DUP_JOBS=$(_query "SELECT COUNT(*) FROM (SELECT org_id, job_number, COUNT(*) FROM jobs GROUP BY org_id, job_number HAVING COUNT(*) > 1) t")
if [ "$DUP_JOBS" = "0" ] || [ "$DUP_JOBS" = "" ]; then
  [ "$VERBOSE" = "1" ] && _pass "No duplicate job numbers per org"
else
  _critical "Duplicate job_number detected within the same org ($DUP_JOBS group(s))"
  _hint "This may indicate a constraint was dropped.  Run: SELECT org_id, job_number, COUNT(*) FROM jobs GROUP BY org_id, job_number HAVING COUNT(*) > 1"
fi

# portal_users.auth_uid must be unique per org.
DUP_PORTAL=$(_query "SELECT COUNT(*) FROM (SELECT org_id, auth_uid, COUNT(*) FROM portal_users GROUP BY org_id, auth_uid HAVING COUNT(*) > 1) t")
if [ "$DUP_PORTAL" = "0" ] || [ "$DUP_PORTAL" = "" ]; then
  [ "$VERBOSE" = "1" ] && _pass "No duplicate portal_users.auth_uid per org"
else
  _critical "Duplicate portal_users.auth_uid within same org ($DUP_PORTAL group(s))"
fi

_section "2c. Organization/tenant consistency"

# Verify jobs → customers → properties all share the same org_id.
CROSS_TENANT=$(_query "SELECT COUNT(*) FROM jobs j JOIN customers c ON c.id = j.customer_id WHERE j.org_id != c.org_id")
if [ "$CROSS_TENANT" = "0" ] || [ "$CROSS_TENANT" = "" ]; then
  [ "$VERBOSE" = "1" ] && _pass "No cross-tenant job→customer references"
else
  _critical "Cross-tenant data detected: $CROSS_TENANT job(s) reference a customer from a different org"
  _hint "This is a serious data integrity violation.  Audit affected rows immediately."
fi

CROSS_TENANT_PROP=$(_query "SELECT COUNT(*) FROM properties p JOIN customers c ON c.id = p.customer_id WHERE p.org_id != c.org_id")
if [ "$CROSS_TENANT_PROP" = "0" ] || [ "$CROSS_TENANT_PROP" = "" ]; then
  [ "$VERBOSE" = "1" ] && _pass "No cross-tenant property→customer references"
else
  _critical "Cross-tenant data detected: $CROSS_TENANT_PROP property/properties reference a customer from a different org"
fi

# ── 3. Security integrity ─────────────────────────────────────────────────────

_section "3a. RLS enabled on required tables"

REQUIRED_RLS_TABLES=(
  "organizations" "user_profiles" "customers" "properties"
  "contractors" "jobs" "job_activity" "portal_users" "portal_memberships"
  "daily_plan_notes" "daily_plan_activations" "dispatch_plans"
  "crews" "installed_systems" "property_documents" "property_photos"
  "storage_objects" "knowledge_items" "portal_projects"
  "db_health_check_runs" "db_health_check_results"
)

for TABLE in "${REQUIRED_RLS_TABLES[@]}"; do
  RLS_ON=$(_query "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = '$TABLE' AND c.rowsecurity = true")
  if [ "$RLS_ON" = "1" ]; then
    [ "$VERBOSE" = "1" ] && _pass "RLS enabled on $TABLE"
  else
    _critical "RLS is NOT enabled on $TABLE"
    _hint "Run: ALTER TABLE $TABLE ENABLE ROW LEVEL SECURITY;"
    _hint "Then create a recovery migration to capture the fix."
  fi
done

_section "3b. Required RLS policies present"

# Spot-check key org-scoped policies.
check_policy() {
  local table="$1" policy="$2"
  FOUND=$(_query "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = '$table' AND policyname = '$policy'")
  if [ "$FOUND" = "1" ]; then
    [ "$VERBOSE" = "1" ] && _pass "Policy '$policy' on $table exists"
  else
    _critical "RLS policy '$policy' is missing on $table"
    _hint "Apply the relevant migration or create a recovery migration."
  fi
}

check_policy "organizations"  "orgs: owner read"
check_policy "customers"      "customers: org read"
check_policy "properties"     "properties: org read"
check_policy "jobs"           "jobs: org read"
check_policy "user_profiles"  "profiles: org read"

# ── summary ───────────────────────────────────────────────────────────────────

_header "Integrity Check Summary"
echo "  Completed: $(_ts)"
echo "  Critical failures : $CRITICAL_FAILURES"
echo "  Warnings          : $WARNINGS"

# Machine-readable JSON summary (suitable for downstream tooling).
echo ""
echo "── JSON Summary ────────────────────────────────────────────────────────"
cat <<JSON
{
  "timestamp": "$(_ts)",
  "category": "integrity",
  "status": $([ "$CRITICAL_FAILURES" -eq 0 ] && echo '"ok"' || echo '"fail"'),
  "criticalFailures": $CRITICAL_FAILURES,
  "warnings": $WARNINGS
}
JSON
echo "────────────────────────────────────────────────────────────────────────"

echo ""
if [ "$CRITICAL_FAILURES" -gt 0 ]; then
  echo "  ✗ INTEGRITY CHECK FAILED — $CRITICAL_FAILURES critical violation(s)." >&2
  echo ""
  echo "  Resolve each critical failure before deploying." >&2
  echo "  See docs/runbooks/db-drift-detection.md for remediation guidance." >&2
  echo ""
  exit 1
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo "  ⚠ INTEGRITY CHECK PASSED WITH WARNINGS — address advisories at your convenience."
else
  echo "  ✓ INTEGRITY CHECK PASSED — all checks succeeded."
fi

echo ""
exit 0
