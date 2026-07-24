#!/usr/bin/env bash
# scripts/verify-migration-verification.sh
#
# Standalone local spot-check tool: validates that every given migration file
# has a companion .verify.sql in supabase/verifications/.
#
# The "Migration Verification Standard" (issue #118) requires each migration to
# be accompanied by a verification file that uses DO $$ BEGIN ASSERT …; END; $$;
# blocks to assert every structural and security outcome of the migration.
#
# Full standard: docs/migration-verification-standard.md
# Naming convention:
#   Migration:     supabase/migrations/YYYYMMDDHHMMSS_<desc>.sql
#   Verification:  supabase/verifications/YYYYMMDDHHMMSS_<desc>.verify.sql
#
# The timestamp and description must be identical; only the extension changes
# (.sql → .verify.sql).
#
# NOTE: CI enforcement is built into scripts/verify-migrations.sh (Check 5),
# which runs on every PR and checks all migration files.  This script is
# intended for local spot-checking of specific files before pushing.
#
# Usage
# -----
#   # Check specific file(s):
#   bash scripts/verify-migration-verification.sh supabase/migrations/YYYYMMDDHHMMSS_my_change.sql
#
#   # Check all migrations:
#   bash scripts/verify-migration-verification.sh
#
#   # npm alias:
#   npm run db:verify-verification
#
# Exit codes
# ----------
#   0  All checked files have a companion .verify.sql with at least one
#      DO $$ BEGIN ASSERT block.
#   1  One or more files are missing their companion verification file or
#      the companion file contains no assertion blocks.
#   2  No migration directory found (likely path issue).
#
# Pass / fail examples
# --------------------
#
# PASS — all checked files have a companion verification file:
#
#   Checking 1 migration file(s) for companion verification files
#
#     ✓ 20260801120000_add_widgets_table.sql
#         → supabase/verifications/20260801120000_add_widgets_table.verify.sql
#
#   Migration verification check PASSED — all 1 file(s) have a companion verification file.
#
# FAIL — companion file missing:
#
#   Checking 1 migration file(s) for companion verification files
#
#     ✗ 20260801120000_add_widgets_table.sql — missing companion verification file
#       → Expected: supabase/verifications/20260801120000_add_widgets_table.verify.sql
#       → Create this file with DO $$ BEGIN ASSERT …; END; $$ blocks for every
#         structural and security outcome of the migration.
#       → See docs/migration-verification-standard.md for the full standard.
#
#   Migration verification check FAILED — 1 file(s) missing companion verification file.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
VERIF_DIR="$REPO_ROOT/supabase/verifications"

# ── helpers ───────────────────────────────────────────────────────────────────

ERRORS=0

pass()  { echo "  ✓ $*"; }
fail()  { echo "  ✗ $*" >&2; ERRORS=$((ERRORS + 1)); }
info()  { echo "$*"; }
hint()  { echo "    → $*" >&2; }

# ── collect files to check ────────────────────────────────────────────────────

if [ "${#}" -gt 0 ]; then
  # Explicit file list provided (e.g. local spot-check).
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

info "Checking ${#FILES[@]} migration file(s) for companion verification files"
info ""
info "Standard: supabase/migrations/YYYYMMDDHHMMSS_<desc>.sql"
info "          → supabase/verifications/YYYYMMDDHHMMSS_<desc>.verify.sql"
info ""

# ── check each file ───────────────────────────────────────────────────────────

for FILE in "${FILES[@]}"; do
  BASENAME="$(basename "$FILE" .sql)"
  VERIF_FILE="$VERIF_DIR/${BASENAME}.verify.sql"

  # 1. Companion .verify.sql must exist.
  if [ ! -f "$VERIF_FILE" ]; then
    fail "$(basename "$FILE") — missing companion verification file"
    hint "Expected: supabase/verifications/${BASENAME}.verify.sql"
    hint "Create this file with DO \$\$ BEGIN ASSERT …; END; \$\$ blocks for every"
    hint "structural and security outcome of the migration."
    hint "See docs/migration-verification-standard.md for the full standard."
    continue
  fi

  # 2. Companion file must be non-empty.
  if [ ! -s "$VERIF_FILE" ]; then
    fail "$(basename "$FILE") — companion verification file exists but is empty"
    hint "File: supabase/verifications/${BASENAME}.verify.sql"
    hint "Add DO \$\$ BEGIN ASSERT …; END; \$\$ blocks for every structural and"
    hint "security outcome of the migration."
    hint "See docs/migration-verification-standard.md for the full standard."
    continue
  fi

  # 3. Companion file must contain at least one ASSERT block.
  if ! grep -q 'ASSERT' "$VERIF_FILE"; then
    fail "$(basename "$FILE") — companion verification file contains no ASSERT statements"
    hint "File: supabase/verifications/${BASENAME}.verify.sql"
    hint "Add DO \$\$ BEGIN ASSERT …; END; \$\$ blocks.  Example:"
    hint ""
    hint "  DO \$\$ BEGIN"
    hint "    ASSERT EXISTS ("
    hint "      SELECT 1 FROM information_schema.tables"
    hint "      WHERE table_schema = 'public' AND table_name = 'my_table'"
    hint "    ), 'my_table must exist';"
    hint "  END; \$\$;"
    hint ""
    hint "See docs/migration-verification-standard.md for the full standard."
    continue
  fi

  pass "$(basename "$FILE")"
  echo "      → supabase/verifications/${BASENAME}.verify.sql"
done

# ── summary ───────────────────────────────────────────────────────────────────

info ""

if [ "$ERRORS" -gt 0 ]; then
  echo "Migration verification check FAILED — $ERRORS file(s) missing companion verification file." >&2
  echo "" >&2
  echo "For each failing migration, create:" >&2
  echo "  supabase/verifications/YYYYMMDDHHMMSS_<desc>.verify.sql" >&2
  echo "" >&2
  echo "Run scripts/verify-migrations.sh for the full CI check (all migrations)." >&2
  echo "Full standard: docs/migration-verification-standard.md" >&2
  exit 1
fi

echo "Migration verification check PASSED — all ${#FILES[@]} file(s) have a companion verification file."
