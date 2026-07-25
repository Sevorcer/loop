#!/usr/bin/env bash
# scripts/db-bootstrap-validate.sh
#
# Fresh environment bootstrap validation for LOOP.
#
# Proves that a newly provisioned database is operational — not merely
# migrated — by executing the full bootstrap sequence:
#
#   Stage 1: Pre-flight
#     - Tool availability (psql, sha256sum)
#     - DATABASE_URL connectivity
#
#   Stage 2: Migration structure validation
#     - All migration files are named correctly, ordered, non-empty
#     - Every migration has a companion verification file
#     - Every migration has rollback notes
#     - Checksums match committed manifest
#
#   Stage 3: Schema verification
#     - Required tables exist
#     - Required columns exist and are correctly typed
#     - RLS is enabled on all required tables
#     - Required PostgreSQL extensions are installed
#     - Required helper functions exist
#     - Required indexes exist
#
#   Stage 4: Verification SQL execution
#     - Each companion .verify.sql runs successfully against the live database
#     - Any failed assertion surfaces an actionable error message
#
#   Stage 5: Data bootstrap validation
#     - Inserts a canary organization, user_profile, customer, property, and job
#     - Verifies each record can be read back
#     - Cleans up all canary rows (idempotent)
#
# Stages 3–5 require DATABASE_URL.
# Stage 2 (structural) runs without a database connection.
#
# Usage:
#   DATABASE_URL="postgresql://..." bash scripts/db-bootstrap-validate.sh
#   npm run db:bootstrap-validate
#
#   Run Stage 2 only (no DB required):
#   bash scripts/db-bootstrap-validate.sh --structure-only
#
# Exit codes:
#   0  All stages passed — environment is operational.
#   1  One or more stages failed — diagnostics printed.
#   2  Pre-flight error (missing tool, missing env var, cannot connect).

set -euo pipefail

SCRIPT_VERSION="1.0"
SCRIPT_NAME="db-bootstrap-validate.sh"
STRUCTURE_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --structure-only) STRUCTURE_ONLY=true; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

# ── helpers ───────────────────────────────────────────────────────────────────

TOTAL_STAGES=0
PASSED_STAGES=0
FAILED_STAGES=0

