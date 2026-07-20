# Sprint 27 Execution Plan

> **Canonical reference for Sprint 27 PR A (Foundation & Core Data).**

## Issues
- #61 Consolidate shared repository utilities
- #56 Migrate Daily Plans, Dispatch, Installed Systems to Supabase repositories

## Architectural Decisions

### A1. Canonical shared utilities location
`src/lib/repositories/contracts.ts` is the single source for:
- `RepositoryResult<T>` — typed result envelope
- `PaginatedResult<T>` — paginated list result
- `CrudRepository<...>` — standard CRUD interface
- `normalizePagination`, `paginateItems`, `applySort`, `isFilterMatch` — runtime helpers

`src/repositories/shared.ts` re-exports all of the above + adds `wrapRepositoryError` — a consistent Supabase error mapper for real repository implementations.

All Wave 2 repositories import from `src/repositories/shared.ts`.

### A2. UI → Hook → Service → Repository → Supabase chain

```
React Provider (client)
  └── requestJson("/api/[domain]")
        └── API Route (server)
              └── src/services/[domain].ts
                    └── src/repositories/[domain].ts
                          └── Supabase (getRepositoryContext)
```

No component imports a repository directly.  
No service bypasses the repository.

### A3. Optimistic mutations
All write operations in providers apply optimistic state updates before the API call. If the API call fails (network or Supabase unavailable), the in-memory state remains for the session. On next page load, true persisted state is fetched from Supabase.

### A4. Morning operations data
`mockMorningOperations.ts` was renamed to `morningOperations.ts` (removing the mock prefix). The data it contains — crew profiles, weather summaries, and job plan detail checklists — is static reference/configuration data, not application state. It does not require a database table at this time. It is functionally equivalent to a product catalog or a lookup table stored in code.

This decision is documented as a deviation: see PR body.

### A5. Equipment catalog + estimate bundles
`equipmentCatalog.ts` and `estimateEquipmentBundles.ts` remain as static reference files. These are product/catalog data that don't change at runtime. Migration to a Supabase table is a future sprint concern.

## PR A File Index

### New database artifacts
| File | Purpose |
|------|---------|
| `database/migrations/002_wave2_domains.sql` | Wave 2 table schemas |
| `database/policies/003_wave2_rls.sql` | RLS policies for Wave 2 tables |
| `supabase/migrations/20260720000001_wave2_domains.sql` | Combined Supabase migration |
| `database/fixtures/baseline/60_wave2_domains.sql` | Seed data for development |

### New repositories
| File | Domain |
|------|--------|
| `src/repositories/dailyPlans.ts` | Daily Plans |
| `src/repositories/dispatch.ts` | Dispatch |
| `src/repositories/installedSystems.ts` | Installed Systems |

### New services
| File | Domain |
|------|--------|
| `src/services/dailyPlans.ts` | Daily Plans |
| `src/services/dispatch.ts` | Dispatch |
| `src/services/installedSystems.ts` | Installed Systems |

### New API routes
| Route | Purpose |
|-------|---------|
| `GET/POST /api/daily-plans` | Daily plan state load/mutate |
| `GET /api/dispatch-plans` | Dispatch snapshot |
| `POST /api/dispatch-plans` | Create dispatch plan |
| `PATCH /api/dispatch-plans/[id]` | Assign crew / schedule / update status |
| `GET /api/crews` | List crews |
| `GET /api/schedule-blocks` | List schedule blocks |
| `GET /api/installed-systems` | Installed systems + technical profiles snapshot |
| `GET /api/installed-systems/[id]` | Single installed system |

### Updated files
| File | Change |
|------|--------|
| `src/repositories/shared.ts` | Added `wrapRepositoryError`, re-exports |
| `src/features/daily-plans/data/morningOperations.ts` | Renamed from `mockMorningOperations.ts` |
| `src/features/daily-plans/utils/planUtils.ts` | Import update |
| `src/features/daily-plans/state/DailyPlansProvider.tsx` | localStorage → Supabase API |
| `src/features/dispatch/state/DispatchProvider.tsx` | Mock → Supabase API |
| `src/features/installed-systems/state/InstalledSystemsProvider.tsx` | Seed/mock → Supabase API |
| `src/features/project-portal/adapters/mockAdapters.ts` | Import path update |
| `docs/sprint-27/migration-status.md` | Progress update |

## Deviations from Original Spec

| # | Spec Requirement | Actual | Rationale |
|---|-----------------|--------|-----------|
| 1 | Remove all mock data from Daily Plans | `morningOperations.ts` (renamed) still used in `planUtils.ts` | Crew profiles and weather data are static configuration, not application state. They have no natural Supabase table home without a workforce management domain migration. The "mock" prefix is removed; the file is static reference data. No persistence is needed for read-only configuration. |
| 2 | `copilot/domainData.ts` still imports `seedInstalledSystems` | Not changed in PR A | `domainData.ts` is in the Copilot domain which is a separate migration wave. No behavior is changed; copilot search continues to work. |

## Rollback

### Daily Plans
1. Revert `DailyPlansProvider.tsx` to localStorage version (git revert)
2. Drop `daily_plan_notes`, `daily_plan_activations`, `daily_plan_job_overrides` tables

### Dispatch
1. Revert `DispatchProvider.tsx` to mock-backed version (git revert)
2. Drop `dispatch_plans`, `crews`, `crew_assignments`, `schedule_blocks`, `dispatch_events` tables

### Installed Systems
1. Revert `InstalledSystemsProvider.tsx` to `buildInstalledSystemsSnapshot(jobs)` version (git revert)
2. Drop `installed_systems`, `technical_profiles` tables

All rollbacks are safe because:
- The old providers held state only in localStorage or in-memory (no server state was mutated)
- All table drops can be done in a single migration

## Follow-ups (Not in PR A scope)
- Persist `morningOperations.ts` crew profiles to `crews` table (when workforce domain is defined)
- Migrate copilot `domainData.ts` to query live Supabase tables (#copilot PR)
- Migrate `equipmentCatalog` and `estimateEquipmentBundles` to Supabase tables (Documents/Photos PR)
- Add full-text search on `installed_systems` (future search PR)
