#!/usr/bin/env bash
# scripts/verify-policies.sh
#
# Verifies that all RLS policies expected from migration files are present in
# the live database.
#
# Policy names are extracted dynamically from supabase/migrations/*.sql — the
# single source of truth — so this script automatically covers new migrations
# without manual updates.
#
# Output:
#   Human-readable summary printed to stdout.
#   JSON summary printed to stdout at the end (machine-readable).
#
# Usage:
#   DATABASE_URL="postgresql://..." bash scripts/verify-policies.sh
#   npm run db:verify-policies
#
# Environment variables:
#   DATABASE_URL  — PostgreSQL connection string (required)
#   VERBOSE       — Set to "1" to print every policy check result (default: 0)
#
# Exit codes:
#   0  All expected policies are present — no policy drift.
#   1  One or more expected policies are missing — CRITICAL drift.
#   2  Pre-flight error (missing DATABASE_URL, psql unavailable, etc.).

set -euo pipefail

SCRIPT_VERSION="1.0"
SCRIPT_NAME="verify-policies.sh"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../supabase/migrations" && pwd)"
VERBOSE="${VERBOSE:-0}"

# ── helpers ───────────────────────────────────────────────────────────────────

MISSING_COUNT=0
CHECKED_COUNT=0

_ts()      { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_pass()    { echo "  ✓ $*"; }
_fail()    { echo "  ✗ [MISSING] $*" >&2; MISSING_COUNT=$((MISSING_COUNT + 1)); }
_hint()    { echo "    → $*"; }
_section() { echo ""; echo "── $* ──────────────────────────────────────────────"; }
_header()  { echo ""; echo "════════════════════════════════════════════════════"; echo "  $*"; echo "════════════════════════════════════════════════════"; }

# ── pre-flight ────────────────────────────────────────────────────────────────

_header "LOOP Policy Verification  v${SCRIPT_VERSION}"
echo "  Script : $SCRIPT_NAME"
echo "  Started: $(_ts)"

if ! command -v psql &>/dev/null; then
  echo "::error::psql not found — install PostgreSQL client tools." >&2
  exit 2
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "::error::DATABASE_URL is not set." >&2
  echo "  Set it to a valid PostgreSQL connection string, e.g.:" >&2
  echo "    export DATABASE_URL=\"******host:5432/dbname\"" >&2
  echo "  For local development use the Supabase local connection string." >&2
  exit 2
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "::error::migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 2
fi

# ── step 1: parse expected policies from migration files ──────────────────────

_section "Step 1 — Parse expected policies from migration files"

# Extract quoted policy names: CREATE POLICY "name"
# Extract unquoted policy names: CREATE POLICY name (word chars only, no quote follows)
mapfile -t EXPECTED_POLICIES < <(
  grep -rh 'CREATE POLICY' "$MIGRATIONS_DIR"/*.sql 2>/dev/null \
    | sed -E 's/.*CREATE[[:space:]]+POLICY[[:space:]]+"([^"]+)".*/\1/' \
    | grep -v 'CREATE POLICY' \
    | sort -u
  grep -rh 'CREATE POLICY' "$MIGRATIONS_DIR"/*.sql 2>/dev/null \
    | grep -v '"' \
    | sed -E 's/.*CREATE[[:space:]]+POLICY[[:space:]]+([a-zA-Z0-9_]+).*/\1/' \
    | grep -v 'CREATE' \
    | sort -u
)

# Deduplicate and sort the final list.
mapfile -t EXPECTED_POLICIES < <(printf '%s\n' "${EXPECTED_POLICIES[@]}" | sort -u)

EXPECTED_COUNT=${#EXPECTED_POLICIES[@]}
echo ""
echo "  Found $EXPECTED_COUNT expected policies across migration files in:"
echo "  $MIGRATIONS_DIR"

if [ "$EXPECTED_COUNT" -eq 0 ]; then
  echo "::warning::No CREATE POLICY statements found in migration files." >&2
  echo "  Ensure supabase/migrations/ contains the expected SQL files."
fi

# ── step 2: query live database for actual policies ───────────────────────────

_section "Step 2 — Query live database for actual policies"

# Query pg_policies for all policies in the public schema.
# Output one policy name per line.
ACTUAL_POLICIES_RAW=$(psql "$DATABASE_URL" --tuples-only --no-align \
  --command "SELECT policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY policyname;" \
  2>&1) || {
  echo "::error::Failed to query live database for policies." >&2
  echo "  Verify DATABASE_URL is correct and the database is reachable." >&2
  exit 2
}

mapfile -t ACTUAL_POLICIES < <(echo "$ACTUAL_POLICIES_RAW" | grep -v '^\s*$' | sort -u)
ACTUAL_COUNT=${#ACTUAL_POLICIES[@]}

echo ""
echo "  Found $ACTUAL_COUNT actual policies in live database (public schema)."

# ── step 3: compare expected vs actual ───────────────────────────────────────

_section "Step 3 — Compare expected vs actual"
echo ""

MISSING_POLICIES=()
UNEXPECTED_POLICIES=()

# Build lookup set from actual policies.
declare -A ACTUAL_SET
for POL in "${ACTUAL_POLICIES[@]}"; do
  ACTUAL_SET["$POL"]=1
done

# Build lookup set from expected policies.
declare -A EXPECTED_SET
for POL in "${EXPECTED_POLICIES[@]}"; do
  EXPECTED_SET["$POL"]=1
done

# Check every expected policy is present.
for POL in "${EXPECTED_POLICIES[@]}"; do
  CHECKED_COUNT=$((CHECKED_COUNT + 1))
  if [ "${ACTUAL_SET[$POL]+_}" ]; then
    if [ "$VERBOSE" = "1" ]; then
      _pass "$POL"
    fi
  else
    MISSING_POLICIES+=("$POL")
    _fail "$POL"
    _hint "Policy is defined in a migration file but not found in pg_policies."
    _hint "Remediation: ensure the migration containing this policy has been applied."
    _hint "  Run: supabase db push --linked"
  fi
done

# Identify unexpected policies (in DB but not in migrations).
for POL in "${ACTUAL_POLICIES[@]}"; do
  if [ ! "${EXPECTED_SET[$POL]+_}" ]; then
    UNEXPECTED_POLICIES+=("$POL")
    echo "  ⚠ [UNEXPECTED] $POL"
    _hint "Policy exists in live DB but is not defined in any migration file."
    _hint "Remediation: create a new migration to capture this policy, or investigate."
  fi
done

MISSING_COUNT=${#MISSING_POLICIES[@]}
UNEXPECTED_COUNT=${#UNEXPECTED_POLICIES[@]}

# ── summary: human-readable ───────────────────────────────────────────────────

_header "Policy Verification Summary"
echo "  Completed : $(_ts)"
echo "  Expected  : $EXPECTED_COUNT"
echo "  Actual    : $ACTUAL_COUNT"
echo "  Missing   : $MISSING_COUNT"
echo "  Unexpected: $UNEXPECTED_COUNT"
echo ""

if [ "$MISSING_COUNT" -gt 0 ]; then
  echo "  ✗ POLICY DRIFT DETECTED — ${MISSING_COUNT} expected policy/policies missing."
  echo ""
  echo "  Missing policies:"
  for POL in "${MISSING_POLICIES[@]}"; do
    echo "    - $POL"
  done
  echo ""
  _hint "Run the relevant migration(s) with: supabase db push --linked"
  _hint "See docs/runbooks/db-drift-detection.md for full remediation steps."
else
  echo "  ✓ No policy drift — all ${EXPECTED_COUNT} expected policies are present."
fi

if [ "$UNEXPECTED_COUNT" -gt 0 ]; then
  echo ""
  echo "  ⚠ ${UNEXPECTED_COUNT} unexpected policy/policies found (not in migration files)."
  for POL in "${UNEXPECTED_POLICIES[@]}"; do
    echo "    - $POL"
  done
fi

# ── summary: machine-readable JSON ────────────────────────────────────────────

echo ""
echo "── JSON Summary ────────────────────────────────────────────────────"
echo ""

# Build JSON arrays for missing and unexpected.
_json_array() {
  local arr=("$@")
  if [ "${#arr[@]}" -eq 0 ]; then
    echo "[]"
    return
  fi
  local out="["
  for i in "${!arr[@]}"; do
    # Escape double quotes inside names (edge case).
    local item="${arr[$i]//\"/\\\"}"
    if [ "$i" -eq 0 ]; then
      out="${out}\"${item}\""
    else
      out="${out},\"${item}\""
    fi
  done
  out="${out}]"
  echo "$out"
}

MISSING_JSON=$(_json_array "${MISSING_POLICIES[@]}")
UNEXPECTED_JSON=$(_json_array "${UNEXPECTED_POLICIES[@]}")
STATUS="ok"
[ "$MISSING_COUNT" -gt 0 ] && STATUS="drift"

cat <<EOF
{
  "timestamp": "$(_ts)",
  "category": "policies",
  "status": "$STATUS",
  "totalExpected": $EXPECTED_COUNT,
  "totalActual": $ACTUAL_COUNT,
  "missing": $MISSING_JSON,
  "unexpected": $UNEXPECTED_JSON
}
EOF

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo ""

# ── exit ──────────────────────────────────────────────────────────────────────

if [ "$MISSING_COUNT" -gt 0 ]; then
  exit 1
fi

exit 0
