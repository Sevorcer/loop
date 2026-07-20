#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
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

if [[ "$DRY_RUN" == "true" ]]; then
  echo "-- RESET PHASE"
  bash "$SCRIPT_DIR/reset.sh" --dataset "$DATASET" --dry-run
  echo "-- SEED PHASE"
  bash "$SCRIPT_DIR/seed.sh" --dataset "$DATASET" --dry-run
  exit 0
fi

bash "$SCRIPT_DIR/reset.sh" --dataset "$DATASET"
bash "$SCRIPT_DIR/seed.sh" --dataset "$DATASET"
