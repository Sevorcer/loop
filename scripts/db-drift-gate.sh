#!/usr/bin/env bash
# scripts/db-drift-gate.sh
#
# Reusable DB drift + health gate for LOOP.
#
# Runs a series of critical checks against the linked Supabase project.
# Each check is labelled CRITICAL or WARNING.  The script exits 1 if any
# CRITICAL check fails; it exits 0 (with advisory output) when only WARNINGs
# are present.
#
# Designed to be called by:
#   - .github/workflows/pre-deploy-gate.yml  (deployment blocker)
#   - future: .github/workflows/db-health-check.yml  (daily health job, #114)
#
# Prerequisites (env vars must be set before calling this script):
#   SUPABASE_ACCESS_TOKEN   — Personal access token from Supabase account settings
#   SUPABASE_PROJECT_REF    — Project reference ID (e.g. "abcdefghijklmnop")
#
# The script assumes `supabase link` has already been run in the calling
# environment.  It does not link the project itself.
#
# Exit codes:
#   0  All CRITICAL checks passed (WARNINGs may be present).
#   1  One or more CRITICAL checks failed — deployment must be blocked.
#   2  Pre-flight error (missing tool, missing env var, etc.).

set -euo pipefail

# ── constants ─────────────────────────────────────────────────────────────────

GATE_VERSION="1.0"
SCRIPT_NAME="db-drift-gate.sh"

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

# ── pre-flight ────────────────────────────────────────────────────────────────

_header "LOOP DB Drift Gate  v${GATE_VERSION}"
echo "  Script : $SCRIPT_NAME"
echo "  Started: $(_ts)"
echo ""

# Verify Supabase CLI is available.
if ! command -v supabase &>/dev/null; then
  echo "::error::supabase CLI not found — install it before running this gate." >&2
  exit 2
fi

# Verify required environment variables.
for VAR in SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF; do
  if [ -z "${!VAR:-}" ]; then
    echo "::error::Required env var $VAR is not set." >&2
    exit 2
  fi
done

# ── check 1: migration file structure ─────────────────────────────────────────
# Delegates entirely to the existing verify-migrations.sh so there is no
# duplicate logic.  A structural failure is CRITICAL — broken filenames or
# out-of-order timestamps indicate a workflow problem that must be fixed
# before deploying.

_section "Check 1 — Migration file structure"

VERIFY_SCRIPT="$(cd "$(dirname "$0")" && pwd)/verify-migrations.sh"

if [ ! -f "$VERIFY_SCRIPT" ]; then
  _critical "verify-migrations.sh not found at $VERIFY_SCRIPT"
  _hint "Ensure scripts/verify-migrations.sh exists and is executable."
else
  if bash "$VERIFY_SCRIPT"; then
    _pass "Migration file structure is valid."
  else
    _critical "Migration file structure check failed."
    _hint "Fix naming convention or ordering issues in supabase/migrations/ then re-push."
    _hint "Run locally: bash scripts/verify-migrations.sh"
  fi
fi

# ── check 2: pending (unapplied) migrations ────────────────────────────────────
# If migration files exist locally that have not been applied to the target
# database, deploying the application against an outdated schema is unsafe.
# This is a CRITICAL failure.

_section "Check 2 — Unapplied migrations"

PENDING_OUTPUT=$(supabase migration list --linked 2>&1 || true)

# `supabase migration list --linked` shows local migration files alongside their
# remote applied state.  Lines that contain a 14-digit timestamp but no ISO-8601
# date (YYYY-MM-DD) are either pending or not yet applied.
#
# Strategy: print all rows that start with a timestamp, then subtract rows that
# contain an applied date.  Two pipes keeps the logic readable and avoids a
# single brittle regex trying to handle multiple CLI output formats.

