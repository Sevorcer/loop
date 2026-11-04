# LOOP — next phase plan (2026-11-04)

State going in: Phase 2 fully live (money layer + scale hardening, main `305634e`, migrations through 20261117000000, suite 1,820). Zero open PRs. Four workstreams below; decisions Collin needs to make are marked **[DECIDE]**.

---

## 1. B8 — drag-to-reschedule (briefed, not started)

**Status:** Brief is written and with Claude since Nov 3 evening (`claude-brief-calendar-drag-2026-11-03.md`). No PRs yet — Claude hasn't picked it up.

**Scope (already decided by Collin):**
- Dispatch board: fix the pin-both-dates bug — a drag **shifts** start+end by the day delta, preserving job length and times of day.
- Month calendar: jobs become draggable with the same shift semantics, using the **same reschedule write path** as dispatch (no parallel path).
- Overlaps **land** — no blocking dialog.
- Completed/cancelled not draggable; plain click still opens the job; day math in America/Los_Angeles.

**Plan:**
1. Nudge Claude via #337 that B8 is the active lane (one-liner from Collin to Claude's session).
2. Claude builds: one PR per surface, or one PR if the handler is shared. Unit tests for the shift math required (single-day, multi-day, month boundary, same-day no-op).
3. Zoinks review: diff + full suite + **`npm run build`** (the new standing gate), then Collin merges on his word.
4. Live check after deploy: drag a multi-day test job on both surfaces, confirm length preserved.

**Risk note:** calendar drag touches CalendarScreen — the file that hid the TDZ crash in D4. Review stays strict there.

---

## 2. Phase 3 — Inspections / permits tracking (needs scoping first)

**What we know about today's workflow (from the record, not guessing):**
- Zowe runs inspections by **email** — she sends scheduling confirmations (e.g. Mallet, Ofstead) and fields inspector assignments (Jeff Woodward, Chris Cockerham, Phil Cowman, Mel Orkney have all appeared by name).
- Inspections come in distinct types with real consequences: rough-in, cover, final — and a missed/mislabelled one slips framing (McBride 920: the Oct 29 ask was a **rough-in**; Zowe still has "ONE permit that just won't get issued").
- Corrections come back as lists (Parsons: condensate, attic access, attic light/receptacle per SMC 306.3.1) and each correction needs an owner + a re-inspection.
- Permits are pulled per job, sometimes more than one (McDonald: 2 inspections, 2 permits).
- Today none of this lives in LOOP — it lives in Zowe's inbox and texts.

**Proposed v1 shape (to validate in scoping):**
- An **Inspections section on the job**: permit # + jurisdiction, inspection type (rough-in / cover / final / other), requested date, scheduled date/window, inspector name, result (pass / fail / partial), correction items as a checklist, re-inspection link.
- An **office view**: "inspections this week" + "awaiting result" + "corrections open" lists, so nothing depends on one inbox.
- Corrections feed the existing checklist system rather than a new silo.

**Scoping questions — these decide the brief. [DECIDE / ask Zowe]**
1. Who books inspections today, start to finish — Zowe alone, or do supers/GCs book some (McBride books through the office normally; Peter Lowell emailed Collin direct)?
2. What does she track outside email right now — a spreadsheet, a notebook, SF fields? Whatever she already maintains defines the must-have columns (same rule as Karl's sheet).
3. Do permit numbers need to live on the job before an inspection can be requested? Who pulls permits?
4. Should LOOP **send** anything (booking emails to the city/GC), or v1 is track-only? (Sending touches the parked outbound-comms decision — provider + cost.)
5. Do failed inspections need to block job completion in the closeout gates, or just be visible?

**Plan:** Collin answers what's his; the Zowe questions go to her as one short list (draft by Zoinks, sent only on Collin's word — no emailing Zowe without it). Then Zoinks writes the Claude brief, same lane discipline as Phase 2.

---

## 3. GC-facing portal (decision round)

**What already exists:** LOOP already has a **customer project portal** (timeline, photos, documents, GC issue intake) from the repo inventory — the GC portal is an *extension* decision, not a green-field build. The internal side is done: multiple contacts, GC ledger, GC Overview (live since last night).

**[DECIDE] — the round Collin parked:**
1. **Who gets access first** — all builders, or one pilot GC (McBride is the obvious candidate: most jobs, most contacts already in)?
2. **What they see** — job progress + photos only? Or money too (their ledger: balances, retainer, invoice status)? Karl's sheet was internal; showing balances to GCs is a business call, not a tech one.
3. **Access method** — named login per GC contact (Super/PM from the new contacts list), or a per-job share link? Logins are safer and reuse contacts; links are zero-friction.
4. **What they can do** — view-only, or also submit (issue intake already exists in the portal — turn it on for GCs?)?

**Plan:** Collin calls the four above → Zoinks scopes what the existing portal already covers vs. the gap → brief to Claude. No build before the decisions.

---

## 4. Small lingering items — full inventory

