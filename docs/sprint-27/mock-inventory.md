# Mock Data Inventory — Sprint 27

**Purpose:** Complete inventory of every mock/seed/fake data module in the codebase, classified by domain, owner layer, and read/write path. Maps each usage to its production Supabase target and captures migration status.

**Date:** 2026-07-20  
**Status:** Living document — update migration status column as work progresses.

---

## Legend

| Column | Meaning |
|--------|---------|
| **Domain** | Feature domain that owns the data |
| **File** | Source path (relative to `src/`) |
| **Exports** | Named exports provided by the file |
| **Owner Layer** | Where the data is consumed: `repo` (data file only), `service`, `hook/provider`, `UI`, `API` |
| **Read / Write** | Whether consumers read and/or write through this mock |
| **Consumers** | Files that import and use the mock |
| **Production Target** | Supabase table, service, or adapter to replace this mock |
| **Prod-Blocking** | `🔴 YES` = blocks production launch; `🟡 DEV` = dev/staging only; `🟢 NO` = test/demo only |
| **Migration Status** | `not started` / `in progress` / `done` |

---

## 1. Jobs

### 1.1 `mockJobs`

| Field | Value |
|-------|-------|
| **File** | `features/jobs/data/mockJobs.ts` |
| **Exports** | `mockJobs: Job[]` (15 records) |
| **Owner Layer** | repo → hook/provider → API |
| **Read / Write** | Read (list, find by id) |
| **Consumers** | `features/jobs/state/JobsProvider.tsx` (localStorage seed), `features/jobs/components/JobsMetrics.tsx` (direct UI read), `app/api/jobs/route.ts` (GET /api/jobs), `app/api/jobs/[id]/route.ts` (GET/PATCH/DELETE /api/jobs/:id), `app/api/dispatch/route.ts` (GET /api/dispatch), `features/project-portal/adapters/mockAdapters.ts`, `features/copilot/domainData.ts` |
| **Production Target** | Supabase `jobs` table — `src/services/jobs.ts` (to be created) |
| **Prod-Blocking** | 🔴 YES — all job API routes return this array directly |
| **Migration Status** | not started |

### 1.2 `mockJobActivity`

| Field | Value |
|-------|-------|
| **File** | `features/jobs/data/mockJobActivity.ts` |
| **Exports** | `mockJobActivity: JobActivity[]` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read (seed), Write (localStorage) |
| **Consumers** | `features/jobs/state/JobsProvider.tsx` (localStorage seed) |
| **Production Target** | Supabase `job_activity` table |
| **Prod-Blocking** | 🔴 YES — activity feed is seeded from this file |
| **Migration Status** | not started |

---

## 2. Properties

### 2.1 `mockProperties`

| Field | Value |
|-------|-------|
| **File** | `features/properties/data/mockProperties.ts` |
| **Exports** | `mockProperties: Property[]` (7 records) |
| **Owner Layer** | repo → hook/provider → API |
| **Read / Write** | Read (list, find by id) |
| **Consumers** | `features/properties/state/PropertiesProvider.tsx` (localStorage seed), `app/api/properties/route.ts` (GET /api/properties), `app/api/properties/[id]/route.ts` (GET/PATCH/DELETE), `features/copilot/domainData.ts` |
| **Production Target** | Supabase `properties` table — `src/services/properties.ts` (partial, extend) |
| **Prod-Blocking** | 🔴 YES — all property API routes return this array directly |
| **Migration Status** | not started |

### 2.2 `mockPropertyDetails`

| Field | Value |
|-------|-------|
| **File** | `features/properties/data/mockPropertyDetails.ts` |
| **Exports** | `mockPropertyDetails: PropertyDetails[]` |
| **Owner Layer** | repo → UI → service |
| **Read / Write** | Read |
| **Consumers** | `features/properties/components/PropertyDetailTabs.tsx` (direct UI read), `features/copilot/domainData.ts` |
| **Production Target** | Supabase `property_details` table (or extended `properties` JSONB column) |
| **Prod-Blocking** | 🔴 YES — property detail tabs render directly from this mock |
| **Migration Status** | not started |

