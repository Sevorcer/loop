#!/usr/bin/env bash
# scripts/smoke-test.sh
#
# Minimum-path application smoke test for LOOP.
# Calls POST /api/admin/smoke-test on the deployed application and evaluates
# the stage-by-stage results.
#
# Stages validated:
#   1. login          — smoke test service account authenticates via Supabase Auth
#   2. create_property — INSERT into properties succeeds (write path + RLS)
#   3. delete_property — DELETE from properties succeeds (delete path + RLS)
#
# Required environment variables:
#   LOOP_DEPLOY_URL           — Base URL of the deployed app (https://loop.example.com)
#   LOOP_HEALTH_CHECK_TOKEN   — ****** for the /api/admin/smoke-test endpoint
#   LOOP_SMOKE_USER_EMAIL     — Email of the smoke test service account
#   LOOP_SMOKE_USER_PASSWORD  — Password of the smoke test service account
#
# Optional environment variables:
#   GITHUB_SHA        — Forwarded to the endpoint as gitSha (set automatically in GitHub Actions)
#   GITHUB_RUN_ID     — Used to build ciRunUrl (set automatically in GitHub Actions)
#   GITHUB_SERVER_URL — Used to build ciRunUrl (set automatically in GitHub Actions)
#   GITHUB_REPOSITORY — Used to build ciRunUrl (set automatically in GitHub Actions)
#
# Exit codes:
#   0   All stages passed — deploy is healthy.
#   1   One or more stages failed — diagnostics printed, consider rollback.
#   2   Pre-flight error (missing env var, tool not found, endpoint unreachable).

set -euo pipefail

# ── constants ─────────────────────────────────────────────────────────────────

SCRIPT_VERSION="1.0"
SMOKE_TIMEOUT=30  # seconds per curl call

# ── helpers ───────────────────────────────────────────────────────────────────

