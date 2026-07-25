# Runbook: Auth/Authz Production Incidents

Version: 1.2  
Last reviewed: 2026-07-25  
Owner: Engineering on-call  
Severity scope: P0 / P1 authentication and authorization incidents

---

## Purpose

Triage and recover from production incidents involving:

- sign-in failures
- session refresh failures
- spikes in 401/403 responses
- unexpected permission denials
- auth latency regressions

---

## Dashboard Interpretation

### Login Success Rate
Shows `auth_login_success_total` vs `auth_sign_in_failure_total` over time.

- **Normal:** High success rate, near-zero failures.
- **Degraded:** Failure rate rising without a corresponding success rate — indicates credential problems, Supabase Auth outage, or misconfigured sign-in flow.
- **Action:** Check `sign_in_failure` logs for dominant `errorCode`. Validate Supabase Auth status.

### Refresh Success Rate
Shows `auth_refresh_success_total` vs aggregate refresh failures over time.

- **Normal:** Refresh success rate near 100%.
- **Degraded:** Any sustained failure rate — even 1-2% — warrants investigation.
- **Action:** Pivot to the Refresh Failure Breakdown panel to identify which failure class is rising.

### Refresh Failure Breakdown
Shows individual resolution counters: `auth_refresh_expired_total`, `auth_refresh_revoked_total`, `auth_refresh_replay_denied_total`, `auth_refresh_concurrency_conflict_total`, `auth_refresh_malformed_total`.

- **Expired spike:** Users are holding sessions past their TTL — check token lifetime config or Supabase key rotation.
- **Revoked spike:** Tokens are being revoked — check for Supabase admin actions, key rotation, or security incident.
- **Replay denied spike:** Refresh reuse detected — could indicate token theft, misconfigured client refresh logic, or concurrent requests sharing a token.
- **Concurrency conflict spike:** Parallel refresh requests — check client retry logic and Supabase concurrent session settings.
- **Malformed spike:** Tokens are being corrupted or forged — check signing key configuration and network proxies.

### 401 Trend
Shows `auth_401_total` by route and reason category over time.

- **Normal:** Near-zero, confined to expected unauthenticated access patterns.
- **Action:** Identify the dominant reason (`missing_token`, `expired_token`, `revoked_session`). Correlate with refresh failure breakdown.

### 403 Trend
Shows `auth_403_total` by route and category over time.

- **Normal:** Very low — only expected for legitimate role-boundary probing.
- **Spike:** Indicates a role regression (wrong role resolved, permission matrix change, or RLS mismatch).
- **Action:** Inspect `authz_decision` logs with `decision=deny` and `reason_code=PERMISSION_DENIED`. Compare role, route, and action against the permission matrix.

### Authorization Allow/Deny
Shows `auth_authz_allow_total` vs (`auth_401_total` + `auth_403_total`) over time.

- **Normal:** Allow rate dominates — denies should be negligible.
- **Inverted ratio:** If deny rate approaches allow rate, auth flow is broadly broken.
- **Action:** Immediately check recent deploys for auth guard or role-resolution regressions.

### Session Lifecycle
Shows `auth_session_created_total`, `auth_session_refreshed_total`, `auth_session_rotated_total`, `auth_session_revoked_total`, `auth_session_expired_total`.

- **Expired spike without corresponding refresh success:** Sessions are expiring faster than they can be refreshed — check token lifetime and client refresh timing.
- **Revoked spike:** Admin action or security incident; escalate immediately.

### Authentication Latency
Shows p50/p95/p99 from `session_refresh`, `api_guard`, and `permission_check` latency labels.

- **p99 > 2000ms:** AUTH_ALERT fires automatically. Indicates Supabase Auth slowness, network issues, or resource contention.
- **p95 degraded without p99 alert:** Watch trend — investigate Supabase dashboard and network health before it worsens.

---

## First 15 Minutes Triage Checklist

Within the first 15 minutes of any P0/P1 auth incident:

**Minute 0-3 — Blast radius**
- [ ] Identify which routes are returning elevated 401/403 or refusing auth.
- [ ] Determine if the impact is internal users, portal users, or both.
- [ ] Determine if it's all users or a subset.