---

## 3. Customers

### 3.1 `mockCustomers`

| Field | Value |
|-------|-------|
| **File** | `features/customers/data/mockCustomers.ts` |
| **Exports** | `mockCustomers: Customer[]` (6 records) |
| **Owner Layer** | repo → hook/provider → API |
| **Read / Write** | Read (list, find by id) |
| **Consumers** | `features/customers/state/CustomersProvider.tsx` (localStorage seed), `app/api/customers/route.ts` (GET /api/customers), `app/api/customers/[id]/route.ts` (GET/PATCH/DELETE), `features/copilot/domainData.ts` |
| **Production Target** | Supabase `customers` table |
| **Prod-Blocking** | 🔴 YES — all customer API routes return this array directly |
| **Migration Status** | not started |

### 3.2 `mockCustomerDetails`

| Field | Value |
|-------|-------|
| **File** | `features/customers/data/mockCustomerDetails.ts` |
| **Exports** | `mockCustomerDetails: CustomerDetails[]` |
| **Owner Layer** | repo → UI |
| **Read / Write** | Read |
| **Consumers** | `features/customers/components/CustomerDetailTabs.tsx` (direct UI read) |
| **Production Target** | Supabase `customer_details` table (or joined query on `customers` + `properties`) |
| **Prod-Blocking** | 🔴 YES — customer detail tabs render directly from this mock |
| **Migration Status** | not started |

---

## 4. Dispatch

### 4.1 `mockDispatchPlans`

| Field | Value |
|-------|-------|
| **File** | `features/dispatch/data/mockDispatchPlans.ts` |
| **Exports** | `mockDispatchPlans: DispatchPlan[]` (6 records — aggregate root) |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read (seed + localStorage status overrides) |
| **Consumers** | `features/dispatch/state/DispatchProvider.tsx`, `features/project-portal/adapters/mockAdapters.ts` |
| **Production Target** | Supabase `dispatch_plans` table |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

### 4.2 `mockCrews`

| Field | Value |
|-------|-------|
| **File** | `features/dispatch/data/mockCrews.ts` |
| **Exports** | `mockCrews: Crew[]` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read |
| **Consumers** | `features/dispatch/state/DispatchProvider.tsx` |
| **Production Target** | Supabase `crews` table (crew records owned by workforce domain) |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

### 4.3 `mockCrewAssignments`

| Field | Value |
|-------|-------|
| **File** | `features/dispatch/data/mockCrewAssignments.ts` |
| **Exports** | `mockCrewAssignments: CrewAssignment[]` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read (seed) + Write (localStorage mutations) |
| **Consumers** | `features/dispatch/state/DispatchProvider.tsx` |
| **Production Target** | Supabase `crew_assignments` table |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

### 4.4 `mockDispatchEvents`

| Field | Value |
|-------|-------|
| **File** | `features/dispatch/data/mockDispatchEvents.ts` |
| **Exports** | `mockDispatchEvents: DispatchEvent[]` |
| **Owner Layer** | repo → hook/provider → adapter |
| **Read / Write** | Read (seed) + Write (localStorage append) |
| **Consumers** | `features/dispatch/state/DispatchProvider.tsx`, `features/project-portal/adapters/mockAdapters.ts` |
| **Production Target** | Supabase `dispatch_events` table (event-sourced log) |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

### 4.5 `mockScheduleBlocks`

| Field | Value |
|-------|-------|
| **File** | `features/dispatch/data/mockScheduleBlocks.ts` |
| **Exports** | `mockScheduleBlocks: ScheduleBlock[]` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read (seed) + Write (localStorage append) |
| **Consumers** | `features/dispatch/state/DispatchProvider.tsx` |
| **Production Target** | Derived view from `dispatch_plans` + `crew_assignments` (no separate table needed) |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

---

## 5. Inventory

### 5.1 `mockInventoryItems`

| Field | Value |
|-------|-------|
| **File** | `features/inventory/data/mockInventoryItems.ts` |
| **Exports** | `mockInventoryItems: InventoryItem[]` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read |
| **Consumers** | `features/inventory/state/InventoryProvider.tsx` |
| **Production Target** | Supabase `inventory_items` table |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

