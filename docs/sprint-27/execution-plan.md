# Sprint 27 Execution Plan

> **Canonical reference for Sprint 27 (PR B): Platform Services Migration**
> Issues: #57 (Storage + GC Issue Requests), #58 (Copilot Search), #59 (Reporting / Company Brain / Project Portal)

---

## Architecture Constraint

All migrations follow the mandatory data access hierarchy:

```
UI → Hooks → Services → Repositories → Supabase
```

No component may call Supabase or Supabase Storage directly.  
No service may bypass a repository.  
No production path may import mock data modules.

---

## PR A vs PR B Boundary

| Area | PR A | PR B |
|---|---|---|
| Core schema + RLS baseline | ✅ | — |
| Customer/Property/Job CRUD | ✅ | — |
| Auth + permission infrastructure | ✅ | — |
| Storage + GC Issue Requests | — | ✅ (#57) |
| Copilot live search | — | ✅ (#58) |
| Reporting / Company Brain / Portal | — | ✅ (#59) |

---

## #57 — Storage + GC Field Issue Requests

### Goal
Implement repository/service layer for Supabase Storage operations and the GC field issue request workflow.

### Schema
- `storage_objects` — file metadata (bucket, path, size, MIME, uploader role, tenant refs)
- `gc_issue_requests` — title, description, priority (low/medium/high/critical), status (open/triaged/in_progress/resolved/closed), optional property_id/job_id refs
- `gc_issue_attachments` — join table linking files to issues

### Implementation layers
1. `database/migrations/002_sprint27_platform_services.sql` — all new tables
2. `database/policies/003_sprint27_policies.sql` — RLS for all new tables
3. `src/repositories/storage.ts` — upload (with retry), getSignedDownloadUrl, deleteFile, listStorageObjects, getStorageObjectById
4. `src/services/storage.ts` — role-aware storage operations; validates bucket access by role
5. `src/repositories/gcIssueRequests.ts` — full CRUD + attachment management
6. `src/services/gcIssueRequests.ts` — validation, status machine, attachFile
7. `src/app/api/gc-issue-requests/route.ts` — GET (list with filters) + POST (create)
8. `src/app/api/gc-issue-requests/[id]/route.ts` — GET + PATCH + DELETE

### Security
- All API routes use `requirePermission(request, "gc_issue_requests", ...)`
- Storage repository validates bucket metadata; RLS policies enforce tenant isolation
- No public URLs — all downloads use signed URLs with TTL

### Known deviations / follow-ups
- `portal_appointments`, `portal_contacts`, `portal_change_orders` tables deferred to follow-up sprint
- Storage bucket creation/configuration done in `supabase/config.toml`, not SQL migration

---

## #58 — Copilot Search Migration

### Goal
Replace all mock search providers in `getSearchRecords()` with live Supabase repository calls.

### Searchable domains (post-migration)
| Domain | Source |
|---|---|
| Customers | `src/repositories/customers.ts` |
| Properties | `src/repositories/properties.ts` |
| Jobs | `src/repositories/jobs.ts` |
| Installed Systems | `src/repositories/installedSystems.ts` |
| Knowledge Items (Company Brain) | `src/repositories/knowledgeItems.ts` |
| Portal Projects | `src/repositories/portalProjects.ts` |
| Portal Documents | `src/repositories/portalProjects.ts` → `listAllPortalDocuments()` |
| Portal Photos | `src/repositories/portalProjects.ts` → `listAllPortalPhotos()` |
| Reports | static (performance model descriptions) |
| Equipment catalog | static reference catalog (not a database entity) |
| Navigation | static config |

### Implementation
- `src/features/copilot/domainData.ts`: `getSearchRecords()` uses `Promise.all` across 9 async sources; each source has `.catch(() => [])` for graceful degradation
- `buildStaticSearchRecords()` and `getFallbackSearchRecords()` retained unchanged for tests; mock imports are not in the production path

### RBAC
- Role is extracted from request context; passed to repository queries as a filter
- Server-side only — no client-side filtering

### Known deviations / follow-ups
- Equipment catalog: static reference data, not a database entity — intentionally static
- Navigation: UI routes, not Supabase data — intentionally static
- Manuals: no `manuals` table exists; deferred to follow-up sprint

---

## #59 — Reporting / Company Brain / Project Portal

### Company Brain
- `src/repositories/knowledgeItems.ts` — listKnowledgeItems, listKnowledgeRelationships, listKnowledgeUsage, recordKnowledgeUsage
- `src/services/knowledgeItems.ts` — getKnowledgeSnapshot (assembled), searchKnowledge, trackKnowledgeUsage
- `src/app/api/knowledge-items/route.ts` — returns full KnowledgeSnapshot
- `src/features/company-brain/state/CompanyBrainProvider.tsx` — async-fetches from `/api/knowledge-items`; `mockKnowledgeItems` removed from production path

### Reporting
- `src/repositories/performanceReporting.ts` — listPerformanceModels, getPerformanceModelById
- `src/services/performanceReporting.ts` — getActivePerformanceModels, getPerformanceModel
- `src/app/api/reporting/route.ts` — returns active performance models
- `src/features/reporting/state/ReportingProvider.tsx` — `performanceModels` async-fetched from `/api/reporting`; `mockPerformanceModels` removed from production path
- **Partial migration**: KPI definitions, scorecards, trends, benchmarks, health indicators remain mock-backed — the full analytics pipeline migration requires a dedicated sprint (tracked in migration-status.md)

### Project Portal
- `src/repositories/portalProjects.ts` — listPortalProjects, getPortalProjectById, listPortalMilestones, listPortalDocuments, listPortalPhotos, listAllPortalDocuments, listAllPortalPhotos
- `src/services/portalProjects.ts` — getPortalProjects, getPortalProject, getPortalProjectBundle
- `src/app/api/portal-projects/route.ts` — returns project list or full bundle (projectId param)
- `src/features/project-portal/state/PortalProvider.tsx` — project/milestones/documents/photos async-fetched from `/api/portal-projects?projectId=...`; `mockPortalProjects`, `mockMilestones`, `mockDocuments`, `mockPhotos` removed from production path
- **Partial migration**: currentUser (portal auth), appointments, contacts, changeOrders remain mock — portal session management and those sub-entities require additional tables (follow-up sprint)

---

## Validation

```bash
# Build
npm run build

# Lint
npm run lint

# Tests
npx vitest run
```

Expected: build ✅, lint ✅ (0 errors), 349 tests ✅

---

## Rollback Strategy

| Subsystem | Rollback |
|---|---|
| SQL migrations | `database/migrations/002_...sql` — drop tables in reverse order; no data loss risk on fresh deploy |
| API routes | Revert `src/app/api/gc-issue-requests/`, `knowledge-items/`, `portal-projects/`, `reporting/` |
| Provider migrations | Revert `CompanyBrainProvider.tsx`, `ReportingProvider.tsx`, `PortalProvider.tsx` to mock-backed state |
| Copilot search | Revert `domainData.ts` `getSearchRecords()` to static mock path |
| Repositories/services | Revert new files; no DB state persisted in staging until seeded |

Each subsystem is independently reversible. Provider rollbacks restore prior mock behavior immediately with no DB dependency.
