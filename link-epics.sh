#!/usr/bin/env bash
set -euo pipefail

REPO="Sevorcer/loop"

echo "==> Linking sprint child issues to sprint epics"

for i in {27..36}; do
  SPRINT_LABEL="sprint-$i"

  # Find epic issue number for this sprint
  EPIC_NUM=$(gh issue list \
    --repo "$REPO" \
    --state open \
    --label "epic" \
    --search "in:title EPIC: Sprint $i" \
    --limit 10 \
    --json number,title \
    --jq 'map(select(.title|test("^EPIC: Sprint '"$i"'"))) | .[0].number')

  if [[ -z "${EPIC_NUM:-}" || "${EPIC_NUM}" == "null" ]]; then
    echo "No epic found for Sprint $i, skipping."
    continue
  fi

  echo "Sprint $i epic: #$EPIC_NUM"

  # Get all open sprint issues excluding epics
  CHILD_ISSUES=$(gh issue list \
    --repo "$REPO" \
    --state open \
    --label "$SPRINT_LABEL" \
    --limit 200 \
    --json number,title,labels \
    --jq '.[] | select([.labels[].name] | index("epic") | not) | .number')

  if [[ -z "${CHILD_ISSUES:-}" ]]; then
    echo "No child issues found for Sprint $i"
    continue
  fi

  while IFS= read -r ISSUE_NUM; do
    [[ -z "$ISSUE_NUM" ]] && continue

    BODY=$(gh issue view "$ISSUE_NUM" --repo "$REPO" --json body --jq '.body // ""')

    if grep -qE "Epic:\s*#${EPIC_NUM}\b" <<< "$BODY"; then
      echo "Issue #$ISSUE_NUM already linked to epic #$EPIC_NUM"
      continue
    fi

    # Remove any old Epic: lines to avoid duplicates/wrong links
    CLEAN_BODY=$(printf "%s" "$BODY" | sed '/^Epic:\s*#\([0-9]\+\)\s*$/d')

    if [[ -z "$CLEAN_BODY" ]]; then
      NEW_BODY="Epic: #$EPIC_NUM"
    else
      NEW_BODY="${CLEAN_BODY}"$'\n\n'"Epic: #$EPIC_NUM"
    fi

    gh issue edit "$ISSUE_NUM" --repo "$REPO" --body "$NEW_BODY" >/dev/null
    echo "Linked issue #$ISSUE_NUM -> epic #$EPIC_NUM"
  done <<< "$CHILD_ISSUES"

done

echo "✅ Done. Child issues now reference their sprint epic."