### 5.2 `mockInventoryAllocations`

| Field | Value |
|-------|-------|
| **File** | `features/inventory/data/mockInventoryAllocations.ts` |
| **Exports** | `mockInventoryAllocations: InventoryAllocation[]` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read |
| **Consumers** | `features/inventory/state/InventoryProvider.tsx` |
| **Production Target** | Supabase `inventory_allocations` table |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

### 5.3 `mockJobMaterialPlans`

| Field | Value |
|-------|-------|
| **File** | `features/inventory/data/mockJobMaterialPlans.ts` |
| **Exports** | `mockJobMaterialPlans: JobMaterialPlan[]` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read |
| **Consumers** | `features/inventory/state/InventoryProvider.tsx` |
| **Production Target** | Supabase `job_material_plans` table (or derived from `inventory_allocations`) |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

---

## 6. Contractors

### 6.1 `mockContractors`

| Field | Value |
|-------|-------|
| **File** | `features/contractors/data/mockContractors.ts` |
| **Exports** | `mockContractors: Contractor[]` (3 records) |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read (seed) + Write (localStorage CRUD) |
| **Consumers** | `features/contractors/state/ContractorsProvider.tsx` |
| **Production Target** | Supabase `contractors` table |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

---

## 7. Vehicle Alerts

### 7.1 `mockVehicleAlerts`

| Field | Value |
|-------|-------|
| **File** | `features/vehicle-alerts/data/mockVehicleAlerts.ts` |
| **Exports** | `mockVehicleAlerts: VehicleAlert[]` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read (seed) + Write (localStorage mutations) |
| **Consumers** | `features/vehicle-alerts/state/VehicleAlertsProvider.tsx` |
| **Production Target** | Supabase `vehicle_alerts` table or fleet telematics integration |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

---

## 8. Daily Plans

### 8.1 `mockMorningOperations`

| Field | Value |
|-------|-------|
| **File** | `features/daily-plans/data/mockMorningOperations.ts` |
| **Exports** | `getCrewProfilesForDate`, `getDayOverview`, `getJobPlanDetail` (functions returning typed data) |
| **Owner Layer** | repo → service → adapter |
| **Read / Write** | Read |
| **Consumers** | `features/daily-plans/utils/planUtils.ts`, `features/project-portal/adapters/mockAdapters.ts` |
| **Production Target** | Derived at runtime from `jobs` + `dispatch_plans` + `crew_assignments` (no separate table) |
| **Prod-Blocking** | 🔴 YES — daily plan utils hard-wired to this fixture |
| **Migration Status** | not started |

---

## 9. Live Operations

### 9.1 `mockLiveOps` / `getMockLiveOpsSnapshot`

| Field | Value |
|-------|-------|
| **File** | `features/live-operations/data/mockLiveOps.ts` |
| **Exports** | `getMockLiveOpsSnapshot: () => LiveOpsSnapshot` |
| **Owner Layer** | repo → UI (screen) |
| **Read / Write** | Read |
| **Consumers** | `features/live-operations/screens/LiveOperationsScreen.tsx` (direct screen consumption) |
| **Production Target** | Real-time Supabase Realtime subscription on `jobs` + `dispatch_events` |
| **Prod-Blocking** | 🔴 YES — Live Ops screen renders entirely from this snapshot |
| **Migration Status** | not started |

---

## 10. Reporting

### 10.1 `mockReporting` (multiple exports)

| Field | Value |
|-------|-------|
| **File** | `features/reporting/data/mockReporting.ts` |
| **Exports** | `mockPerformanceModels`, `mockKpiDefinitions`, `mockTrends`, `mockBenchmarks`, `mockScorecards`, `mockHealthIndicators`, `mockPerformanceSummaries`, `mockComparisonWindows` |
| **Owner Layer** | repo → hook/provider → service |
| **Read / Write** | Read |
| **Consumers** | `features/reporting/state/ReportingProvider.tsx` (all 8 exports), `features/project-portal/adapters/mockAdapters.ts` (`mockPerformanceSummaries`), `features/copilot/domainData.ts` (`mockPerformanceModels`) |
| **Production Target** | Supabase analytics tables (`kpis`, `performance_summaries`, `benchmarks`, `scorecards`) or a dedicated reporting service |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