**Minute 3-6 — Dashboard read**
- [ ] Open the auth dashboard. Identify which metric is anomalous (401 vs 403 vs refresh failure vs latency).
- [ ] Note the time the anomaly began and whether it correlates with a deploy.
- [ ] Record the dominant `errorCode` or failure class.

**Minute 6-10 — Log correlation**
- [ ] Pull `category=auth_observability` structured logs for the anomaly window.
- [ ] Group by `event`, `route`, `errorCode`. Separate `MISSING_ROLE` from `PERMISSION_DENIED` from `session_refresh_failure`.
- [ ] Use `x-request-id` / `x-correlation-id` from a failing request to trace end-to-end.

**Minute 10-15 — Classify and act**
- [ ] Identity failure (`MISSING_ROLE`, session missing, env misconfiguration) → fix identity path, do not change authorization rules.
- [ ] Policy failure (`PERMISSION_DENIED`) → compare role, route, and permission matrix before any policy edit.
- [ ] Deployment regression → initiate rollback sequence if impact is sustained P0 > 10 minutes.
- [ ] Supabase Auth outage → check Supabase status page, prepare to route users to maintenance page.

---

## Failure Signatures

| Signature | Primary signals | Likely cause | First checks |
|---|---|---|---|
| `MISSING_ROLE` | `unauthorized_access_attempt`, 401 on protected API routes, rising `auth_401_total` | Role missing from validated session metadata or identity propagation path failed | Confirm active session, inspect user metadata/app metadata for `app_role`, verify recent auth deploys |
| `PERMISSION_DENIED` | `unauthorized_access_attempt`, 403 on known protected route, rising `auth_403_total` | Role resolved but permission matrix / route intent / RLS expectation does not match | Confirm role, route, table, action, then compare app permission matrix to expected RLS behavior |
| `SESSION_NOT_FOUND` / auth session missing errors | `session_refresh_failure`, repeated 401s after navigation or refresh | Expired session, missing cookies, Supabase auth outage, middleware refresh failure | Confirm cookie presence, recent sign-in success, Supabase auth health, and refresh errors by route |
| `SUPABASE_ENV_MISSING` / `SUPABASE_NOT_CONFIGURED` | sign-in or refresh failures across all routes, startup/runtime auth failures | Missing auth environment configuration | Verify runtime env vars and deployment configuration before deeper auth debugging |
| `EXPIRED_TOKEN` spike | Rising `auth_refresh_expired_total` | Token lifetime expiry, clock skew, or Supabase key rotation | Check token expiry config, Supabase key rotation events, and client refresh timing |
| `REVOKED_SESSION` spike | Rising `auth_refresh_revoked_total` | Supabase admin revocation, security event, or key rotation | Check Supabase admin actions and security alerts immediately |
| `REPLAY_DENIED` spike | Rising `auth_refresh_replay_denied_total` | Token reuse — concurrent client requests sharing a token, or possible token theft | Review client refresh logic for concurrent refresh, check for any security anomaly |
| Latency regression | p99 > 2s, AUTH_ALERT on `auth_latency_ms` | Supabase Auth slowness, DB saturation, or network issues | Check Supabase performance dashboard and network health |

---

## Fast Triage Flow

1. Confirm blast radius:
   - Which routes are impacted?
   - Internal users, portal users, or both?
2. Check auth dashboard:
   - 401/403 rate by route
   - sign-in failure rate
   - session refresh failure breakdown (expired/revoked/replay/concurrency/malformed)
   - auth latency p99 trend
3. Pull structured auth logs for the same time window:
   - Filter by `category=auth_observability`
   - Group by `event`, `route`, `errorCode`
   - Separate `MISSING_ROLE`, `PERMISSION_DENIED`, and session refresh failures before choosing a fix
4. Trace a failing request end-to-end:
   - Use `x-request-id` / `x-correlation-id`
   - Follow auth refresh + authz decision logs
5. Validate the identity path:
   - Confirm the user has a valid Supabase session
   - Confirm `app_role` is present in session metadata
   - In non-prod, use debug headers only to confirm local fallback behavior — never as a production fix
6. Validate the authorization path:
   - Confirm route → table/action mapping
   - Confirm the resolved role should be allowed by the application permission matrix
   - Confirm the expected DB/RLS behavior matches the application decision
