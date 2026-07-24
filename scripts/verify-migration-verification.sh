#!/usr/bin/env bash
# scripts/verify-migration-verification.sh
#
# Validates that every migration file contains a required verification section.
#
# The "Migration Verification Standard" (issue #118) requires each migration to
# include a  -- VERIFICATION:  block that contains at least one SELECT query
# confirming the migration applied correctly.  This makes the intent of the
# migration self-documenting and gives CI and reviewers a deterministic way to
# confirm the schema is healthy after apply.
#
# REQUIRED BLOCK FORMAT
# ---------------------
# Every migration file must contain a line that starts with:
#
#   -- VERIFICATION:
#
# followed by at least one non-blank, non-comment SELECT statement.  The block
# should appear at the end of the file.  Example:
#
#   -- VERIFICATION: -----------------------------------------------
#   -- Run after applying this migration to confirm schema is correct.
#   -- Expected result for each query: 1 row returned.
#
#   SELECT count(*) = 1 AS table_exists
#   FROM information_schema.tables
#   WHERE table_schema = 'public'
#     AND table_name = 'my_new_table';
#
# Usage
# -----
#   # Check all migrations:
#   bash scripts/verify-migration-verification.sh
#
#   # Check specific file(s) — useful before pushing:
#   bash scripts/verify-migration-verification.sh supabase/migrations/YYYYMMDDHHMMSS_my_change.sql
#
#   # npm alias:
#   npm run db:verify-migrations
#
# Exit codes
# ----------
#   0  All checked files contain a valid verification section.
#   1  One or more files are missing the required verification section.
#   2  No migration directory found (likely path issue).
#
# CI integration
# --------------
# The db-migrations.yml workflow calls this script automatically on every PR
# that adds or modifies files under supabase/migrations/.  Only the changed
# files are checked; existing migrations that pre-date this standard are not
# retroactively flagged.
#
# See docs/migration-runbook.md for the full workflow and remediation steps.

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../supabase/migrations" && pwd)"

# ── helpers ───────────────────────────────────────────────────────────────────

ERRORS=0

pass()  { echo "  ✓ $*"; }
fail()  { echo "  ✗ $*" >&2; ERRORS=$((ERRORS + 1)); }
info()  { echo "$*"; }
hint()  { echo "    → $*" >&2; }

# ── collect files to check ────────────────────────────────────────────────────

if [ "${#}" -gt 0 ]; then
  # Explicit file list provided (e.g. from CI or local spot-check).
  # Convert to absolute paths if needed.
  FILES=()
  for ARG in "$@"; do
    if [[ "$ARG" = /* ]]; then
      FILES+=("$ARG")
    else
      FILES+=("$(pwd)/$ARG")
    fi
  done
else
  # No arguments — check every migration file in the directory.
  if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: migrations directory not found: $MIGRATIONS_DIR" >&2
    exit 2
  fi
  mapfile -t FILES < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" | sort)
fi

if [ "${#FILES[@]}" -eq 0 ]; then
  info "No migration files to check — nothing to verify."
  exit 0
fi

info "Checking ${#FILES[@]} migration file(s) for required verification sections"
info ""
info "Standard: every migration must contain a '-- VERIFICATION:' block with"
info "at least one SELECT query that confirms the migration applied correctly."
info ""

# ── check each file ───────────────────────────────────────────────────────────

for FILE in "${FILES[@]}"; do
  BASENAME="$(basename "$FILE")"

  # 1. The file must contain the sentinel marker.
  if ! grep -q '^-- VERIFICATION:' "$FILE"; then
    fail "$BASENAME — missing '-- VERIFICATION:' block"
    hint "Add a verification section at the end of this file.  Example:"
    hint ""
    hint "  -- VERIFICATION: ------------------------------------------------"
    hint "  -- Confirm schema after this migration.  Expected: 1 row each."
    hint ""
    hint "  SELECT count(*) = 1 AS table_exists"
    hint "  FROM information_schema.tables"
    hint "  WHERE table_schema = 'public'"
    hint "    AND table_name = '<your_new_table>';"
    hint ""
    hint "See docs/migration-runbook.md for the full standard."
    continue
  fi

  # 2. At least one SELECT must appear after the sentinel.
  # Extract lines from the first occurrence of the marker to EOF.
  AFTER_SENTINEL=$(awk '/^-- VERIFICATION:/{found=1} found{print}' "$FILE")

  if ! echo "$AFTER_SENTINEL" | grep -qi '^[[:space:]]*SELECT'; then
    fail "$BASENAME — '-- VERIFICATION:' block found but contains no SELECT statement"
    hint "Add at least one SELECT query after the '-- VERIFICATION:' marker."
    hint "Example:"
    hint ""
    hint "  SELECT count(*) = 1 AS table_exists"
    hint "  FROM information_schema.tables"
    hint "  WHERE table_schema = 'public'"
    hint "    AND table_name = '<your_new_table>';"
    hint ""
    hint "See docs/migration-runbook.md for the full standard."
    continue
  fi

  pass "$BASENAME"
done

# ── summary ───────────────────────────────────────────────────────────────────

info ""

if [ "$ERRORS" -gt 0 ]; then
  echo "Migration verification check FAILED — $ERRORS file(s) missing required verification section." >&2
  echo "" >&2
  echo "To fix: add a '-- VERIFICATION:' block with one or more SELECT queries at" >&2
  echo "the end of each failing migration file before pushing." >&2
  echo "" >&2
  echo "Run locally to validate before pushing:" >&2
  echo "  bash scripts/verify-migration-verification.sh <file>" >&2
  echo "" >&2
  echo "Full standard: docs/migration-runbook.md#verification-section" >&2
  exit 1
fi

echo "Migration verification check PASSED — all ${#FILES[@]} file(s) contain a valid verification section."