---

## 11. Company Brain

### 11.1 `mockKnowledgeItems`

| Field | Value |
|-------|-------|
| **File** | `features/company-brain/data/mockKnowledgeItems.ts` |
| **Exports** | `mockKnowledgeItems: KnowledgeItem[]` |
| **Owner Layer** | repo → hook/provider → service |
| **Read / Write** | Read |
| **Consumers** | `features/company-brain/state/CompanyBrainProvider.tsx`, `features/copilot/domainData.ts` |
| **Production Target** | Supabase `knowledge_items` table |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

### 11.2 `mockKnowledgeRelationships`

| Field | Value |
|-------|-------|
| **File** | `features/company-brain/data/mockKnowledgeRelationships.ts` |
| **Exports** | `mockKnowledgeRelationships: KnowledgeRelationship[]` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read |
| **Consumers** | `features/company-brain/state/CompanyBrainProvider.tsx` |
| **Production Target** | Supabase `knowledge_relationships` table |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

### 11.3 `mockKnowledgeUsage`

| Field | Value |
|-------|-------|
| **File** | `features/company-brain/data/mockKnowledgeUsage.ts` |
| **Exports** | `mockKnowledgeUsage: KnowledgeUsage[]` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read |
| **Consumers** | `features/company-brain/state/CompanyBrainProvider.tsx` |
| **Production Target** | Supabase `knowledge_usage` table (usage events log) |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

---

## 12. Project Portal

### 12.1 `mockPortalProjects`

| Field | Value |
|-------|-------|
| **File** | `features/project-portal/data/mockPortalProjects.ts` |
| **Exports** | `mockPortalProjects: PortalProject[]`, `mockOrgs` |
| **Owner Layer** | repo → hook/provider → service |
| **Read / Write** | Read |
| **Consumers** | `features/project-portal/state/PortalProvider.tsx`, `features/project-portal/services/portalHome.ts`, `features/copilot/domainData.ts` |
| **Production Target** | Supabase `portal_projects` table |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

### 12.2 `mockPortalEvents`

| Field | Value |
|-------|-------|
| **File** | `features/project-portal/data/mockPortalEvents.ts` |
| **Exports** | `mockPortalEvents: PortalEvent[]`, `mockPortalMilestones`, `mockPortalAppointments`, `mockPortalDocuments`, `mockPortalChangeOrders`, `mockPortalContacts`, `mockPortalPhotos`, `mockNotificationPreferences` |
| **Owner Layer** | repo → hook/provider |
| **Read / Write** | Read |
| **Consumers** | `features/project-portal/state/PortalProvider.tsx` |
| **Production Target** | Supabase `portal_events` table (event-sourced) |
| **Prod-Blocking** | 🔴 YES |
| **Migration Status** | not started |

### 12.3 `mockProjects` (adapter-layer portal projects)

| Field | Value |
|-------|-------|
| **File** | `features/project-portal/data/mockProjects.ts` |
| **Exports** | `mockProjects: PortalProject[]`, `MOCK_ORG_A`, `MOCK_ORG_B` |
| **Owner Layer** | repo → adapter |
| **Read / Write** | Read |
| **Consumers** | `features/project-portal/data/mockPortalUsers.ts` (re-exports org IDs) |
| **Production Target** | Merge with `mockPortalProjects` — same Supabase `portal_projects` table |
| **Prod-Blocking** | 🟡 DEV — adapter-layer fixture; duplicates `mockPortalProjects` concept |
| **Migration Status** | not started |

### 12.4 `mockEvents` (event-contract fixtures)

| Field | Value |
|-------|-------|
| **File** | `features/project-portal/data/mockEvents.ts` |
| **Exports** | `mockEventStream: PortalEventEnvelope[]`, `MOCK_PROJECT_ID` |
| **Owner Layer** | repo (test/validation fixture) |
| **Read / Write** | Read |
| **Consumers** | `features/project-portal/__tests__/eventProjection.test.ts`, `features/project-portal/__tests__/portalProjection.test.ts` |
| **Production Target** | N/A — test fixture only; keep as-is but colocate with test files |
| **Prod-Blocking** | 🟢 NO — test fixture only |
| **Migration Status** | not started |

