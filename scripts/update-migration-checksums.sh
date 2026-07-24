#!/usr/bin/env bash
# scripts/update-migration-checksums.sh
#
# Regenerates scripts/migration-checksums.sha256 from the current state of
# supabase/migrations/*.sql.
#
# Run this script after adding a new migration file and commit both together.
# Do NOT run this after modifying an existing migration — edit the migration
# only by creating a new one and let the drift check catch tampering.
#
# Usage:
#   bash scripts/update-migration-checksums.sh
#
# Exit codes:
#   0  Checksum file updated successfully.
#   1  No migration files found.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
CHECKSUMS_FILE="$SCRIPT_DIR/migration-checksums.sha256"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Error: migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

mapfile -t FILES < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" | sort)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "Error: no migration files found in $MIGRATIONS_DIR" >&2
  exit 1
fi

# Generate checksums relative to the repo root so the file is portable.
cd "$REPO_ROOT"
sha256sum "${FILES[@]#$REPO_ROOT/}" > "$CHECKSUMS_FILE"

echo "Updated $CHECKSUMS_FILE with ${#FILES[@]} migration file(s):"
while IFS= read -r line; do
  echo "  $line"
done < "$CHECKSUMS_FILE"
echo ""
echo "Commit this file alongside the new migration:"
echo "  git add scripts/migration-checksums.sha256"
