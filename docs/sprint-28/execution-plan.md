# Sprint 28 Execution Plan

Date: 2026-07-21  
Branch: `copilot/sprint-28-pr-a`

## Sprint Objective
Stabilize and extend platform data flows after Sprint 27 completion, while preserving production behavior and enforcing architecture boundaries.

## In Scope
- Resolve immediate schema/runtime gaps discovered post-Sprint 27 (excluding `user_profiles` for now)
- Add required migrations + RLS for newly introduced Sprint 28 entities
- Wire repository → service → API paths for Sprint 28 scope
- Keep Copilot/Portal/Reporting behavior stable unless explicitly changed

## Non-Goals
- Do **not** add or migrate `public.user_profiles` in this PR
- Do not perform broad auth-domain redesign
- Do not mix infra replacement and workflow redesign in one PR

## Architecture Constraints
UI → Hooks → Services → Repositories → Supabase

- No direct Supabase calls in React components
- No repository imports in UI
- No mock imports in production paths
- RBAC at API boundary + repository filtering

## Baseline Quality Gate
Run before code changes:
- `npm run lint`
- `npm run build`
- `npx vitest run`

## Migration Plan
- Add timestamped migration(s) for Sprint 28 tables
- Add matching RLS policy migration(s)
- Add seed updates only if needed
- Document rollback SQL

## Validation Plan
- Lint/build/tests must pass
- Preview deploy must be green
- Verify affected API routes manually
- Verify no merge markers

## Deployment Plan
- Push branch
- Open PR
- Verify Vercel preview
- Merge after checks pass

## Known Risks
- Hidden references to deferred tables (`user_profiles`)
- Schema drift between local and hosted environments
- Contract assumptions in providers during migration

## Success Criteria
- Sprint 28 scoped issues merged
- Zero build/type/lint regressions
- Preview deploy healthy
- Documentation updated

## PR E Stabilization Addendum
- Final hardening notes: `docs/sprint-28/release-readiness-pr-e.md`
- Includes validation matrix, known caveats, and deploy/rollback checklist