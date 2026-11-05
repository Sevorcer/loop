# Brief — Audit cleanup: delete the Part C dead-code files

**Collin's decision (2026-11-05): BLESSED.** The 3-way audit reconciliation is
approved. Note on counts: Part C's summary table said Delete 45 / Park 42, but
its own per-file rows add up to **Delete 37 / Park 49 / False Positive 5**
(+1 ambiguous). This brief follows the **per-file rows** — they carry the
reasoning. The 49 Park files stay untouched.

**Before deleting anything:** re-verify each file below is still unreferenced
on CURRENT main (the tree has moved since the audit's 5141e5c — the overnight
train landed after it). If a file has been wired up since, STOP on that file
and say so on #337; delete only the ones still dead. Full suite + tsc +
production build green before calling it done, same as always.

## Delete (37)
Admin (5):
- src/features/admin/components/organizations/CreateOrganizationDialog.tsx
- src/features/admin/components/organizations/DeactivateOrganizationDialog.tsx
- src/features/admin/components/organizations/EditOrganizationDialog.tsx
- src/features/admin/components/organizations/OrganizationsClient.tsx
- src/features/admin/components/organizations/index.ts

Company Brain (2):
- src/features/company-brain/data/mockKnowledgeRelationships.ts
- src/features/company-brain/data/mockKnowledgeUsage.ts

Customers (1):
- src/features/customers/data/mockCustomerDetails.ts

Dashboard (1):
- src/features/dashboard/MetricCard.tsx

Dispatch (5):
- src/features/dispatch/data/mockCrewAssignments.ts
- src/features/dispatch/data/mockCrews.ts
- src/features/dispatch/data/mockDispatchEvents.ts
- src/features/dispatch/data/mockDispatchPlans.ts
- src/features/dispatch/data/mockScheduleBlocks.ts

Installed Systems (1):
- src/features/installed-systems/components/InstalledSystemDetailPageClient.tsx

Jobs (1):
- src/features/jobs/data/mockJobActivity.ts

Lib (2):
- src/lib/auth/unauthorized.ts
- src/lib/loop-api-client.ts

Live Operations (12):
- src/features/live-operations/components/ActiveCrewBoard.tsx
- src/features/live-operations/components/DecisionFeed.tsx
- src/features/live-operations/components/LiveOpsHero.tsx
- src/features/live-operations/components/MilestoneProgress.tsx
- src/features/live-operations/components/NeedsAttention.tsx
- src/features/live-operations/components/OperationalHealth.tsx
- src/features/live-operations/components/OperationalTimeline.tsx
- src/features/live-operations/data/mockLiveOps.ts
- src/features/live-operations/index.ts
- src/features/live-operations/screens/LiveOperationsScreen.tsx
- src/features/live-operations/types/liveOps.ts
- src/features/live-operations/utils/liveOpsUtils.ts

Properties (1):
- src/features/properties/screens/index.ts

Reporting (3):
- src/features/reporting/components/HealthIndicatorCard.tsx
- src/features/reporting/components/KpiCard.tsx
- src/features/reporting/components/ScorecardSection.tsx

Settings (1):
- src/features/settings/SettingsScreen.tsx

Other (2):
- src/services/adminPolicy.ts
- src/services/supabaseContext.ts

## Verify, then delete only if truly unused (2)
- src/lib/security/index.ts — barrel only; its modules (constantTimeCompare,
  createRateLimiter, verifyMimeType) are LIVE and must stay.
- src/config/nav.config.ts — check usage first (tests/admin tooling may use it).

## Explicitly KEEP (false positives — do not touch)
- src/features/gc-portal/index.ts (its row's "Delete" cell contradicts its own
  analysis: the barrel exports the live GcPortalScreen — KEEP)
- src/lib/auth/routeAccess.ts (live auth chain via proxy.ts)
- src/proxy.ts (the middleware)

## Notes
- The 15 project-portal Park files are superseded by the portal deprecation
  brief (docs/briefs/claude-brief-deprecate-old-portal-2026-11-05.md) — that
  PR removes the whole tree; don't double-handle them here.
- Delete any tests that exist solely for the deleted files; update anything
  that imports them (there should be nothing — that's the point of the audit).
- One PR, prep only — Collin merges.
