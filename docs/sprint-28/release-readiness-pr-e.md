# Sprint 28 PR E — Release Readiness Notes

Date: 2026-07-21  
Branch: `copilot/sprint-28-pr-e`  
Scope: stabilization, test hardening, and release-readiness validation

## Final Validation Matrix

| Command | Result | Notes |
|---|---|---|
| `npm run lint` | ✅ pass | 2 existing React Compiler compatibility warnings in ATLAS DataTable components (`react-hooks/incompatible-library`) |
| `npm run build` | ✅ pass | Build succeeds; auth observability logs may include `SUPABASE_ENV_MISSING` when Supabase env vars are not configured in local-only runs |
| `npx vitest run` | ✅ pass | Test suite passes; time-threshold portal freshness tests are deterministic |

## Known Caveats

1. **Windows bash scope**
   - Commands that invoke `bash` scripts require WSL or Git Bash:
     - `bash scripts/verify-migrations.sh`
     - `npm run db:seed`
     - `npm run db:reset`
     - `npm run db:reseed`
   - Workaround: use WSL/Git Bash locally, or run via Linux/macOS CI.

2. **Local build auth logs**
   - If Supabase env vars are not set, local builds can emit `SUPABASE_ENV_MISSING` auth observability events while prerendering server routes.
   - This is an environment configuration caveat, not a TypeScript/build blocker.

## Deploy Checklist

- [ ] Confirm branch is up to date and CI checks are green.
- [ ] Run `npm run lint`, `npm run build`, and `npx vitest run`.
- [ ] Apply pending migrations with `supabase db push` in target environment.
- [ ] Run `supabase migration list` and verify expected migration ordering.
- [ ] Smoke test core routes and API endpoints after deploy.
- [ ] Monitor auth and API logs for 15 minutes post-deploy.

## Rollback Checklist

- [ ] Pause forward deploys and identify the failing migration/release change.
- [ ] If reversible, create/apply a revert migration (do not edit applied migrations).
- [ ] If destructive impact is present, execute point-in-time restore from pre-migration backup.
- [ ] Re-run `npm run build` and key smoke tests against rolled-back environment.
- [ ] Record incident details and follow-up actions in runbook/reporting artifacts.