### 12.5 `mockPortalUsers`

| Field | Value |
|-------|-------|
| **File** | `features/project-portal/data/mockPortalUsers.ts` |
| **Exports** | `mockPortalUsers: PortalUser[]` |
| **Owner Layer** | repo → hook/provider (dev auth simulation) |
| **Read / Write** | Read |
| **Consumers** | `features/project-portal/__tests__/portalHome.test.ts`, `features/project-portal/__tests__/notificationPreferences.test.ts` |
| **Production Target** | Supabase Auth `users` + `portal_memberships` table |
| **Prod-Blocking** | 🟡 DEV — used only in tests and local portal auth simulation |
| **Migration Status** | not started |

### 12.6 `mockAdapters` (cross-domain adapter factory)

| Field | Value |
|-------|-------|
| **File** | `features/project-portal/adapters/mockAdapters.ts` |
| **Exports** | `createMockPortalAdapters` (re-exported from `features/project-portal/index.ts`) |
| **Owner Layer** | adapter |
| **Read / Write** | Read (aggregates from jobs, dispatch, daily-plans, reporting, installed-systems) |
| **Consumers** | `features/project-portal/index.ts` (public export), used in local dev / Storybook |
| **Production Target** | Replace with `createPortalAdapters` wired to Supabase services |
| **Prod-Blocking** | 🟡 DEV — dev-only adapter; `fakeAdapters.ts` is the production-safe demo path |
| **Migration Status** | not started |

### 12.7 `fakePortalArtifacts` (static projection records)

| Field | Value |
|-------|-------|
| **File** | `features/project-portal/data/fakePortalArtifacts.ts` |
| **Exports** | `fakeJobsProjectionRecords`, `fakeDailyPlansProjectionRecords`, `fakeDispatchProjectionRecords`, `fakeDocumentsProjectionRecords`, `fakeInstalledSystemsProjectionRecords`, `fakePhotosProjectionRecords`, `fakeChangeOrdersProjectionRecords`, `fakeReportingProjectionRecords`, `fakePortalEvents` |
| **Owner Layer** | repo → adapter |
| **Read / Write** | Read |
| **Consumers** | `features/project-portal/adapters/fakeAdapters.ts`, `features/copilot/domainData.ts` |
| **Production Target** | Replaced by live projection queries against Supabase via portal adapter contracts |
| **Prod-Blocking** | 🟡 DEV — explicitly "fake" (not "mock"); safe for demo but not production data |
| **Migration Status** | not started |

### 12.8 `fakeAdapters`

| Field | Value |
|-------|-------|
| **File** | `features/project-portal/adapters/fakeAdapters.ts` |
| **Exports** | `createFakePortalAdapters` |
| **Owner Layer** | adapter |
| **Read / Write** | Read |
| **Consumers** | Portal demo/staging routes |
| **Production Target** | Replace with real adapter implementations |
| **Prod-Blocking** | 🟡 DEV |
| **Migration Status** | not started |

---

## 13. Installed Systems

### 13.1 `seedInstalledSystems`

| Field | Value |
|-------|-------|
| **File** | `features/installed-systems/data/seedInstalledSystems.ts` |
| **Exports** | `seedInstalledSystems: InstalledSystem[]`, `seedTechnicalProfiles: TechnicalProfile[]` |
| **Owner Layer** | repo → service (via `installedSystemsUtils`) → UI |
| **Read / Write** | Read |
| **Consumers** | `features/installed-systems/utils/installedSystemsUtils.ts`, `features/copilot/domainData.ts`, `features/project-portal/adapters/mockAdapters.ts` |
| **Production Target** | Supabase `installed_systems` + `technical_profiles` tables |
| **Prod-Blocking** | 🔴 YES — installed systems screen and job detail panel read from this seed |
| **Migration Status** | not started |

