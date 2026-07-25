# Auth/Authz Observability Baseline

**Version:** 1.1  
**Sprint:** S3  
**Last updated:** 2026-07-25

---

## Scope

This hardening baseline covers:

- Structured auth/session/authorization lifecycle logs
- Correlation/request IDs across authz decisions
- Auth failure metrics for dashboards
- Alert thresholds for abnormal spikes
- Log redaction requirements
- Auth latency tracking

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
- `refreshOutcome` (for refresh events)
- `refreshAttempts` (for refresh events)
- `details` (redacted)

Events currently emitted:

- `sign_in_success`
- `sign_in_failure`
- `sign_out`
- `session_refresh_success`
- `session_refresh_failure`
- `authz_decision_allow`
- `authz_decision_deny`
- `unauthorized_access_attempt`

---

## Canonical Metrics

All metrics are emitted in-process via `incrementAuthMetric()` in `src/lib/observability/auth.ts`.

### Login
| Metric | Description |
|---|---|
| `auth_login_success_total` | Successful sign-in events |
| `auth_sign_in_failure_total` | Failed sign-in events |

### Refresh — Aggregate
| Metric | Description |
|---|---|
| `auth_session_refresh_failure_total` | Aggregate session refresh failures (all causes) |
| `auth_refresh_success_total` | Successful token refresh events |

### Refresh — Resolution Breakdown
| Metric | Description |
|---|---|
| `auth_refresh_expired_total` | Refresh failed: token expired |
| `auth_refresh_revoked_total` | Refresh failed: token revoked |
| `auth_refresh_replay_denied_total` | Refresh failed: replay/reuse detected |
| `auth_refresh_concurrency_conflict_total` | Refresh failed: concurrent conflict |
| `auth_refresh_malformed_total` | Refresh failed: malformed or invalid JWT |

### Authorization
| Metric | Description |
|---|---|
| `auth_401_total` | HTTP 401 responses emitted (tagged by route, category) |
| `auth_403_total` | HTTP 403 responses emitted (tagged by route, category) |
| `auth_authz_allow_total` | Successful authorization decisions |

### Session Lifecycle
| Metric | Description |
|---|---|
| `auth_session_created_total` | New session created events |
| `auth_session_refreshed_total` | Session refresh success events |
| `auth_session_rotated_total` | Session token rotation events |
| `auth_session_revoked_total` | Session revocation events |
| `auth_session_expired_total` | Session expiry events |

### Performance
Auth latency is tracked with `recordAuthDuration()` and queried with `getAuthLatencyPercentiles()`.

| Label | Description |
|---|---|
| `session_refresh` | End-to-end latency of `getAuthSession()` |
| `api_guard` | End-to-end latency of `requireApiSession()` |
| `permission_check` | End-to-end latency of `requirePermission()` |

Every counter also carries a `category` label (for example `expired_token`, `revoked_session`, `insufficient_permission`) so dashboards can split spikes by both route and failure class.

---

## Alert Thresholds

Current default thresholds:

| Metric | Threshold | Window |
|---|---|---|
| `auth_401_total` | ≥ 25 per route/category | 5 minutes |
| `auth_403_total` | ≥ 25 per route/category | 5 minutes |
| `auth_sign_in_failure_total` | ≥ 10 | 10 minutes |
| `auth_session_refresh_failure_total` | ≥ 10 | 10 minutes |
| `auth_refresh_expired_total` | ≥ 20 per route/category | 5 minutes |
| `auth_refresh_revoked_total` | ≥ 10 per route/category | 5 minutes |
| `auth_refresh_replay_denied_total` | ≥ 5 per route/category | 5 minutes |
| `auth_refresh_concurrency_conflict_total` | ≥ 15 per route/category | 5 minutes |
| `auth_latency_ms` p99 | > 2000ms | rolling (≥ 20 samples) |

When a threshold is crossed, `AUTH_ALERT` structured warnings are emitted.

All alerts deduplicate within the same bucket and window to minimize alert fatigue.

See [Auth Dashboard & Alerting Configuration](auth-dashboard.md) for full panel and alert definitions.

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
- Trigger refresh failures and confirm resolution-specific counters (`expired`, `revoked`, `replay_denied`, `concurrency_conflict`).
- Verify `x-request-id` and `x-correlation-id` continuity in authz deny responses.
- Inspect sample logs and verify sensitive values are `[REDACTED]`.
- Verify latency samples accumulate and `getAuthLatencyPercentiles()` returns valid percentiles.
- Verify alert deduplication: crossing a threshold twice in the same window produces exactly one `AUTH_ALERT` log line.
