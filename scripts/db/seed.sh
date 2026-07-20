#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE_ROOT="$ROOT_DIR/database/fixtures"
DATASET="all"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dataset)
      DATASET="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$DATASET" != "all" && "$DATASET" != "baseline" && "$DATASET" != "golden_path" ]]; then
  echo "Invalid dataset '$DATASET'. Expected one of: all, baseline, golden_path." >&2
  exit 1
fi

collect_seed_files() {
  local dataset="$1"
  case "$dataset" in
    baseline)
      find "$FIXTURE_ROOT/baseline" -maxdepth 1 -name "*.sql" | sort
      ;;
    golden_path)
      find "$FIXTURE_ROOT/golden_path" -maxdepth 1 -name "*.sql" | sort
      ;;
    all)
      {
        find "$FIXTURE_ROOT/baseline" -maxdepth 1 -name "*.sql" | sort
        find "$FIXTURE_ROOT/golden_path" -maxdepth 1 -name "*.sql" | sort
      }
      ;;
  esac
}

mapfile -t SEED_FILES < <(collect_seed_files "$DATASET")

if [[ "${#SEED_FILES[@]}" -eq 0 ]]; then
  echo "No seed files found for dataset '$DATASET'." >&2
  exit 1
fi

if [[ "$DRY_RUN" == "true" ]]; then
  for file in "${SEED_FILES[@]}"; do
    echo "-- FILE: ${file#$ROOT_DIR/}"
    cat "$file"
    echo
  done
  exit 0
fi

DB_URL="${LOOP_DB_URL:-${SUPABASE_DB_URL:-${DATABASE_URL:-}}}"
if [[ -z "$DB_URL" ]]; then
  echo "Missing database URL. Set LOOP_DB_URL, SUPABASE_DB_URL, or DATABASE_URL." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to run db:seed." >&2
  exit 1
fi

RUNTIME_ENV="$(echo "${LOOP_ENV:-${APP_ENV:-${NODE_ENV:-}}}" | tr '[:upper:]' '[:lower:]')"
if [[ "$RUNTIME_ENV" == "production" && "${LOOP_DB_ALLOW_PROD_SEED:-false}" != "true" ]]; then
  echo "Refusing to run db:seed in production context. Set LOOP_DB_ALLOW_PROD_SEED=true to override." >&2
  exit 1
fi

{
  echo "BEGIN;"
  for file in "${SEED_FILES[@]}"; do
    echo "\\i $file"
  done
  echo "COMMIT;"
} | psql "$DB_URL" -v ON_ERROR_STOP=1 -X

echo "Seeded dataset '$DATASET' from ${#SEED_FILES[@]} fixture file(s)."