### 13.2 `estimateEquipmentBundles`

| Field | Value |
|-------|-------|
| **File** | `features/installed-systems/data/estimateEquipmentBundles.ts` |
| **Exports** | `estimateEquipmentBundles: EstimateEquipmentBundle[]` |
| **Owner Layer** | repo → service → UI |
| **Read / Write** | Read |
| **Consumers** | `features/installed-systems/utils/installedSystemsUtils.ts`, `features/jobs/components/JobForm.tsx`, `features/project-portal/adapters/mockAdapters.ts` |
| **Production Target** | Supabase `estimate_equipment_bundles` table (linked to estimate / sold job) |
| **Prod-Blocking** | 🔴 YES — job form equipment selection reads from this |
| **Migration Status** | not started |

### 13.3 `equipmentCatalog`

| Field | Value |
|-------|-------|
| **File** | `features/installed-systems/data/equipmentCatalog.ts` |
| **Exports** | `equipmentCatalog: EquipmentCatalogEntry[]` |
| **Owner Layer** | repo → service → UI |
| **Read / Write** | Read |
| **Consumers** | `features/installed-systems/utils/installedSystemsUtils.ts`, `features/copilot/domainData.ts` |
| **Production Target** | Supabase `equipment_catalog` table (shared reference data; may seed from manufacturer data) |
| **Prod-Blocking** | 🟡 DEV — catalog is reference data; could be promoted to Supabase seed without API changes |
| **Migration Status** | not started |

---

## 14. Auth (Dev Mock Session)

### 14.1 `SessionProvider` (localStorage mock session)

| Field | Value |
|-------|-------|
| **File** | `features/auth/SessionProvider.tsx` |
| **Exports** | `SessionProvider`, `useSession` |
| **Owner Layer** | hook/provider |
| **Read / Write** | Read (localStorage `loop_dev_role` key) |
| **Consumers** | `app/(shell)/layout.tsx` (AppShell wrapper) |
| **Production Target** | Supabase Auth session — `src/lib/auth/session.ts` already exists; wire `useSession` to Supabase client session |
| **Prod-Blocking** | 🔴 YES — role resolution used by all permission guards in production |
| **Migration Status** | not started |

---

## 15. Copilot Search (cross-domain aggregator)

### 15.1 `domainData`

| Field | Value |
|-------|-------|
| **File** | `features/copilot/domainData.ts` |
| **Exports** | `buildSearchIndex: () => SearchRecord[]` |
| **Owner Layer** | service |
| **Read / Write** | Read (aggregates from 10+ mock sources) |
| **Consumers** | `app/api/copilot/search/route.ts` (POST /api/copilot/search) |
| **Production Target** | Replace individual mock imports with Supabase service calls per domain; or add a dedicated search index (e.g. Supabase FTS or pg_trgm) |
| **Prod-Blocking** | 🔴 YES — search returns mock data in production API response |
| **Migration Status** | not started |

---

## Summary Table

