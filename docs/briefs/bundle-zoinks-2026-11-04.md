# Bundle A — Zoinks (fixes & verification)

Source: Collin's live-review list, 2026-11-04 night (file: loop-live-review-list-2026-11-04.md in the same review set).
Rules for every item: diagnose against the LIVE schema/data first (never an imagined one); branch per item or small batch; `npx tsc --noEmit` + full Vitest suite + diff-verify before calling a PR ready; ONE push per branch (Vercel cap); PRs are PREPPED ONLY — no merges, no deploys without Collin's word.

Order:
1. **#15 Restore bug** — clicking Restore on a soft-deleted job says "job not found". Find why (route lookup vs deleted_at filter is the prime suspect), fix, regression test.
2. **#27 GC Overview ~25s load** — profile the builder roll-up path against live data (the recompute over parent/child customers is the suspect); fix the query strategy; target: a few seconds.
3. **#19 Dashboard "New Customers" = 0** — find how it's computed and why it's 0 against live data (1,395 customers exist). Fix the computation OR report back if the tile should be cut (coordinate with Claude bundle dashboard item before removing UI).
4. **#12 Bid panel dark-mode bug** — JobBidPanel status dropdown: white text on white background in dark mode. Fix contrast, check sibling dropdowns in the same panel.
5. **#13 Assigned contractors** — the control routes to "create new contractor" with no way to pick an existing one. Add an assign-existing picker; keep create-new as secondary.
6. **#14 Notes naming** — job-detail Notes currently lives inside Activity; surface/rename it as Notes.
7. **#1 Add job from Calendar** — CalendarScreen has NO create affordance today. Add: a New Job button on Calendar + tapping a day offers New Job with that date prefilled. Verify the form accepts a date param; if it doesn't, add one.
8. **#29/#30 Long-list scrolls** — Jobs list: cap visible list height with its own scroll (~10 rows visible). Permit selects/menus with many options (~75): cap menu height (~4 rows visible) with scroll. Apply the pattern consistently where the same components are reused.

Parked in this lane:
- **#2 Domain** — needs Collin's pick (buy domain / company subdomain / new project). Rename already proved insufficient. No action until he chooses.
