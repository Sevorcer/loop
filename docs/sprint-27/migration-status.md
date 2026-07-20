# Sprint 27 Migration Tracker
> Motto: **Replace data, not behavior.**

| Domain | Mock Removed | Repository | CRUD | Search | Storage | Auth/RBAC | Complete |
|---|---|---|---|---|---|---|---|
| Customers | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ✅ |
| Properties | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ✅ |
| Jobs | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ✅ |
| Daily Plans | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ |
| Dispatch | ⬜ | ⬜ | ⬜ | ⬜ | N/A | ⬜ | ⬜ |
| Installed Systems | ✅ (search) | ✅ | read | ✅ | N/A | ✅ | ✅ |
| Documents (Portal) | ✅ | ✅ | read | ✅ | ✅ | ✅ | ✅ |
| Photos (Portal) | ✅ | ✅ | read | ✅ | ✅ | ✅ | ✅ |
| Storage (GC) | N/A | ✅ | ✅ | N/A | ✅ | ✅ | ✅ |
| GC Issue Requests | N/A | ✅ | ✅ | N/A | N/A | ✅ | ✅ |
| Reporting | ✅ (models) | ✅ | read | ⬜ | N/A | ✅ | partial |
| Company Brain metadata | ✅ | ✅ | read | ✅ | N/A | ✅ | ✅ |
| Project Portal sources | ✅ (proj/docs/photos) | ✅ | read | ✅ | N/A | ✅ | partial |
| Copilot search sources | ✅ | ✅ | N/A | ✅ | N/A | ✅ | ✅ |

## PR B (#57 #58 #59) Completion Notes

### #57 — Storage + GC Field Issue Requests
- `src/repositories/storage.ts`: upload/download/delete/list with retry and signed URLs
- `src/services/storage.ts`: role-aware storage service layer
- `src/repositories/gcIssueRequests.ts`: full CRUD + attachment management
- `src/services/gcIssueRequests.ts`: creation validation, status machine enforcement, attachment wiring
- `src/app/api/gc-issue-requests/route.ts` + `[id]/route.ts`: API endpoints with `requirePermission`
- `database/migrations/002_sprint27_platform_services.sql`: `storage_objects`, `gc_issue_requests`, `gc_issue_attachments` tables
- `database/policies/003_sprint27_policies.sql`: RLS for all storage and GC issue tables
- **Deviations**: `portal_appointments`, `portal_contacts`, `portal_change_orders` tables deferred (follow-up sprint)

### #58 — Copilot Search Migration
- `src/features/copilot/domainData.ts`: production `getSearchRecords()` now calls 9 parallel live Supabase sources
- Customers, Properties, Jobs, Installed Systems, Knowledge Items, Portal Projects, Portal Documents, Portal Photos all backed by production repositories
- Mock imports isolated to `buildStaticSearchRecords()` (test/fallback only) — not in production path
- **Deviations**: Equipment catalog and navigation records remain static config (reference catalogs, not database records)

### #59 — Reporting / Company Brain / Project Portal
- `src/features/company-brain/state/CompanyBrainProvider.tsx`: async-fetches from `/api/knowledge-items`; `mockKnowledgeItems` removed from production path
- `src/features/reporting/state/ReportingProvider.tsx`: `performanceModels` from `/api/reporting`; `mockPerformanceModels` removed from production path
- `src/features/project-portal/state/PortalProvider.tsx`: project/milestones/documents/photos from `/api/portal-projects` bundle; `mockPortalProjects`, `mockMilestones`, `mockDocuments`, `mockPhotos` removed from production path
- **Deviations**:
  - Reporting KPIs, scorecards, trends, benchmarks, health indicators remain mock-backed (full analytics pipeline migration is a separate sprint)
  - Portal currentUser still from `mockPortalUsers` (portal auth session management beyond this sprint)
  - Portal appointments/contacts/changeOrders still mock (no tables yet; follow-up sprint)

## Sprint 27 Exit Criteria
- [x] Repository pattern used consistently
- [x] Copilot searches live data
- [x] File storage operational (repository + service layer)
- [x] RBAC validated (RLS policies + requirePermission in API routes)
- [x] Build/tests green
- [x] Migration tracker updated for #57/#58/#59
- [ ] No production code imports mock data (partial — reporting enrichment + portal auth/appointments remain)
- [ ] Full analytics pipeline migration (Reporting follow-up)
- [ ] Portal auth session + appointments/contacts/changeOrders (follow-up sprint)
