# Auth Dashboard & Alerting Configuration

**Version:** 1.0  
**Sprint:** S3  
**Last updated:** 2026-07-25

---

## Overview

This document defines the canonical auth observability dashboard panels, alert rules, and thresholds for the LOOP authentication and session reliability layer.

All metrics are emitted in-process via `src/lib/observability/auth.ts`. Panels and alerts are wired to your monitoring tenant using the structured log stream tagged `category=auth_observability` and `category=authz_decision`.

---

## Dashboard Panels

### Panel 1 — Login Success Rate

| Property | Value |
|---|---|
| Type | Time series |
| Metric | `auth_login_success_total` vs `auth_sign_in_failure_total` |
| Aggregation | Count per 5m window |
| Split by | `route` |
| Threshold line | Failure rate > 5% |

**Interpretation:** Success rate should be > 95% under normal conditions. Any sustained inversion (more failures than successes) indicates a sign-in flow failure.

---

### Panel 2 — Refresh Success Rate

| Property | Value |
|---|---|
| Type | Time series |
| Metric | `auth_refresh_success_total` / (`auth_refresh_success_total` + all failure counters) |
| Aggregation | Rate per 5m window |
| Split by | `route` |

**Interpretation:** Refresh success rate should be above 98% in steady state. Any dip warrants investigation.

---

### Panel 3 — Refresh Failure Breakdown

| Property | Value |
|---|---|
| Type | Stacked bar / time series |
| Metrics | `auth_refresh_expired_total`, `auth_refresh_revoked_total`, `auth_refresh_replay_denied_total`, `auth_refresh_concurrency_conflict_total`, `auth_refresh_malformed_total`, `auth_session_refresh_failure_total` |
| Aggregation | Count per 5m window |
| Split by | metric name, `route` |

**Interpretation:**  
- Expired spike → token lifetime or clock skew issue.  
- Revoked spike → admin action or security event.  
- Replay denied spike → concurrent client refresh or token theft risk.  
- Concurrency conflict spike → client retry logic generating parallel refresh requests.  
- Malformed spike → JWT signing or network corruption issue.

---

### Panel 4 — 401 Trend

| Property | Value |
|---|---|
| Type | Time series |
| Metric | `auth_401_total` |
| Aggregation | Count per 5m window |
| Split by | `route`, `category` (auth reason: `expired_token`, `missing_token`, `revoked_session`, `missing_role`, `invalid_token`) |

**Interpretation:** Near-zero in steady state. Any sustained spike indicates auth failures by route. `missing_token` is the most common for unauthenticated access; other reasons indicate session lifecycle issues.

---

### Panel 5 — 403 Trend

| Property | Value |
|---|---|
| Type | Time series |
| Metric | `auth_403_total` |
| Aggregation | Count per 5m window |
| Split by | `route`, `category` |

**Interpretation:** Near-zero in steady state. Any spike above baseline requires immediate policy review — do not change permission rules without diagnosing which role/route pair is affected.

---

### Panel 6 — Authorization Allow/Deny

| Property | Value |
|---|---|
| Type | Time series (two lines) |
| Metrics | `auth_authz_allow_total`, `auth_401_total` + `auth_403_total` |
| Aggregation | Count per 5m window |

**Interpretation:** Allow rate should dominate. If deny rate approaches allow rate, the auth pipeline is broadly broken. Useful for detecting sudden policy regressions that affect all roles.

---

### Panel 7 — Session Lifecycle

| Property | Value |
|---|---|
| Type | Stacked bar / time series |
| Metrics | `auth_session_created_total`, `auth_session_refreshed_total`, `auth_session_rotated_total`, `auth_session_revoked_total`, `auth_session_expired_total` |
| Aggregation | Count per 15m window |

**Interpretation:** Created and refreshed should correlate with active usage. Revoked spikes require security review. Expired spikes without corresponding refresh success indicate TTL or connectivity issues.

---

### Panel 8 — Authentication Latency

| Property | Value |
|---|---|
| Type | Time series (three lines: p50, p95, p99) |
| Source | `AUTH_ALERT` log events with `metric=auth_latency_ms` + app-side `getAuthLatencyPercentiles()` |
| Labels | `session_refresh`, `api_guard`, `permission_check` |
| SLA thresholds | p50 < 100ms, p95 < 500ms, p99 < 2000ms |

**Interpretation:**  
- p99 crossing 2000ms fires an `AUTH_ALERT` automatically.  
- p95 degrading without p99 alert: watch closely, investigate Supabase and network health.  
- `permission_check` latency higher than `api_guard`: indicates the Supabase client or role extraction path is slow.

---

## Alert Rules

All alerts point to this runbook: `docs/runbooks/auth-authz-incidents.md`.

### Alert 1 — Refresh Failure Spike

