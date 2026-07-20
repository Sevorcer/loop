# Sprint 27 Migration Tracker
> Motto: **Replace data, not behavior.**

| Domain | Mock Removed | Repository | CRUD | Search | Storage | Auth/RBAC | Complete |
|---|---|---|---|---|---|---|---|
| Customers | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ✅ |
| Properties | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ✅ |
| Jobs | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ✅ |
| Daily Plans | ✅ | ✅ | ✅ | N/A | N/A | ✅ | ✅ |
| Dispatch | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ✅ |
| Installed Systems | ✅ | ✅ | ✅ | ⬜ | N/A | ✅ | ✅ |
| Documents | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ | ⬜ |
| Photos | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ | ⬜ |
| Reporting | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ |
| Company Brain metadata | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ |
| Project Portal sources | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ |
| Copilot search sources | ⬜ | ⬜ | N/A | ✅ | N/A | ✅ | ⬜ |

## PR A — Sprint 27 (Foundation & Core Data) — Completed

### #61 Shared Repository Utilities

- **Status:** ✅ Complete
- **PR:** Sprint 27 PR A

Changes:
- `src/repositories/shared.ts` — consolidated `wrapRepositoryError` helper, re-exports of all `src/lib/repositories/contracts.ts` utilities (pagination, filtering, sorting, RepositoryResult)
- All Wave 2 repositories (`dailyPlans.ts`, `dispatch.ts`, `installedSystems.ts`) import from `src/repositories/shared.ts`

### #56 Wave 2 Domain Migration

- **Status:** ✅ Complete
- **PR:** Sprint 27 PR A

#### Daily Plans
- Mock path removed: `mockMorningOperations.ts` → `morningOperations.ts` (static config, no "mock" in production imports)
- `DailyPlansProvider.tsx` — migrated from localStorage to `/api/daily-plans` (Supabase-backed)
- New tables: `daily_plan_notes`, `daily_plan_activations`, `daily_plan_job_overrides`
- Repository: `src/repositories/dailyPlans.ts`
- Service: `src/services/dailyPlans.ts`
- API route: `src/app/api/daily-plans/route.ts`
- RLS: `database/policies/003_wave2_rls.sql`

#### Dispatch
- Mock imports removed from `DispatchProvider.tsx`
- `DispatchProvider.tsx` — migrated from mock+localStorage to `/api/dispatch-plans` (Supabase-backed)
- New tables: `dispatch_plans`, `crews`, `crew_assignments`, `schedule_blocks`, `dispatch_events`
- Repository: `src/repositories/dispatch.ts`
- Service: `src/services/dispatch.ts`
- API routes: `/api/dispatch-plans`, `/api/dispatch-plans/[id]`, `/api/crews`, `/api/schedule-blocks`
- Seed fixture: `database/fixtures/baseline/60_wave2_domains.sql`

#### Installed Systems
- Mock imports removed from `InstalledSystemsProvider.tsx`
- `InstalledSystemsProvider.tsx` — migrated from `buildInstalledSystemsSnapshot(jobs)` to `/api/installed-systems` (Supabase-backed)
- `equipmentCatalog` and `estimateEquipmentBundles` remain as static reference data (product catalog)
- New tables: `installed_systems`, `technical_profiles`
- Repository: `src/repositories/installedSystems.ts`
- Service: `src/services/installedSystems.ts`
- API routes: `/api/installed-systems`, `/api/installed-systems/[id]`

## Sprint 27 Exit Criteria
- [x] Daily Plans, Dispatch, Installed Systems production paths have no mock imports
- [ ] All P0 issues complete (Documents, Photos, Reporting in subsequent PRs)
- [x] Repository pattern used consistently for Wave 2 domains
- [ ] Copilot searches live data
- [ ] File storage operational
- [x] RBAC validated (RLS policies created for all Wave 2 tables)
- [ ] QA script passes (pending Supabase environment)
- [x] Build/tests green
- [x] PR A migration tracker complete