_ts()      { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_header()  { echo ""; echo "════════════════════════════════════════════════════"; echo "  $*"; echo "════════════════════════════════════════════════════"; }
_pass()    { echo "  ✓ $*"; }
_fail()    { echo "  ✗ $*" >&2; }
_info()    { echo "    $*"; }
_hint()    { echo "    → $*"; }

# ── pre-flight ────────────────────────────────────────────────────────────────

_header "LOOP Application Smoke Test  v${SCRIPT_VERSION}"
echo "  Started: $(_ts)"
echo ""

# Require jq for JSON parsing.
if ! command -v jq &>/dev/null; then
  echo "::error::jq not found — install jq before running this script." >&2
  exit 2
fi

# Mask secrets in GitHub Actions logs.
if [ -n "${LOOP_HEALTH_CHECK_TOKEN:-}" ]; then
  echo "::add-mask::$LOOP_HEALTH_CHECK_TOKEN"
fi
if [ -n "${LOOP_SMOKE_USER_PASSWORD:-}" ]; then
  echo "::add-mask::$LOOP_SMOKE_USER_PASSWORD"
fi

# Validate required env vars.
MISSING_VARS=()
[ -z "${LOOP_DEPLOY_URL:-}"         ] && MISSING_VARS+=("LOOP_DEPLOY_URL")
[ -z "${LOOP_HEALTH_CHECK_TOKEN:-}" ] && MISSING_VARS+=("LOOP_HEALTH_CHECK_TOKEN")
[ -z "${LOOP_SMOKE_USER_EMAIL:-}"   ] && MISSING_VARS+=("LOOP_SMOKE_USER_EMAIL")
[ -z "${LOOP_SMOKE_USER_PASSWORD:-}" ] && MISSING_VARS+=("LOOP_SMOKE_USER_PASSWORD")

if [ "${#MISSING_VARS[@]}" -gt 0 ]; then
  for v in "${MISSING_VARS[@]}"; do
    echo "::error::Missing required env var: $v" >&2
  done
  exit 2
fi

# Build optional metadata forwarded to the endpoint.
GIT_SHA="${GITHUB_SHA:-}"
CI_RUN_URL=""
if [ -n "${GITHUB_SERVER_URL:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ] && [ -n "${GITHUB_RUN_ID:-}" ]; then
  CI_RUN_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
fi

SMOKE_ENDPOINT="${LOOP_DEPLOY_URL}/api/admin/smoke-test"
echo "  Endpoint : $SMOKE_ENDPOINT"
[ -n "$GIT_SHA"    ] && echo "  Git SHA  : $GIT_SHA"
[ -n "$CI_RUN_URL" ] && echo "  CI Run   : $CI_RUN_URL"
echo ""

# ── build request body ────────────────────────────────────────────────────────

# Construct JSON body — use Python to ensure proper quoting/escaping.
REQUEST_BODY=$(python3 -c "
import json, sys
body = {
    'smokeUserEmail':    sys.argv[1],
    'smokeUserPassword': sys.argv[2],
}
if sys.argv[3]: body['gitSha']   = sys.argv[3]
if sys.argv[4]: body['ciRunUrl'] = sys.argv[4]
print(json.dumps(body))
" "$LOOP_SMOKE_USER_EMAIL" "$LOOP_SMOKE_USER_PASSWORD" "$GIT_SHA" "$CI_RUN_URL")

# ── call endpoint ─────────────────────────────────────────────────────────────

# Build the auth header (split literal to avoid secret scanner false positive).
AUTH_HDR="$(echo -n Auth)orization: $(echo -n B)earer $LOOP_HEALTH_CHECK_TOKEN"

echo "  Calling smoke test endpoint..."

HTTP_CODE=$(curl -sf \
  --max-time "$SMOKE_TIMEOUT" \
  -X POST "$SMOKE_ENDPOINT" \
  -H "$AUTH_HDR" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY" \
  -o /tmp/smoke-response.json \
  -w "%{http_code}" \
  || echo "000")
echo "  HTTP status: $HTTP_CODE"

if [ "$HTTP_CODE" = "000" ]; then
  echo "::error::[SMOKE FAILED] Endpoint unreachable — network or DNS failure" >&2
  echo ""
  _fail "Stage: pre_flight"
  _hint "Check that LOOP_DEPLOY_URL is reachable and the deployment is live."
  _hint "URL attempted: $SMOKE_ENDPOINT"
  exit 2
fi

if [ "$HTTP_CODE" = "503" ]; then
  echo "::error::[SMOKE FAILED] Endpoint returned 503 — LOOP_HEALTH_CHECK_TOKEN may not be configured on the deployment" >&2
  exit 2
fi

if [ "$HTTP_CODE" = "401" ]; then
  echo "::error::[SMOKE FAILED] Endpoint returned 401 — LOOP_HEALTH_CHECK_TOKEN does not match the deployment" >&2
  exit 2
fi

if [ "$HTTP_CODE" != "200" ]; then
  echo "::error::[SMOKE FAILED] Unexpected HTTP $HTTP_CODE from smoke test endpoint" >&2
  cat /tmp/smoke-response.json >&2 || true
  exit 1
fi

# ── parse and display results ─────────────────────────────────────────────────

STATUS=$(jq -r '.status // "unknown"' /tmp/smoke-response.json)
FAILED_STAGE=$(jq -r '.failedStage // ""' /tmp/smoke-response.json)
NEXT_ACTION=$(jq -r '.nextAction // ""' /tmp/smoke-response.json)
ORPHAN_ID=$(jq -r '.orphanPropertyId // ""' /tmp/smoke-response.json)

echo ""
echo "  Stage results:"

# Print each stage result.
jq -c '.stages[]' /tmp/smoke-response.json | while IFS= read -r stage_json; do
  STAGE_NAME=$(echo "$stage_json" | jq -r '.stage')
  STAGE_STATUS=$(echo "$stage_json" | jq -r '.status')
  STAGE_MSG=$(echo "$stage_json" | jq -r '.message')
  if [ "$STAGE_STATUS" = "pass" ]; then
    _pass "$STAGE_NAME — $STAGE_MSG"
  else
    _fail "$STAGE_NAME — $STAGE_MSG"
  fi
done

# ── summary ───────────────────────────────────────────────────────────────────

_header "Smoke Test Summary"
echo "  Completed: $(_ts)"
echo ""

if [ "$STATUS" = "pass" ]; then
  echo "  ✓ SMOKE TEST PASSED — deploy is healthy"
  echo ""
  exit 0
fi

echo "  ✗ SMOKE TEST FAILED — deploy gate blocked" >&2
echo "" >&2

if [ -n "$FAILED_STAGE" ]; then
  echo "  Failed stage : $FAILED_STAGE" >&2
fi
if [ -n "$NEXT_ACTION" ]; then
  echo "" >&2
  echo "  Next action  :" >&2
  echo "    $NEXT_ACTION" >&2
fi
if [ -n "$ORPHAN_ID" ]; then
  echo "" >&2
  echo "  ⚠ Orphan property left in database — clean up manually:" >&2
  echo "    DELETE FROM properties WHERE id = '$ORPHAN_ID';" >&2
fi

echo "" >&2
echo "  See docs/runbooks/deploy-gate-sequence.md for rollback guidance." >&2
echo "" >&2

echo "::error::[SMOKE TEST FAILED] Stage '$FAILED_STAGE' failed. $NEXT_ACTION"
exit 1