| Property | Value |
|---|---|
| Trigger | `auth_refresh_expired_total` ≥ 20 in any 5-minute window per route/category |
| Severity | Warning |
| Deduplication window | 5 minutes (re-alerts suppressed in same window) |
| Runbook section | §B |
| Message | "Refresh token expiry spike on `{route}` — check session TTL, Supabase connectivity, and token lifetime configuration." |

### Alert 2 — Revoked Session Spike

| Property | Value |
|---|---|
| Trigger | `auth_refresh_revoked_total` ≥ 10 in any 5-minute window |
| Severity | Critical |
| Deduplication window | 5 minutes |
| Runbook section | §B, §E |
| Message | "Revoked session spike — potential key rotation event or security incident. Verify Supabase admin actions immediately." |

### Alert 3 — Replay Denied Spike

| Property | Value |
|---|---|
| Trigger | `auth_refresh_replay_denied_total` ≥ 5 in any 5-minute window |
| Severity | Critical |
| Deduplication window | 5 minutes |
| Runbook section | §E |
| Message | "Refresh token replay denial spike — investigate for concurrent client refresh logic errors or potential token reuse/theft." |

### Alert 4 — Concurrency Conflict Spike

| Property | Value |
|---|---|
| Trigger | `auth_refresh_concurrency_conflict_total` ≥ 15 in any 5-minute window |
| Severity | Warning |
| Deduplication window | 5 minutes |
| Runbook section | §B |
| Message | "Concurrent refresh conflict spike — review client-side session refresh concurrency." |

### Alert 5 — 401 Rate Spike

| Property | Value |
|---|---|
| Trigger | `auth_401_total` ≥ 25 per route/category in any 5-minute window |
| Severity | Warning |
| Deduplication window | 5 minutes |
| Runbook section | §C |
| Message | "Elevated 401 rate on `{route}` ({category}) — investigate auth guard and session refresh pipeline." |

### Alert 6 — 403 Rate Spike

| Property | Value |
|---|---|
| Trigger | `auth_403_total` ≥ 25 per route/category in any 5-minute window |
| Severity | Warning |
| Deduplication window | 5 minutes |
| Runbook section | §C |
| Message | "Elevated 403 rate on `{route}` — do not change permission policy without diagnosing role and route intent." |

### Alert 7 — Sign-in Failure Spike

| Property | Value |
|---|---|
| Trigger | `auth_sign_in_failure_total` ≥ 10 in any 10-minute window |
| Severity | Warning |
| Deduplication window | 10 minutes |
| Runbook section | §A |
| Message | "Sign-in failure spike — verify Supabase Auth status and credentials flow." |

### Alert 8 — Session Refresh Failure Spike

| Property | Value |
|---|---|
| Trigger | `auth_session_refresh_failure_total` ≥ 10 in any 10-minute window |
| Severity | Warning |
| Deduplication window | 10 minutes |
| Runbook section | §B |
| Message | "Session refresh failure spike — check Supabase connectivity and environment configuration." |

### Alert 9 — Auth Latency Regression

| Property | Value |
|---|---|
| Trigger | `auth_latency_ms` p99 > 2000ms (emitted as `AUTH_ALERT` log event) |
| Severity | Warning |
| Deduplication window | Per `recordAuthDuration` alert cooldown |
| Runbook section | §D |
| Message | "Auth latency p99 regression on `{label}` — investigate Supabase Auth response times and network health." |

---

## Alert Fatigue Mitigation

- All in-process alerts deduplicate within the same `{metric}::{route}::{category}` bucket and suppress re-alerts within the same window.
- Alerts are structured JSON emitted as `[AUTH_ALERT]` log lines — integrate with your log-based alerting system to avoid duplicate PagerDuty/Slack notifications.
- Alert severity levels: `warning` for expected operational spikes, `critical` for security-relevant events (replay, revoked).
- Latency alerts require at least 20 samples before firing to avoid noise from cold starts.

---

## Diagnostic Context in Alerts

Every `AUTH_ALERT` log event includes:

```json
{
  "category": "auth_observability",
  "schemaVersion": "1.0",
  "timestamp": "<ISO-8601>",
  "metric": "<metric_name>",
  "route": "<route>",
  "authCategory": "<category>",
  "count": <count>,
  "threshold": <threshold>,
  "windowMs": <windowMs>,
  "severity": "warning"
}
```

For latency alerts, `label` replaces `authCategory` and `p99` / `sampleCount` are included.

---

## Synthetic Auth Events (Validation)

To validate dashboard wiring and alert delivery without triggering real failures:

1. In a staging environment, emit a controlled `AUTH_ALERT` log line using `incrementAuthMetric` to cross a threshold.
2. Verify the alert appears in your monitoring tenant within 30 seconds.
3. Verify deduplication: cross the same threshold again in the same window — no second alert should fire.
4. Verify alert content includes the metric, route, category, and count fields.

---

## Related Documents

- [Auth/Authz Production Incident Runbook](../runbooks/auth-authz-incidents.md)
- [Auth/Authz Observability Baseline](auth-observability.md)
- [RLS Role Matrix](rls-role-matrix.md)