7. Classify root cause:
   - auth provider outage / network issue
   - token/session lifecycle issue
   - missing identity propagation
   - permission policy regression
   - deployment/config regression

---

## Common Root Causes

### Expired Signing Keys
- **Symptom:** `REVOKED_SESSION` or `MALFORMED` spike; `auth_refresh_revoked_total` or `auth_refresh_malformed_total` rising.
- **Detection:** `session_refresh_failure` logs with `errorCode` containing `jwt`, `signature`, or `revoked`.
- **Mitigation:** Rotate Supabase JWT secret and re-issue tokens. All existing sessions will require fresh sign-in.
- **Prevention:** Monitor Supabase key rotation events. Alert on any `revoked` spike above threshold.

### Refresh Failures (General)
- **Symptom:** `auth_session_refresh_failure_total` rising; users getting 401 across multiple routes.
- **Detection:** `session_refresh_failure` events grouped by `refreshOutcome`.
- **Mitigation:** Depending on outcome — fix env config, roll back auth code change, or accept user re-authentication.

### Middleware/Guard Failures
- **Symptom:** All protected routes returning 401 suddenly. `auth_401_total` spike across multiple routes simultaneously.
- **Detection:** `unauthorized_access_attempt` events with `refreshOutcome=unknown_failure` across routes.
- **Mitigation:** Check recent auth guard or Supabase client configuration changes. Roll back if correlated with deploy.

### Session Propagation Failures
- **Symptom:** Users authenticate successfully but protected pages or API calls fail with 401.
- **Detection:** `sign_in_success` events followed by `session_refresh_failure` on subsequent requests.
- **Mitigation:** Inspect cookie handling, SSR session propagation, and Supabase server client configuration.

### RBAC/RLS Failures
- **Symptom:** `PERMISSION_DENIED` 403s on routes that should be allowed for the user's role.
- **Detection:** `authz_decision_deny` events where the role should have been allowed; cross-reference permission matrix.
- **Mitigation:** Do NOT change the permission matrix ad hoc. Identify the delta between expected and observed permission, then fix at the correct layer (app matrix or RLS policy).

### Profile Role Integrity Failures
- **Symptom:** `MISSING_ROLE` 401s despite user being authenticated and having a session.
- **Detection:** `unauthorized_access_attempt` with `errorCode=MISSING_ROLE`; user record may have `app_role=null` in metadata.
- **Mitigation:** Confirm user metadata on Supabase; resolve the null-role state at the identity layer. Never grant access ad hoc.

---

## Incident Playbooks

### A) Sign-in Failure Spike

- Confirm `auth_sign_in_failure_total` trend.
- Check dominant `errorCode` in `sign_in_failure` logs.
- Validate Supabase Auth status and credentials flow.
- If release-correlated, rollback to previous known good deployment.

### B) Session Refresh Failure Spike

- Confirm `auth_session_refresh_failure_total`.
- Pivot to resolution-specific metrics: `auth_refresh_expired_total`, `auth_refresh_revoked_total`, etc.
- Check `session_refresh_failure` logs for `SUPABASE_ENV_MISSING`, JWT or network errors.
- Validate runtime env vars and Supabase connectivity.
- If recent auth/session code changed, rollback deployment.

### C) 401/403 Spike by Route

- Confirm top impacted routes from `auth_401_total` / `auth_403_total`.
- Inspect `unauthorized_access_attempt` logs:
  - `MISSING_ROLE` indicates missing identity propagation.
  - `PERMISSION_DENIED` indicates policy mismatch/regression.
- For `MISSING_ROLE`:
  - confirm the request still carries auth cookies/session context
  - confirm the user record has valid role metadata
  - confirm the failure is not isolated to a single deployment or environment
- For `PERMISSION_DENIED`:
  - confirm the requested table/action pair
  - compare route intent with the permission matrix and RLS expectation before changing access rules
- Validate permission matrix assumptions before changing policy.

### D) Auth Latency Regression

- Confirm p99 exceeds 2000ms on the `auth_latency_ms` metric; `AUTH_ALERT` fires automatically.
- Check Supabase Auth dashboard for response time anomalies.
- Check network health between the application runtime and Supabase.
- If latency is only at p99, monitor and do not act until p95 is also affected.
- If Supabase is healthy, look for local resource contention (cold starts, CPU, DB connections).

