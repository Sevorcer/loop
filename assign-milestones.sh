#!/usr/bin/env bash
set -euo pipefail

REPO="Sevorcer/loop"

# Optional due dates (edit or leave blank "")
# Format: YYYY-MM-DD
declare -A DUE_DATES=(
  [27]=""
  [28]=""
  [29]=""
  [30]=""
  [31]=""
  [32]=""
  [33]=""
  [34]=""
  [35]=""
  [36]=""
)

echo "==> Creating milestones Sprint 27..36 if missing"

for i in {27..36}; do
  TITLE="Sprint $i"
  DESC="Execution scope for Sprint $i"

  # Check if milestone already exists
  MILESTONE_NUMBER=$(gh api "repos/$REPO/milestones?state=all&per_page=100" \
    --jq ".[] | select(.title==\"$TITLE\") | .number" || true)

  if [[ -n "${MILESTONE_NUMBER:-}" ]]; then
    echo "Milestone exists: $TITLE (#$MILESTONE_NUMBER)"
  else
    DUE="${DUE_DATES[$i]}"
    if [[ -n "$DUE" ]]; then
      gh api "repos/$REPO/milestones" \
        -f title="$TITLE" \
        -f description="$DESC" \
        -f due_on="${DUE}T23:59:59Z" >/dev/null
    else
      gh api "repos/$REPO/milestones" \
        -f title="$TITLE" \
        -f description="$DESC" >/dev/null
    fi
    echo "Created milestone: $TITLE"
  fi
done

echo "==> Assigning issues to milestones by sprint label"

for i in {27..36}; do
  LABEL="sprint-$i"
  TITLE="Sprint $i"

  # Get milestone number
  MNUM=$(gh api "repos/$REPO/milestones?state=all&per_page=100" \
    --jq ".[] | select(.title==\"$TITLE\") | .number")

  if [[ -z "${MNUM:-}" ]]; then
    echo "Skipping $TITLE (milestone not found)"
    continue
  fi

  # Fetch open issues with that label (exclude PRs)
  ISSUE_NUMBERS=$(gh issue list \
    --repo "$REPO" \
    --state open \
    --label "$LABEL" \
    --limit 200 \
    --json number \
    --jq '.[].number')

  if [[ -z "${ISSUE_NUMBERS:-}" ]]; then
    echo "No open issues with label $LABEL"
    continue
  fi

  while IFS= read -r num; do
    [[ -z "$num" ]] && continue
    gh api "repos/$REPO/issues/$num" -X PATCH -f milestone="$MNUM" >/dev/null
    echo "Assigned issue #$num -> $TITLE"
  done <<< "$ISSUE_NUMBERS"
done

echo "✅ Done. Milestones created and labeled issues assigned."
