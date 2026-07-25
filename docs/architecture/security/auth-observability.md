# Auth/Authz Observability Baseline

**Version:** 1.0  
**Sprint:** 26  
**Last updated:** 2026-07-25

---

## Scope

This hardening baseline covers:

- Structured auth/session/authorization lifecycle logs
- Correlation/request IDs across authz decisions
- Auth failure metrics for dashboards
- Alert thresholds for abnormal spikes
- Log redaction requirements

---

## Structured Event Schema

Every auth observability event uses:

- `category` = `auth_observability`
- `schemaVersion` = `1.0`
- `timestamp` (ISO-8601)
- `event`
- `outcome`
- `route`
- `statusCode`
- `requestId`
- `correlationId`
- `userId` (when known)
- `role` (when known)
- `errorCode` (for failures)
- `details` (redacted)

Events currently emitted:

- `sign_in_success`
- `sign_in_failure`
- `sign_out`
- `session_refresh_success`
- `session_refresh_failure`
- `authz_decision_allow`
- `unauthorized_access_attempt`

---

## Metrics

Counters emitted in-process:

- `auth_401_total` (tagged by route)
- `auth_403_total` (tagged by route)
- `auth_sign_in_failure_total` (tagged by route, usually `/sign-in`)
- `auth_session_refresh_failure_total` (tagged by route)

Every auth counter now also carries an auth-failure category label (for example `expired_token`, `missing_token`, or `insufficient_permission`) so dashboards can split spikes by both route and failure class.

Suggested dashboard panels:

1. 401 rate by route + category (5m/1h trend)
2. 403 rate by route + category (5m/1h trend)
3. Sign-in failure rate (5m/1h trend)
4. Session refresh failures by route

Dashboard links (wire to your monitoring tenant):

- Primary dashboard: `https://<monitoring-host>/dashboards/auth-authz-overview`
- Alert board: `https://<monitoring-host>/alerts/auth-authz`

---

## Alert Thresholds

Current default thresholds:

- `auth_401_total` ≥ 25 per route/category over 5 minutes
- `auth_403_total` ≥ 25 per route/category over 5 minutes
- `auth_sign_in_failure_total` ≥ 10 over 10 minutes
- `auth_session_refresh_failure_total` ≥ 10 over 10 minutes

When a threshold is crossed, `AUTH_ALERT` structured warnings are emitted.

---

## Redaction Policy

Never log raw:

- tokens, refresh tokens, session identifiers
- passwords, secrets, authorization/cookie values
- direct PII fields (email, phone, address, SSN)

Redaction is recursive and key-based in `src/lib/observability/auth.ts`.

---

## Validation Checklist

- Simulate anonymous API requests and confirm 401 logs + counters by route.
- Simulate permission-denied API requests and confirm 403 logs + counters by route.
- Trigger controlled sign-in failures and confirm counter + threshold warnings.
- Verify `x-request-id` and `x-correlation-id` continuity in authz deny responses.
- Inspect sample logs and verify sensitive values are `[REDACTED]`.
