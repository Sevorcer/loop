# Incident Closeout: Auth/RLS Write-Path Authorization Regression

Version: 1.0  
Status: Closed  
Last reviewed: 2026-07-24  
Owner: Engineering

---

## Summary

During Sprint 27 auth/RLS hardening, LOOP experienced an incident where protected write paths
returned elevated 401/403 responses after the authorization boundary moved closer to the API and
database layers.

The failure mode was deny-by-default: requests were blocked, but no privilege escalation or
cross-tenant exposure was observed.

---

## Timeline

| Time | Event |
|---|---|
| T0 | Auth observability alerts fired for elevated `auth_401_total` / `auth_403_total` on core internal routes. |
| T+10m | On-call correlated failing requests with `unauthorized_access_attempt` logs and split the incident into `MISSING_ROLE` vs `PERMISSION_DENIED` signatures. |
| T+25m | Recent auth/RLS changes were isolated as the common factor and forward rollout paused while critical write paths were rechecked. |
| T+45m | Investigation confirmed inconsistent role/session resolution at API boundaries and incomplete operational guidance for distinguishing identity failures from policy failures. |
| T+90m | Fix deployed: hardened route guards, standardized role resolution from Supabase session metadata, fail-closed authorization behavior, and structured auth observability. |
| T+24h | Core write-path smoke checks remained stable and alert volume normalized. |
| T+72h | Incident closed after sustained stability across protected create/update/delete routes. |

---

## Impact

- Internal write paths for core entities could fail with 401 or 403 responses.
- On-call noise increased because multiple auth failure modes surfaced as the same operational
  symptom until logs were classified.
- Operators lost time validating whether failures were caused by missing identity, expired session,
  or permission matrix mismatch.
- No evidence of unauthorized data access was found; the system failed closed.

---

## Root Cause

1. Auth hardening introduced stricter API and middleware checks before all operational triage
   guidance was documented.
2. The incident exposed two distinct failure classes with similar user-facing symptoms:
   - **Identity propagation failure** (`MISSING_ROLE`, missing/invalid session, missing metadata)
   - **Authorization policy mismatch** (`PERMISSION_DENIED`, route/matrix/RLS disagreement)
3. Operational response depended too heavily on ad hoc knowledge instead of a documented signature →
   triage → verification flow.

---

## Fix

- Standardized request authorization around explicit route guards and fail-closed behavior.
- Resolved roles from validated Supabase session metadata first, with non-production header fallback
  limited to development/test workflows.
- Added structured auth observability for request/correlation IDs, failure codes, and per-route
  401/403/session metrics.
- Added CI coverage to ensure API routes use an auth guard or are explicitly exempted.

---

## Prevention

- Keep the auth/authz incident runbook current with concrete failure signatures and verification
  steps.
- Classify incidents immediately as identity failures vs policy failures before editing auth rules
  or RLS policies.
- Require staging verification for anonymous, unauthorized, and allowed-path requests before
  promotion.
- Keep critical write-path stability as a release gate and close similar incidents only after
  sustained healthy metrics.

---

## Related Documents

- [Auth/Authz Production Incident Runbook](../runbooks/auth-authz-incidents.md)
- [Auth/Authz Observability Baseline](../architecture/security/auth-observability.md)
- [Auth & Session Architecture](../architecture/auth.md)
- [RLS Role Matrix](../architecture/security/rls-role-matrix.md)