| # | Domain | File (short) | Owner Layer | Prod-Blocking | Migration Status |
|---|--------|-------------|-------------|---------------|-----------------|
| 1 | Jobs | `jobs/data/mockJobs.ts` | repo→provider→API | 🔴 YES | not started |
| 2 | Jobs | `jobs/data/mockJobActivity.ts` | repo→provider | 🔴 YES | not started |
| 3 | Properties | `properties/data/mockProperties.ts` | repo→provider→API | 🔴 YES | not started |
| 4 | Properties | `properties/data/mockPropertyDetails.ts` | repo→UI | 🔴 YES | not started |
| 5 | Customers | `customers/data/mockCustomers.ts` | repo→provider→API | 🔴 YES | not started |
| 6 | Customers | `customers/data/mockCustomerDetails.ts` | repo→UI | 🔴 YES | not started |
| 7 | Dispatch | `dispatch/data/mockDispatchPlans.ts` | repo→provider | 🔴 YES | not started |
| 8 | Dispatch | `dispatch/data/mockCrews.ts` | repo→provider | 🔴 YES | not started |
| 9 | Dispatch | `dispatch/data/mockCrewAssignments.ts` | repo→provider | 🔴 YES | not started |
| 10 | Dispatch | `dispatch/data/mockDispatchEvents.ts` | repo→provider | 🔴 YES | not started |
| 11 | Dispatch | `dispatch/data/mockScheduleBlocks.ts` | repo→provider | 🔴 YES | not started |
| 12 | Inventory | `inventory/data/mockInventoryItems.ts` | repo→provider | 🔴 YES | not started |
| 13 | Inventory | `inventory/data/mockInventoryAllocations.ts` | repo→provider | 🔴 YES | not started |
| 14 | Inventory | `inventory/data/mockJobMaterialPlans.ts` | repo→provider | 🔴 YES | not started |
| 15 | Contractors | `contractors/data/mockContractors.ts` | repo→provider | 🔴 YES | not started |
| 16 | Vehicle Alerts | `vehicle-alerts/data/mockVehicleAlerts.ts` | repo→provider | 🔴 YES | not started |
| 17 | Daily Plans | `daily-plans/data/mockMorningOperations.ts` | repo→service→adapter | 🔴 YES | not started |
| 18 | Live Ops | `live-operations/data/mockLiveOps.ts` | repo→UI | 🔴 YES | not started |
| 19 | Reporting | `reporting/data/mockReporting.ts` | repo→provider→service | 🔴 YES | not started |
| 20 | Company Brain | `company-brain/data/mockKnowledgeItems.ts` | repo→provider | 🔴 YES | not started |
| 21 | Company Brain | `company-brain/data/mockKnowledgeRelationships.ts` | repo→provider | 🔴 YES | not started |
| 22 | Company Brain | `company-brain/data/mockKnowledgeUsage.ts` | repo→provider | 🔴 YES | not started |
| 23 | Project Portal | `project-portal/data/mockPortalProjects.ts` | repo→provider→service | 🔴 YES | not started |
| 24 | Project Portal | `project-portal/data/mockPortalEvents.ts` | repo→provider | 🔴 YES | not started |
| 25 | Project Portal | `project-portal/data/mockProjects.ts` | repo→adapter | 🟡 DEV | not started |
| 26 | Project Portal | `project-portal/data/mockEvents.ts` | repo (tests only) | 🟢 NO | not started |
| 27 | Project Portal | `project-portal/data/mockPortalUsers.ts` | repo (tests only) | 🟡 DEV | not started |
| 28 | Project Portal | `project-portal/adapters/mockAdapters.ts` | adapter | 🟡 DEV | not started |
| 29 | Project Portal | `project-portal/data/fakePortalArtifacts.ts` | repo→adapter | 🟡 DEV | not started |
| 30 | Project Portal | `project-portal/adapters/fakeAdapters.ts` | adapter | 🟡 DEV | not started |
| 31 | Installed Systems | `installed-systems/data/seedInstalledSystems.ts` | repo→service→UI | 🔴 YES | not started |
| 32 | Installed Systems | `installed-systems/data/estimateEquipmentBundles.ts` | repo→service→UI | 🔴 YES | not started |
| 33 | Installed Systems | `installed-systems/data/equipmentCatalog.ts` | repo→service | 🟡 DEV | not started |
| 34 | Auth | `auth/SessionProvider.tsx` (localStorage mock) | hook/provider | 🔴 YES | not started |
| 35 | Copilot | `copilot/domainData.ts` (cross-domain) | service | 🔴 YES | not started |

---

## Migration Map

### Production-Blocking Paths (🔴) — Priority Order

