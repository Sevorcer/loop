#!/usr/bin/env bash
# scripts/verify-migrations.sh
#
# Validates the local migration file set before CI apply or local development.
#
# Checks performed:
#   1. Every file follows the naming convention: YYYYMMDDHHMMSS_description.sql
#   2. No two files share the same timestamp prefix (duplicate prevention).
#   3. Files are in strict ascending timestamp order (no out-of-order entries).
#   4. No file is empty (zero-byte guard).
#
# Usage:
#   bash scripts/verify-migrations.sh
#
# Exit codes:
#   0  All checks passed.
#   1  One or more checks failed — details printed to stderr.

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../supabase/migrations" && pwd)"
ERRORS=0

# ── helpers ──────────────────────────────────────────────────────────────────

pass()  { echo "  ✓ $*"; }
fail()  { echo "  ✗ $*" >&2; ERRORS=$((ERRORS + 1)); }
info()  { echo "$*"; }

# ── collect files ─────────────────────────────────────────────────────────────

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Error: migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

mapfile -t FILES < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" | sort)

if [ "${#FILES[@]}" -eq 0 ]; then
  info "No migration files found in $MIGRATIONS_DIR — nothing to verify."
  exit 0
fi

info "Verifying ${#FILES[@]} migration file(s) in $MIGRATIONS_DIR"
info ""

# ── check 1: naming convention ────────────────────────────────────────────────

info "1. Naming convention (YYYYMMDDHHMMSS_description.sql)"

CONVENTION_REGEX='^[0-9]{14}_[a-z0-9_]+\.sql$'

for FILE in "${FILES[@]}"; do
  BASENAME="$(basename "$FILE")"
  if [[ ! "$BASENAME" =~ $CONVENTION_REGEX ]]; then
    fail "$BASENAME — does not match YYYYMMDDHHMMSS_description.sql"
  else
    pass "$BASENAME"
  fi
done

# ── check 2: no duplicate timestamps ─────────────────────────────────────────

info ""
info "2. Duplicate timestamp detection"

declare -A SEEN_TIMESTAMPS

for FILE in "${FILES[@]}"; do
  BASENAME="$(basename "$FILE")"
  TIMESTAMP="${BASENAME:0:14}"
  if [[ -v "SEEN_TIMESTAMPS[$TIMESTAMP]" ]]; then
    fail "Duplicate timestamp $TIMESTAMP found in:"
    fail "  ${SEEN_TIMESTAMPS[$TIMESTAMP]}"
    fail "  $BASENAME"
  else
    SEEN_TIMESTAMPS["$TIMESTAMP"]="$BASENAME"
    pass "Timestamp $TIMESTAMP is unique ($BASENAME)"
  fi
done

# ── check 3: ascending order ──────────────────────────────────────────────────

info ""
info "3. Ascending timestamp order"

PREV_TS=""
PREV_FILE=""

for FILE in "${FILES[@]}"; do
  BASENAME="$(basename "$FILE")"
  TIMESTAMP="${BASENAME:0:14}"
  if [[ -n "$PREV_TS" && "$TIMESTAMP" < "$PREV_TS" ]]; then
    fail "Out-of-order migration: $BASENAME (timestamp $TIMESTAMP) comes after $PREV_FILE ($PREV_TS)"
  else
    pass "$BASENAME is in order"
  fi
  PREV_TS="$TIMESTAMP"
  PREV_FILE="$BASENAME"
done

# ── check 4: no empty files ───────────────────────────────────────────────────

info ""
info "4. Non-empty file check"

for FILE in "${FILES[@]}"; do
  BASENAME="$(basename "$FILE")"
  if [ ! -s "$FILE" ]; then
    fail "$BASENAME is empty"
  else
    pass "$BASENAME has content"
  fi
done

# ── summary ───────────────────────────────────────────────────────────────────

info ""
if [ "$ERRORS" -gt 0 ]; then
  echo "Migration verification FAILED — $ERRORS error(s) found." >&2
  exit 1
else
  echo "Migration verification PASSED — all checks succeeded."
fi
