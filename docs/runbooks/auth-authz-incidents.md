# Runbook: Auth/Authz Production Incidents

Version: 1.1  
Last reviewed: 2026-07-24  
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

## Failure Signatures

| Signature | Primary signals | Likely cause | First checks |
|---|---|---|---|
| `MISSING_ROLE` | `unauthorized_access_attempt`, 401 on protected API routes, rising `auth_401_total` | Role missing from validated session metadata or identity propagation path failed | Confirm active session, inspect user metadata/app metadata for `app_role`, verify recent auth deploys |
| `PERMISSION_DENIED` | `unauthorized_access_attempt`, 403 on known protected route, rising `auth_403_total` | Role resolved but permission matrix / route intent / RLS expectation does not match | Confirm role, route, table, action, then compare app permission matrix to expected RLS behavior |
| `SESSION_NOT_FOUND` / auth session missing errors | `session_refresh_failure`, repeated 401s after navigation or refresh | Expired session, missing cookies, Supabase auth outage, middleware refresh failure | Confirm cookie presence, recent sign-in success, Supabase auth health, and refresh errors by route |
| `SUPABASE_ENV_MISSING` / `SUPABASE_NOT_CONFIGURED` | sign-in or refresh failures across all routes, startup/runtime auth failures | Missing auth environment configuration | Verify runtime env vars and deployment configuration before deeper auth debugging |

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
   - Separate `MISSING_ROLE`, `PERMISSION_DENIED`, and session refresh failures before choosing a fix
4. Trace a failing request end-to-end:
   - Use `x-request-id` / `x-correlation-id`
   - Follow middleware auth refresh + authz decision logs
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
- For `MISSING_ROLE`:
  - confirm the request still carries auth cookies/session context
  - confirm the user record has valid role metadata
  - confirm the failure is not isolated to a single deployment or environment
- For `PERMISSION_DENIED`:
  - confirm the requested table/action pair
  - compare route intent with the permission matrix and RLS expectation before changing access rules
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

## Verification Steps

### Recovery Verification

Run these immediately after mitigation:

1. Re-run the previously failing request with a known-good internal user and verify expected success.
2. Re-run an anonymous request to the same route and verify the system still fails closed with 401.
3. Re-run an authenticated but disallowed-role request and verify the system still returns 403.
4. Confirm `auth_401_total`, `auth_403_total`, and `auth_session_refresh_failure_total` trends are returning to baseline for the impacted routes.
5. Confirm no new `AUTH_ALERT` warnings fire for the same route during the next observation window.
6. Inspect sample logs and confirm request IDs, correlation IDs, and redaction are present.

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
- [Incident Closeout: Auth/RLS Write-Path Authorization Regression](../incidents/auth-rls-write-path-closeout.md)
