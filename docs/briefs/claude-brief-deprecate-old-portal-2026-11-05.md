# Brief — Deprecate the old customer portal (/portal/[projectId])

**Collin's decision (2026-11-05): DEPRECATE.** The legacy project portal at
`/portal/[projectId]` runs on a hardcoded demo user instead of real auth
(Claude's P0 flag). The token-based GC portal at `/gc-portal/[token]` replaces
it. Remove the old portal cleanly.

## Remove
- `src/app/portal/**` — the root portal page/layout, `[projectId]` sub-pages
  (overview, photos, documents, timeline, contact, notifications), and the
  `error/*` pages under it.
- `src/features/project-portal/**` — components, screens, services, data
  (mock projects / fake artifacts), types, utils.
- `src/repositories/portalProjects.ts` and `src/services/portalProjects.ts`
  (they exist only for the old portal; they import its types).
- Any tests that exist solely for the above.

## Untangle, don't amputate
- `src/features/copilot/domainData.ts` imports `mockPortalProjects` and
  `fakePortalArtifacts` from `project-portal/data`. Remove those imports and
  whatever Copilot context they fed (or replace with an honest empty set) —
  Copilot must keep working and its tests stay green. No new mock data.
- Search the tree for any other imports of `@/features/project-portal/*` or
  links to `/portal/...` and remove/repoint them. Nothing in the app should
  link to the old portal afterward.

## Do NOT touch
- `src/app/gc-portal/**` and `src/features/gc-portal/**` — the live GC portal.
- `src/app/api/portal/[token]/**` — the GC portal's token API (share links,
  submit, manuals). The name collision is unfortunate; these stay.

## Verify before calling it done
- `npx tsc --noEmit` clean and the FULL Vitest suite green (update tests that
  pinned old-portal behavior; delete tests that only covered removed code).
- Production build passes (Vitest alone does not prove this).
- `/portal` and `/portal/<anything>` return 404; a `/gc-portal/<token>` page
  still renders.
- One PR, one push (Vercel deploy cap discipline). Do not merge — prep only,
  Collin merges.
