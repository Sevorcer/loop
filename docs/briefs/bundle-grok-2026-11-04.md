# Bundle C — Grok (performance, data model, platform research/design)

Source: Collin's live-review list, 2026-11-04 night.
Rules: read-only audits stay read-only until Collin approves a fix; verify against the LIVE schema/data, not docs; DB work ships as migration + verify files; ONE push per branch (Vercel cap); PRs PREPPED ONLY — no merges without Collin's word.

## 1. Performance pass (#16 + support #27)
- Collin: "everything just feels and loads slow... drags.. annoying." Profile the main screens (Jobs, Customers, GC Overview, Reports, Permits) against production data volumes; find the top offenders (full-table reads, N+1, client-side recompute). Zoinks owns the GC Overview root-cause fix (#27) — verify his fix independently and take the REST of the surfaces. Deliver: findings doc + fix PRs for the worst three.
- **#17 Priority system** — Collin is "not really a fan" of how priority works/shows on the Jobs page. Document how it currently works, propose 2–3 alternatives — design note only, Collin picks.

## 2. Dispatch: materials + technical data (#23)
- Collin: "we have no way to satisfy and check materials for jobs.. technical data should be auto added to job based on equipment that is entered. this whole dispatch tab feels clunky and just ugly."
- Design + build the data model: per-job materials list (needed/on-truck/used states) and a technical-data panel auto-populated from the job's entered/installed equipment. Dispatch UX cleanup scoped to what the new panels require; big visual overhaul proposals go in a design note first.

## 3. Manuals platform (#33 → #32 → #8, in that order)
- **#33 Company Brain ↔ Google Drive** — link the Company Brain to Collin's Google Drive library (manuals etc.): index Drive files, keep Drive as source of truth.
- **#32 Installed Systems as manuals home** — each system record absorbs/auto-places its info and attaches its manual(s) from the Brain inventory by model match.
- **#8 Copilot auto-match** — when equipment is entered on a job, Copilot auto-detects the matching manual from the inventory and links it (feeds the portal's digital-manual section — coordinate the link shape with Claude's portal v2 lane).

## 4. Design/research notes (no builds)
- **#34 Inventory** — survey 3–5 inventory systems (Service Fusion's, ServiceTitan, Housecall Pro, Sortly-style): stock/truck-stock/purchasing/job-costing models + a recommendation for LOOP's shape.
- **#24 Daily Plans** — brainstorm doc: how the page should work (roster = people on that day's jobs grouped by crew is decided; go further: day shape, print/handout view, who edits).
- **#25 Operations tab redundancy** — audit what Operations duplicates vs Dispatch/Daily Plans/Command Center; recommend keep/merge/cut.
- **#26 Ready to Bill clarity** — trace the flow end-to-end and write the plain-English explainer + propose labels/empty-state copy.
