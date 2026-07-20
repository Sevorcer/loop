# Runbook: Auth/Authz Production Incidents

Version: 1.0  
Last reviewed: 2026-07-20  
Owner: Engineering on-call  
Severity scope: P0 / P1 authentication and authorization incidents

---

## Purpose

Triage and recover from production incidents involving:

- sign-in failures
- session refresh failures
- spikes in 401/403 responses
- unexpected permission denials

---

## Fast Triage Flow

1. Confirm blast radius:
   - Which routes are impacted?
   - Internal users, portal users, or both?
2. Check auth dashboard:
   - 401/403 rate by route
   - sign-in failure rate
   - session refresh failure rate
3. Pull structured auth logs for the same time window:
   - Filter by `category=auth_observability`
   - Group by `event`, `route`, `errorCode`
4. Trace a failing request end-to-end:
   - Use `x-request-id` / `x-correlation-id`
   - Follow middleware auth refresh + authz decision logs
5. Classify root cause:
   - auth provider outage / network issue
   - token/session lifecycle issue
   - permission policy regression
   - deployment/config regression

---

## Incident Playbooks

### A) Sign-in Failure Spike

- Confirm `auth_sign_in_failure_total` trend.
- Check dominant `errorCode` in `sign_in_failure` logs.
- Validate Supabase Auth status and credentials flow.
- If release-correlated, rollback to previous known good deployment.

### B) Session Refresh Failure Spike

- Confirm `auth_session_refresh_failure_total`.
- Check `session_refresh_failure` logs for `SUPABASE_ENV_MISSING`, JWT or network errors.
- Validate runtime env vars and Supabase connectivity.
- If recent auth/session code changed, rollback deployment.

### C) 401/403 Spike by Route

- Confirm top impacted routes from `auth_401_total` / `auth_403_total`.
- Inspect `unauthorized_access_attempt` logs:
  - `MISSING_ROLE` indicates missing identity propagation.
  - `PERMISSION_DENIED` indicates policy mismatch/regression.
- Validate permission matrix assumptions before changing policy.

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

## Non-Prod Validation Steps

Run these in staging before promotion:

1. Send unauthenticated API request and verify:
   - 401 response
   - `x-request-id` and `x-correlation-id` headers
   - `unauthorized_access_attempt` log with route
2. Send authenticated but unauthorized request and verify 403 + metrics.
3. Trigger invalid sign-in attempts and verify sign-in failure alert behavior.
4. Confirm no secrets/tokens/PII are visible in sample logs.

---

## Escalation Path

| Situation | Action |
|---|---|
| Auth outage > 10 minutes | Page Engineering lead immediately |
| Possible credential/token leak | Declare security incident and page security owner |
| Conflicting policy expectations | Escalate to auth architecture owner before policy edits |

---

## Related Documents

- [Auth & Session Architecture](../architecture/auth.md)
- [Auth/Authz Observability Baseline](../architecture/security/auth-observability.md)
- [RLS Role Matrix](../architecture/security/rls-role-matrix.md)
