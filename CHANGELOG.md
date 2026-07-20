# Changelog

All notable changes to LOOP are documented here.

---

## [Unreleased]

### Sprint 24 — CI Migration Pipeline

- Added `supabase/migrations/` directory with `20240101000000_initial_schema.sql` baseline migration.
- Added `scripts/verify-migrations.sh` — offline validation script that checks migration file naming conventions, duplicate timestamps, ordering, and empty files.
- Added `.github/workflows/db-migrations.yml` — CI workflow that runs on PRs and pushes to `main` touching migration or Supabase config files.
  - `verify-structure` job: validates migration file sequence without database credentials.
  - `apply-and-verify` job: applies pending migrations via `supabase db push` and detects schema drift via `supabase db diff`.
- Added `docs/migration-runbook.md` — local developer runbook covering setup, daily workflow, rollback procedures, and CI failure resolution.

---
