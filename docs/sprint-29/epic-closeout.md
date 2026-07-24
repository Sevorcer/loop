# Sprint 29 — S2 Migration Verification Framework: Epic Closeout

**Epic issue:** #117  
**Closed:** July 24, 2026  
**Baseline plan:** July 24, 2026

---

## Closeout Summary

S2 (Migration Verification) complete (July 24, 2026 baseline plan, closed on current merge date).

Closed: #118, #121, #119, #122, #120.

Outcomes: migration verification standardized, rollback planning required, CI enforcement added, drift detection implemented, and deploy health now gated by migration + verification SQL + application smoke test.

---

## Shipped Controls

| Control | Issue | Description |
|---|---|---|
| Verification SQL required | #118 | Every migration must include a companion verification SQL file confirming the schema change applied correctly |
| CI enforcement | #119 | Migration PRs without a verification step fail the `db-migrations` CI check; error message links to the migration standard |
| Deploy gate: migrate → verify → healthy | #120 | Deploy workflow now applies migration, runs verification SQL, then runs the application smoke test before marking healthy |
| Rollback template + checklist | #121 | Standardised rollback runbook template and per-migration rollback checklist required for every migration PR |

---

## Merged PRs

- #118 — [S29-1] Require verification SQL for every migration
- #119 — [S29-2] CI check: migration PR fails without verification step
- #120 — [S29-3] Deploy workflow: apply migration then verify then healthy
- #121 — [S29-4] Migration rollback template + checklist

---

## Deploy Gate Evidence

The `pre-deploy-gate` workflow (`.github/workflows/pre-deploy-gate.yml`) now enforces the following gate sequence on every push to `main` and every PR targeting `main`:

1. **Verify migration file structure** — `bash scripts/verify-migrations.sh` (no secrets required)
2. **DB drift gate** — `bash scripts/db-drift-gate.sh` against linked Supabase project
3. **Verification SQL** — companion verification SQL confirmed present and passing for each applied migration (added by #118 / #119)
4. **Application smoke test** — post-migration application health check gates the deploy as healthy (added by #120)

A deploy is only marked healthy after all four stages pass. Any CRITICAL failure blocks the deploy.

---

## Known Follow-Ups

- Verification SQL coverage for migrations applied before this framework was introduced should be backfilled as a follow-up (non-blocking for current deploys).
- Rollback drills using the template from #121 are recommended quarterly; first drill scheduled for Sprint 30 planning.
- Consider promoting the smoke test step to a required branch protection check once the test suite stabilises.
