#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
RESET_ROOT="$ROOT_DIR/database/fixtures/reset"
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

collect_reset_files() {
  local dataset="$1"
  case "$dataset" in
    baseline)
      find "$RESET_ROOT" -maxdepth 1 -name "20_baseline.sql" | sort
      ;;
    golden_path)
      find "$RESET_ROOT" -maxdepth 1 -name "10_golden_path.sql" | sort
      ;;
    all)
      find "$RESET_ROOT" -maxdepth 1 -name "*.sql" | sort
      ;;
  esac
}

mapfile -t RESET_FILES < <(collect_reset_files "$DATASET")

if [[ "${#RESET_FILES[@]}" -eq 0 ]]; then
  echo "No reset files found for dataset '$DATASET'." >&2
  exit 1
fi

if [[ "$DRY_RUN" == "true" ]]; then
  for file in "${RESET_FILES[@]}"; do
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
  echo "psql is required to run db:reset." >&2
  exit 1
fi

RUNTIME_ENV="$(echo "${LOOP_ENV:-${APP_ENV:-${NODE_ENV:-}}}" | tr '[:upper:]' '[:lower:]')"
if [[ "$RUNTIME_ENV" == "production" || "$DB_URL" == *"prod"* ]]; then
  if [[ "${LOOP_DB_ALLOW_PROD_RESET:-false}" != "true" ]]; then
    echo "Refusing destructive db:reset in production context. Set LOOP_DB_ALLOW_PROD_RESET=true to override." >&2
    exit 1
  fi
fi

{
  echo "BEGIN;"
  for file in "${RESET_FILES[@]}"; do
    echo "\\i $file"
  done
  echo "COMMIT;"
} | psql "$DB_URL" -v ON_ERROR_STOP=1 -X

echo "Reset dataset '$DATASET' from ${#RESET_FILES[@]} fixture file(s)."