| Priority | Domain | Mock Source | Target Supabase Table/Service | Prerequisite |
|----------|--------|------------|-------------------------------|-------------|
| P0 | Auth | `SessionProvider` (localStorage) | Supabase Auth + `src/lib/auth/session.ts` | Supabase Auth project configured |
| P0 | Jobs | `mockJobs` (API routes) | `jobs` table + `src/services/jobs.ts` | Auth migration done |
| P0 | Properties | `mockProperties` (API routes) | `properties` table + `src/services/properties.ts` | Auth migration done |
| P0 | Customers | `mockCustomers` (API routes) | `customers` table | Auth migration done |
| P1 | Jobs | `mockJobActivity` | `job_activity` table | Jobs migration done |
| P1 | Properties | `mockPropertyDetails` | `property_details` (or JSONB on `properties`) | Properties migration done |
| P1 | Customers | `mockCustomerDetails` | Joined query (`customers` + `properties`) | Customers migration done |
| P1 | Dispatch | `mockDispatchPlans` + 4 sub-files | `dispatch_plans`, `crew_assignments`, `dispatch_events` | Jobs migration done |
| P1 | Inventory | `mockInventoryItems` + 2 sub-files | `inventory_items`, `inventory_allocations`, `job_material_plans` | Jobs migration done |
| P1 | Contractors | `mockContractors` | `contractors` table | Auth migration done |
| P2 | Live Ops | `mockLiveOps` | Supabase Realtime on `jobs` + `dispatch_events` | Dispatch migration done |
| P2 | Daily Plans | `mockMorningOperations` | Derived query: `jobs` ∪ `dispatch_plans` ∪ `crew_assignments` | Dispatch migration done |
| P2 | Reporting | `mockReporting` (8 exports) | `kpis`, `performance_summaries`, `benchmarks`, `scorecards` | Jobs + Dispatch done |
| P2 | Company Brain | `mockKnowledgeItems` + 2 sub-files | `knowledge_items`, `knowledge_relationships`, `knowledge_usage` | Auth migration done |
| P2 | Vehicle Alerts | `mockVehicleAlerts` | `vehicle_alerts` table | Auth migration done |
| P2 | Installed Systems | `seedInstalledSystems` + bundles | `installed_systems`, `estimate_equipment_bundles` | Jobs migration done |
| P2 | Project Portal | `mockPortalProjects` + `mockPortalEvents` | `portal_projects`, `portal_events` | Auth + Jobs done |
| P3 | Copilot | `domainData.ts` (cross-domain search) | Supabase FTS or per-domain service calls | All domain migrations done |

### Dev/Demo-Only Paths (🟡) — Not Blocking Production

| Domain | Mock Source | Notes |
|--------|------------|-------|
| Project Portal | `mockProjects.ts` | Consolidate with `mockPortalProjects` before Portal production work |
| Project Portal | `mockAdapters.ts` | Dev adapter — replace with real adapter once upstream services are wired |
| Project Portal | `fakePortalArtifacts.ts` / `fakeAdapters.ts` | Safe for demo; remove after Portal goes live |
| Project Portal | `mockPortalUsers.ts` | Test fixture; move to `__tests__/fixtures/` |
| Installed Systems | `equipmentCatalog.ts` | Promote to Supabase seed data (no code change needed in consumers) |

### Test-Only Paths (🟢) — No Action Required

| Domain | Mock Source | Notes |
|--------|------------|-------|
| Project Portal | `mockEvents.ts` | Event-contract test fixture; move to `__tests__/fixtures/` |

---

## Notes

1. **localStorage pattern** — Jobs, Properties, Customers, Dispatch, Contractors, Vehicle Alerts providers all seed from mock data on first load and persist mutations to `localStorage`. The migration pattern for each is: (a) replace the seed import with a Supabase query hook, (b) replace `localStorage` writes with service mutation calls, (c) delete the mock file. The localStorage keys (`JOBS_STORAGE_KEY` etc.) can be removed once the service layer is wired.

2. **Copilot search** is the highest fan-out consumer: it imports from 10+ mock sources. Migrating individual domains will not automatically fix search. A dedicated migration ticket should update `features/copilot/domainData.ts` to call each domain's service instead of the mock file.

3. **Project Portal has two parallel mock families** — `mock*` (full domain models) and `fake*` (projection records for the adapter layer). They serve different abstractions and should be migrated on separate tracks.

4. **Installed Systems** data files are named `seed*` rather than `mock*` but are functionally identical to mock data — they are static TypeScript arrays serving as an in-memory data store.

5. **`database/fixtures/`** (see `docs/database-seeding.md`) provides deterministic SQL-level fixtures for integration tests. These are separate from the TypeScript mock files above and are not in scope for this inventory.