TIMESTAMP_ROWS=$(echo "$PENDING_OUTPUT" | grep -E '^\s*[0-9]{14}' || true)
APPLIED_ROWS=$(echo "$TIMESTAMP_ROWS" | grep -E '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)

if [ -n "$TIMESTAMP_ROWS" ] && [ "$TIMESTAMP_ROWS" != "$APPLIED_ROWS" ]; then
  # Rows present locally but not applied remotely.
  UNAPPLIED=$(comm -23 \
    <(echo "$TIMESTAMP_ROWS" | sort) \
    <(echo "$APPLIED_ROWS"   | sort) || true)
else
  UNAPPLIED=""
fi

if [ -n "$UNAPPLIED" ]; then
  _critical "Unapplied migrations detected — deploying now is unsafe."
  echo ""
  echo "$UNAPPLIED"
  echo ""
  _hint "Why it matters: the application code expects these schema changes to be present."
  _hint "Next step     : run  supabase db push --linked  then re-run this gate."
  _hint "Ref           : see docs/runbooks/pre-deploy-gate.md for the full release flow."
else
  _pass "All migrations are applied."
fi

# ── check 3: schema drift ──────────────────────────────────────────────────────
# Detects out-of-band schema changes applied directly to the database that are
# not captured in any migration file.  Drift means the schema tracked in source
# control no longer matches the live database.  This is a CRITICAL failure.

_section "Check 3 — Schema drift (db diff)"

DIFF_RAW=$(supabase db diff --linked 2>&1 || true)
DIFF_CLEAN=$(echo "$DIFF_RAW" | sed -E 's/\x1B\[[0-9;]*[[:alpha:]]//g')

# Filter blank lines and pure SQL comment lines — these are structural noise
# emitted by the CLI even when there is no meaningful diff.
#
# Known limitation: this heuristic can theoretically produce false positives if
# the CLI output format changes significantly.  In that case, disable Check 3 in
# the script per the bypass policy in docs/runbooks/pre-deploy-gate.md while the
# root cause is investigated.  The raw diff is always printed so operators can
# make a manual judgment call.
DIFF_MEANINGFUL=$(echo "$DIFF_CLEAN" | grep -v '^\s*$' | grep -v '^\s*--' || true)

if echo "$DIFF_CLEAN" | grep -q "No schema changes found"; then
  _pass "No schema drift detected."
elif [ -n "$DIFF_MEANINGFUL" ]; then
  _critical "Schema drift detected — live DB schema diverges from migration files."
  echo ""
  echo "── Diff output ─────────────────────────────────────────────────────"
  echo "$DIFF_RAW"
  echo "────────────────────────────────────────────────────────────────────"
  echo ""
  _hint "Why it matters: the application may behave incorrectly against a drifted schema."
  _hint "Next step     : generate a migration for the out-of-band change:"
  _hint "                  supabase db diff --linked --schema public -f <name>"
  _hint "                then commit and push the generated file."
  _hint "Ref           : see docs/runbooks/pre-deploy-gate.md for the full release flow."
else
  _pass "No schema drift detected."
fi

# ── check 4: policy drift ─────────────────────────────────────────────────────
# Delegates to scripts/verify-policies.sh which:
#   - Parses expected policy names from supabase/migrations/*.sql
#   - Queries pg_policies for the actual live policy set
#   - Reports missing and unexpected policies
#
# A missing policy (defined in migrations but absent from the live DB) is
# CRITICAL — it means RLS is only partially enforced and a security boundary
# may be absent.
#
# Requires DATABASE_URL to be set.  If not set, this check is skipped with a
# WARNING (pre-flight already enforced SUPABASE_ACCESS_TOKEN and
# SUPABASE_PROJECT_REF; DATABASE_URL is an additional optional requirement for
# this gate).

_section "Check 4 — Policy drift (verify-policies)"

VERIFY_POLICIES_SCRIPT="$(cd "$(dirname "$0")" && pwd)/verify-policies.sh"

if [ ! -f "$VERIFY_POLICIES_SCRIPT" ]; then
  _critical "verify-policies.sh not found at $VERIFY_POLICIES_SCRIPT"
  _hint "Ensure scripts/verify-policies.sh exists and is executable."
elif [ -z "${DATABASE_URL:-}" ]; then
  _warn "DATABASE_URL is not set — skipping policy drift check."
  _hint "Set DATABASE_URL to enable full policy verification in this gate."
  _hint "See docs/runbooks/db-drift-detection.md for setup instructions."
else
  if bash "$VERIFY_POLICIES_SCRIPT" 2>&1; then
    _pass "All expected RLS policies are present."
  else
    EXIT_CODE=$?
    if [ "$EXIT_CODE" -eq 1 ]; then
      _critical "Policy drift detected — one or more expected RLS policies are missing."
      _hint "Why it matters: missing policies may leave rows unprotected by RLS."
      _hint "Next step     : apply pending migrations with  supabase db push --linked"
      _hint "Ref           : see docs/runbooks/db-drift-detection.md for remediation."
    else
      _critical "verify-policies.sh exited with unexpected code $EXIT_CODE."
    fi
  fi
fi

# ── summary ───────────────────────────────────────────────────────────────────

_header "Gate Summary"
echo "  Completed: $(_ts)"
echo "  Critical failures : $CRITICAL_FAILURES"
echo "  Warnings          : $WARNINGS"
echo ""

if [ "$CRITICAL_FAILURES" -gt 0 ]; then
  echo "  ✗ GATE FAILED — deployment is BLOCKED."
  echo ""
  echo "  Resolve the critical failure(s) listed above before re-deploying."
  echo "  See docs/runbooks/pre-deploy-gate.md for the gate bypass policy."
  echo ""
  exit 1
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo "  ⚠ GATE PASSED WITH WARNINGS — deployment may proceed."
  echo "    Address advisory warnings at your earliest convenience."
else
  echo "  ✓ GATE PASSED — deployment is CLEAR."
fi

echo ""
exit 0