### A. Build-ready, no decision needed (Claude lane, Zoinks reviews)
1. **S4** — techs can upload files to jobs they're not assigned to; the files API route never loads the job. Add the assignment check.
2. **Job-signatures DELETE org-check** — micro-PR, specced.
3. **B7** — callbacks get `scheduledStartAt` with no `scheduledFor`; align the two.
4. **B12** — SF importer never sets `closeout_mode`; set it on import.
5. **"Completed today" tile link** — the count is right (#321) but the link is date-blind; make it land on today's completions.
6. **#325 re-cut, boundaries only** — loading/error boundaries WITHOUT the `<Link>` restore that failed the tap-test.
7. **AGENTS.md role-drift** — the role-source bullet is wrong (user_profiles first, app_metadata fallback, never user_metadata). Docs fix.
8. **S6–S9 lows** — non-constant-time token compares, no rate limiting, CSV import size cap, upload MIME trusting client type, Zod on 1 of 62 routes. Bundle as one hardening PR or split; none are urgent.

### B. Needs Collin's decision first
9. **B10 tech side** — a tech's plan status can mark completed while job gates are unmet. Office side already decided (keep). Close the tech side the same way, or tighten?
10. **Soft-delete build-out** — behaviour decided (soft-delete), UI parked. Build it, or keep parked?
11. **Daily Plans roster fix** — what's broken vs. intended needs Collin's call on what the roster should show.
12. **sf_tech_names surfacing** — imported jobs carry SF tech names that don't match LOOP users; show them as text on imported jobs, or leave hidden?
13. **Dempsey photos** — SF 1061835122 (4 photos) has no LOOP job. Create the job so the photos can land, or leave them in the export archive?
14. **Three P1 feedback reports** — in-app feedback from the office ladies, awaiting triage. Collin reads, Zoinks routes the fixes.
15. **#291 tab-badge discrepancy** and **#289 remaining nits** — small UI truths; need a look to decide fix vs. accept.
16. **D13 remainders** — partial from Phase 2; scope the leftover at review time.
17. **Unused-index cleanup** — 27-index drop list parked; indexes are cheap insurance until real traffic says otherwise. Recommend: leave until the RLS pass.
18. **231-policy RLS consolidation** — explicitly deferred by Collin Nov 3. Stays deferred unless he reopens it.

### C. Blocked / waiting on something else
19. **D2 re-import** — importer fixed (#304) but the SF export folder isn't on this machine; needs the folder from wherever Collin ran the original import.
20. **SF export resume** — paused at 180 jobs / 1,368 pics; Batch 14 partials recoverable. Resumes only on Collin's go.
21. **Supabase paid tier** — leaked-password protection is Pro-gated and backups matter more as real use widens beyond Crew 2. Money decision, Collin's.

### D. Verify-only (no build — proof gaps)
22. **Tech-side Full closeout on a real pilot job** — owner path proven twice; a Crew 2 tech closing a real job end-to-end is still unobserved.
23. **Service-worker convergence on Collin's phone** — fresh-profile checks pass; whether his phone has rolled to the current build is unproven.

---

Suggested order (superseded by Collin's decisions 2026-11-04 — see below).

---

## Decisions — Collin, 2026-11-04

**GC portal:** (1) ALL builders get access, strictly scoped — a builder sees only THEIR properties/jobs. (2) They can see everything including money, BUT money visibility is **toggleable per job** (office controls it per job). (3) Access = **per-job share link**. (4) GCs can **submit issues/requests**.

**Phase 3 inspections:** (5) **Track only** — no sending in v1. (6) Failed inspections **only show** — they do NOT block closeout. (7) Permit number is **NOT** required on the job before an inspection can be requested. **Scoping COMPLETE 2026-11-04 — Zowe answered by email (see the Phase 3 brief `claude-brief-phase3-inspections-permits-2026-11-04.md`):** she pulls all permits herself; permit numbers live in her Excel sheet of pulled permits (import source; columns = must-have fields); inspections are tracked ONLY on her cubicle wall calendar; supers/GCs book their own inspections when covered under their permit, otherwise she schedules; corrections reach her via city/GC/customer or her next-day check, and she relays them to Collin, who tells the crew; the stuck-permit pattern is Seattle Mechanical permits (condos/duplexes/commercial) with an intake-appointment + corrections loop; other cities call all HVAC permits "Mechanical" while Seattle splits Mechanical vs Single-Family/Duplex; her biggest grief is pulling permits, not scheduling (plus cities rescheduling without notice).

**Small items:** (8) B10 tech side — **tighten** (tech plan status can't mark completed while job gates unmet). (9) Soft-delete UI — **build now**. (10) Daily Plans roster — **DECIDED 2026-11-04 (later message): simplify** — the panel shows ONLY people assigned to that day's jobs, grouped under their crew; the all-techs + assigned-names merge and the invented "On roster" entries go away. (11) sf_tech_names — **leave hidden** (closed). (12) Dempsey photos — **ignore** (closed; photos stay in the export archive). (13) P1 feedback reports — pulled for Collin's read (see below). (14) #291 tab badge + #289 nits — **fix**. (15) Unused indexes — **leave as is** (closed). (16) Supabase paid tier — **not worried** (closed; stays Free).

**The three P1 feedback reports (all status "new", from the Oct 1–2 testing round):**
1. Oct 1, owner: "Bucket not found when Antonio inserts feedback" — feedback screenshot bucket error; likely resolved by the later storage work (#308 era) — VERIFY, don't rebuild blind.
2. Oct 1, tech: starting an already-In-Progress job errors "Invalid transition: job cannot move from 'In Progress' to 'In Progress'" — should be a no-op; small fix candidate.
3. Oct 2, owner: photo uploads not fully saving, one-at-a-time only, Samsung picker offers camera/file but no gallery — partially addressed since; needs a fresh Samsung check before scoping a fix.