### E) Replay Denied Spike

- Confirm `auth_refresh_replay_denied_total` exceeding threshold.
- Immediately check for concurrent client refresh requests using the same token.
- Verify client-side session handling is not issuing concurrent refresh calls.
- If spikes are concentrated in one user/session, consider security escalation — token reuse at scale is a potential indicator of token theft.
- Clear affected sessions via Supabase admin if reuse is confirmed as a security concern.

---

## Rollback Guidance

Use rollback when:

- sustained P0 impact exceeds 10 minutes
- auth flow is broadly broken
- regression is tied to latest deploy

Rollback order:

1. Revert latest application deployment.
2. Re-validate sign-in and protected route access.
3. Confirm alerts clear and counters normalize.
4. Capture timeline and impacted routes in incident notes.

Do not change authorization rules ad hoc in production without confirming role-matrix intent.

---

## Post-Fix Verification

Run these immediately after mitigation:

1. Re-run the previously failing request with a known-good internal user and verify expected success.
2. Re-run an anonymous request to the same route and verify the system still fails closed with 401.
3. Re-run an authenticated but disallowed-role request and verify the system still returns 403.
4. Confirm `auth_401_total`, `auth_403_total`, `auth_session_refresh_failure_total`, and resolution-specific counters are returning to baseline for the impacted routes.
5. Confirm no new `AUTH_ALERT` warnings fire for the same route during the next observation window.
6. Inspect sample logs and confirm request IDs, correlation IDs, and redaction are present.
7. Verify auth latency p99 is returning to normal (below 2000ms).

---

## Verification Steps

### Staging / Pre-Promotion Verification

Run these in staging before promotion:

1. Send unauthenticated API request and verify:
   - 401 response
   - `x-request-id` and `x-correlation-id` headers
   - `unauthorized_access_attempt` log with route
2. Send authenticated but unauthorized request and verify:
   - 403 response
   - `PERMISSION_DENIED` classification
   - route-level metrics increment
3. Send an authenticated allowed request and verify the affected write path succeeds end-to-end.
4. Trigger invalid sign-in attempts and verify sign-in failure alert behavior.
5. Confirm no secrets/tokens/PII are visible in sample logs.
6. Verify auth latency is within normal bounds under load.

---

## Escalation Path

| Situation | Action |
|---|---|
| Auth outage > 10 minutes | Page Engineering lead immediately |
| Possible credential/token leak | Declare security incident and page security owner |
| Conflicting policy expectations | Escalate to auth architecture owner before policy edits |
| Replay denied spike > 10 in 5 minutes | Begin security incident review — potential token theft |

---

## Alert Reference

| Alert | Metric | Threshold | Window | Runbook section |
|---|---|---|---|---|
| Refresh failure spike | `auth_refresh_expired_total` | 20 | 5 min | §B, §D |
| Revoked session spike | `auth_refresh_revoked_total` | 10 | 5 min | §B, §E |
| Replay denied spike | `auth_refresh_replay_denied_total` | 5 | 5 min | §E |
| Concurrency conflict spike | `auth_refresh_concurrency_conflict_total` | 15 | 5 min | §B |
| 401 rate spike | `auth_401_total` | 25 | 5 min | §C |
| 403 rate spike | `auth_403_total` | 25 | 5 min | §C |
| Sign-in failure spike | `auth_sign_in_failure_total` | 10 | 10 min | §A |
| Session refresh failure spike | `auth_session_refresh_failure_total` | 10 | 10 min | §B |
| Auth latency regression | `auth_latency_ms` p99 | > 2000ms | rolling | §D |

---

## Related Documents

- [Auth & Session Architecture](../architecture/auth.md)
- [Auth/Authz Observability Baseline](../architecture/security/auth-observability.md)
- [Auth Dashboard & Alerting Configuration](../architecture/security/auth-dashboard.md)
- [RLS Role Matrix](../architecture/security/rls-role-matrix.md)
- [Incident Closeout: Auth/RLS Write-Path Authorization Regression](../incidents/auth-rls-write-path-closeout.md)