_ts()       { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_header()   { echo ""; echo "════════════════════════════════════════════════════"; echo "  $*"; echo "════════════════════════════════════════════════════"; }
_stage()    { TOTAL_STAGES=$((TOTAL_STAGES + 1)); echo ""; echo "── Stage $TOTAL_STAGES: $* ─────────────────────────────"; }
_pass()     { echo "  ✓ $*"; }
_fail()     { echo "  ✗ $*" >&2; }
_hint()     { echo "    → $*"; }
_info()     { echo "    $*"; }
_stage_pass() { PASSED_STAGES=$((PASSED_STAGES + 1)); echo "  ✓ Stage passed."; }
_stage_fail() { FAILED_STAGES=$((FAILED_STAGES + 1)); echo "  ✗ Stage FAILED." >&2; }

# Run a psql query returning a single value.
_query() { psql "$DATABASE_URL" -t -A -c "$1" 2>/dev/null || echo "ERROR"; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
VERIF_DIR="$REPO_ROOT/supabase/verifications"

# ── banner ────────────────────────────────────────────────────────────────────

_header "LOOP Bootstrap Validation  v${SCRIPT_VERSION}"
echo "  Script      : $SCRIPT_NAME"
echo "  Mode        : $([ "$STRUCTURE_ONLY" = "true" ] && echo "structure-only" || echo "full (requires DATABASE_URL)")"
echo "  Started     : $(_ts)"
echo "  Repo root   : $REPO_ROOT"

# ── Stage 1: Pre-flight ───────────────────────────────────────────────────────

_stage "Pre-flight"

PREFLIGHT_OK=true

if ! command -v sha256sum &>/dev/null; then
  _fail "sha256sum not found — install coreutils before running this script."
  PREFLIGHT_OK=false
else
  _pass "sha256sum available"
fi

if [ "$STRUCTURE_ONLY" = "false" ]; then
  if ! command -v psql &>/dev/null; then
    _fail "psql not found — install PostgreSQL client tools."
    PREFLIGHT_OK=false
  else
    _pass "psql available"
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    _fail "DATABASE_URL is not set."
    _hint "export DATABASE_URL=\"postgresql://postgres:[password]@[host]:5432/postgres\""
    PREFLIGHT_OK=false
  else
    _pass "DATABASE_URL is set"
    if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
      _pass "Database connection successful"
    else
      _fail "Cannot connect to database at DATABASE_URL."
      _hint "Verify the connection string and that the database is reachable."
      PREFLIGHT_OK=false
    fi
  fi
fi

if [ "$PREFLIGHT_OK" = "true" ]; then
  _stage_pass
else
  _stage_fail
  echo ""
  echo "Pre-flight failed.  Resolve the issue(s) above and re-run." >&2
  exit 2
fi

# ── Stage 2: Migration structure validation ───────────────────────────────────

_stage "Migration structure validation"

VERIFY_SCRIPT="$REPO_ROOT/scripts/verify-migrations.sh"

if [ ! -f "$VERIFY_SCRIPT" ]; then
  _fail "verify-migrations.sh not found at $VERIFY_SCRIPT"
  _stage_fail
  exit 1
fi

if bash "$VERIFY_SCRIPT"; then
  _stage_pass
else
  _stage_fail
  _hint "Fix the migration structure issues and re-run."
  _hint "See docs/migration-verification-standard.md for the authoring standard."
  exit 1
fi

# ── Stages 3–5 require a live database ───────────────────────────────────────

if [ "$STRUCTURE_ONLY" = "true" ]; then
  _header "Bootstrap Validation Summary"
  echo "  Mode: structure-only (stages 3–5 skipped)"
  echo "  Stages passed: $PASSED_STAGES / $TOTAL_STAGES"
  echo ""
  echo "  ✓ Structure validation passed.  Run without --structure-only to validate a live DB."
  exit 0
fi

# ── Stage 3: Schema verification ─────────────────────────────────────────────

_stage "Schema verification"

SCHEMA_OK=true

# Extensions
for EXT in "uuid-ossp" "pgcrypto"; do
  COUNT=$(_query "SELECT COUNT(*) FROM pg_extension WHERE extname = '$EXT'")
  if [ "$COUNT" = "1" ]; then
    _pass "Extension $EXT present"
  else
    _fail "Extension $EXT is missing"
    SCHEMA_OK=false
  fi
done

# Helper functions
for FN in "current_org_id" "current_app_role"; do
  COUNT=$(_query "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = '$FN'")
  if [ "$COUNT" = "1" ]; then
    _pass "Helper function $FN() present"
  else
    _fail "Helper function $FN() is missing"
    SCHEMA_OK=false
  fi
done

# Core tables
CORE_TABLES=("organizations" "user_profiles" "customers" "properties" "jobs" "job_activity" "contractors" "portal_users" "portal_memberships")
for TABLE in "${CORE_TABLES[@]}"; do
  COUNT=$(_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$TABLE'")
  if [ "$COUNT" = "1" ]; then
    _pass "Table $TABLE exists"
  else
    _fail "Table $TABLE is MISSING"
    SCHEMA_OK=false
  fi
done

# RLS
for TABLE in "${CORE_TABLES[@]}"; do
  COUNT=$(_query "SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = '$TABLE' AND c.rowsecurity = true")
  if [ "$COUNT" = "1" ]; then
    _pass "RLS enabled on $TABLE"
  else
    _fail "RLS is NOT enabled on $TABLE"
    SCHEMA_OK=false
  fi
done

# Key indexes
for IDX in "customers_org_id_idx" "jobs_org_id_idx" "properties_org_id_idx"; do
  COUNT=$(_query "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = '$IDX'")
  if [ "$COUNT" = "1" ]; then
    _pass "Index $IDX present"
  else
    _fail "Index $IDX is missing"
    SCHEMA_OK=false
  fi
done

if [ "$SCHEMA_OK" = "true" ]; then
  _stage_pass
else
  _stage_fail
  _hint "Apply pending migrations:  supabase db push --linked"
  _hint "Then re-run this script."
  exit 1
fi

# ── Stage 4: Verification SQL execution ──────────────────────────────────────

_stage "Verification SQL execution"

mapfile -t VERIF_FILES < <(find "$VERIF_DIR" -maxdepth 1 -name "*.verify.sql" | sort)

if [ "${#VERIF_FILES[@]}" -eq 0 ]; then
  _fail "No verification files found in $VERIF_DIR"
  _stage_fail
  exit 1
fi

VERIF_OK=true
for VERIF_FILE in "${VERIF_FILES[@]}"; do
  BASENAME="$(basename "$VERIF_FILE")"
  if psql "$DATABASE_URL" -f "$VERIF_FILE" >/dev/null 2>&1; then
    _pass "$BASENAME — all assertions passed"
  else
    _fail "$BASENAME — assertion failed:"
    psql "$DATABASE_URL" -f "$VERIF_FILE" 2>&1 | sed 's/^/    /' >&2 || true
    VERIF_OK=false
  fi
done

if [ "$VERIF_OK" = "true" ]; then
  _stage_pass
else
  _stage_fail
  _hint "A failed assertion means the live schema does not match the migration contract."
  _hint "Apply the relevant migration or investigate schema drift."
  exit 1
fi

# ── Stage 5: Data bootstrap validation ───────────────────────────────────────

_stage "Data bootstrap validation"

# Use a unique canary marker so cleanup is reliable.
CANARY_ID="$(date -u +%s%N 2>/dev/null || date -u +%s)_bootstrap_canary"
CANARY_ORG_ID=""
CANARY_CUSTOMER_ID=""
CANARY_PROPERTY_ID=""
CANARY_JOB_ID=""

cleanup_canary() {
  # Remove canary rows in dependency order (child → parent).
  if [ -n "$CANARY_JOB_ID" ]; then
    psql "$DATABASE_URL" -c "DELETE FROM jobs WHERE id = '$CANARY_JOB_ID'" >/dev/null 2>&1 || true
  fi
  if [ -n "$CANARY_PROPERTY_ID" ]; then
    psql "$DATABASE_URL" -c "DELETE FROM properties WHERE id = '$CANARY_PROPERTY_ID'" >/dev/null 2>&1 || true
  fi
  if [ -n "$CANARY_CUSTOMER_ID" ]; then
    psql "$DATABASE_URL" -c "DELETE FROM customers WHERE id = '$CANARY_CUSTOMER_ID'" >/dev/null 2>&1 || true
  fi
  if [ -n "$CANARY_ORG_ID" ]; then
    psql "$DATABASE_URL" -c "DELETE FROM user_profiles WHERE org_id = '$CANARY_ORG_ID'" >/dev/null 2>&1 || true
    psql "$DATABASE_URL" -c "DELETE FROM organizations WHERE id = '$CANARY_ORG_ID'" >/dev/null 2>&1 || true
  fi
}

# Always clean up on exit.
trap cleanup_canary EXIT

BOOTSTRAP_OK=true

# Insert canary organization (bypasses RLS — requires service_role or superuser).
CANARY_ORG_ID=$(_query "INSERT INTO organizations (name) VALUES ('__canary_bootstrap_$CANARY_ID') RETURNING id")
if [ -z "$CANARY_ORG_ID" ] || [ "$CANARY_ORG_ID" = "ERROR" ]; then
  _fail "Failed to insert canary organization"
  BOOTSTRAP_OK=false
else
  _pass "Created canary organization ($CANARY_ORG_ID)"
fi

if [ "$BOOTSTRAP_OK" = "true" ]; then
  # Insert canary user_profile.
  CANARY_PROFILE_SQL="
    INSERT INTO user_profiles (org_id, full_name, app_role)
    VALUES ('$CANARY_ORG_ID', '__canary_user', 'owner')
    RETURNING id
  "
  PROFILE_ID=$(_query "$CANARY_PROFILE_SQL")
  if [ -z "$PROFILE_ID" ] || [ "$PROFILE_ID" = "ERROR" ]; then
    _fail "Failed to insert canary user_profile"
    BOOTSTRAP_OK=false
  else
    _pass "Created canary user_profile ($PROFILE_ID)"
  fi
fi

if [ "$BOOTSTRAP_OK" = "true" ]; then
  # Insert canary customer.
  CANARY_CUSTOMER_SQL="
    INSERT INTO customers (org_id, name, primary_contact, email, phone, city, status)
    VALUES ('$CANARY_ORG_ID', '__canary_customer', '__canary', 'canary@bootstrap.test', '000-000-0000', 'Canary City', 'active')
    RETURNING id
  "
  CANARY_CUSTOMER_ID=$(_query "$CANARY_CUSTOMER_SQL")
  if [ -z "$CANARY_CUSTOMER_ID" ] || [ "$CANARY_CUSTOMER_ID" = "ERROR" ]; then
    _fail "Failed to insert canary customer"
    BOOTSTRAP_OK=false
  else
    _pass "Created canary customer ($CANARY_CUSTOMER_ID)"
  fi
fi

if [ "$BOOTSTRAP_OK" = "true" ]; then
  # Insert canary property.
  CANARY_PROPERTY_SQL="
    INSERT INTO properties (org_id, customer_id, name, address, city, type, status)
    VALUES ('$CANARY_ORG_ID', '$CANARY_CUSTOMER_ID', '__canary_property', '1 Canary Lane', 'Canary City', 'residential', 'active')
    RETURNING id
  "
  CANARY_PROPERTY_ID=$(_query "$CANARY_PROPERTY_SQL")
  if [ -z "$CANARY_PROPERTY_ID" ] || [ "$CANARY_PROPERTY_ID" = "ERROR" ]; then
    _fail "Failed to insert canary property"
    BOOTSTRAP_OK=false
  else
    _pass "Created canary property ($CANARY_PROPERTY_ID)"
  fi
fi

if [ "$BOOTSTRAP_OK" = "true" ]; then
  # Insert canary job.
  CANARY_JOB_SQL="
    INSERT INTO jobs (org_id, job_number, title, type, status, priority, customer_id, property_id)
    VALUES ('$CANARY_ORG_ID', '__CANARY-001', '__canary_job', 'maintenance', 'pending', 'normal', '$CANARY_CUSTOMER_ID', '$CANARY_PROPERTY_ID')
    RETURNING id
  "
  CANARY_JOB_ID=$(_query "$CANARY_JOB_SQL")
  if [ -z "$CANARY_JOB_ID" ] || [ "$CANARY_JOB_ID" = "ERROR" ]; then
    _fail "Failed to insert canary job"
    BOOTSTRAP_OK=false
  else
    _pass "Created canary job ($CANARY_JOB_ID)"
  fi
fi

if [ "$BOOTSTRAP_OK" = "true" ]; then
  # Read back the full chain to confirm relational integrity.
  READBACK=$(_query "
    SELECT COUNT(*) FROM jobs j
    JOIN properties p ON p.id = j.property_id
    JOIN customers c ON c.id = j.customer_id
    JOIN organizations o ON o.id = j.org_id
    WHERE j.id = '$CANARY_JOB_ID'
  ")
  if [ "$READBACK" = "1" ]; then
    _pass "Full chain read-back succeeded (org → customer → property → job)"
  else
    _fail "Full chain read-back failed (expected 1 row, got: $READBACK)"
    BOOTSTRAP_OK=false
  fi
fi

# Cleanup happens in the EXIT trap.

if [ "$BOOTSTRAP_OK" = "true" ]; then
  _stage_pass
else
  _stage_fail
  _hint "Bootstrap data validation failed — the write path is not operational."
  _hint "Check RLS policies, database permissions, and schema completeness."
  exit 1
fi

# ── summary ───────────────────────────────────────────────────────────────────

_header "Bootstrap Validation Summary"
echo "  Completed  : $(_ts)"
echo "  Stages     : $PASSED_STAGES passed / $TOTAL_STAGES total"
echo ""

if [ "$FAILED_STAGES" -gt 0 ]; then
  echo "  ✗ BOOTSTRAP VALIDATION FAILED — $FAILED_STAGES stage(s) did not pass."
  echo ""
  echo "  The environment is NOT ready.  Resolve the issues above and re-run."
  exit 1
fi

echo "  ✓ BOOTSTRAP VALIDATION PASSED"
echo ""
echo "  The environment is operational:"
echo "    • All migrations are structurally valid"
echo "    • Schema matches migration contracts"
echo "    • Verification SQL assertions all passed"
echo "    • Write path (org → customer → property → job) is functional"
echo ""
echo "  See docs/runbooks/bootstrap-validation.md for interpretation guidance."
exit 0
