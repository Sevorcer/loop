# #26 Ready to Bill — end-to-end flow + clarity fixes

| | |
|---|---|
| Audience | Collin + office staff |
| Repo / commit | `github.com/Sevorcer/loop` @ `955fa1a` |
| Live check | Supabase `sygdurkefkasgfefvfcs`, Wed Nov 4, 2026 PT — read-only |
| Scope | Explainer + copy proposals. No builds in this note. |

## Plain-English summary

**Ready to Bill is a checklist of jobs Loop believes are finished and still need a QuickBooks invoice number typed in.** It is **not** Loop's invoice book. Completing a job in Loop flips a hidden "eligible" flag; office (or manager/owner) opens Ready to Bill, picks Install or Service, enters the QB invoice # and date, and the job drops off the list. **Exclude** is for warranty / no-charge / internal work.

**Why the screen looks empty today:** every job in production still has `billing_eligible = false` (3,717 rows). Historical Service Fusion completions were intentionally left ineligible. Meanwhile **2,260** completed jobs already have rows in the `invoices` table from import, and **0** jobs have `billing_status = billed`. The empty state says "All caught up," which teaches the wrong lesson — office thinks billing is done when the feature has simply never been fed.

---

## 1. The real flow (code + schema)

### Fields on `jobs` (migration `20261114000000_billing_ready_to_bill`)

| Field | Meaning |
|---|---|
| `status` | Must be **`Completed`** (Title Case) to appear |
| `billing_eligible` | Set **true only when Loop completes the job** after go-live. Import history stays false. |
| `billing_status` | `unbilled` (default) · `billed` · `excluded` |
| `qb_invoice_number` | Typed from QuickBooks when marking billed |
| `billed_at` / `billed_by` | Date + user id who marked it |

### Step by step

```
Tech/office completes job in Loop
        │
        ▼
jobs.status = 'Completed'
setBillingEligible(jobId)  → billing_eligible = true
(billing_status stays 'unbilled' unless already set)
        │
        ▼
GET /api/billing/ready-to-bill?type=install|service
  filters: org, type Install|Service, status Completed,
           billing_status unbilled, billing_eligible true
  limit 200, order by created_at desc
        │
        ▼
Office clicks Mark Billed → enters QB # + date
POST /api/billing/actions { action: mark_billed, ... }
        │
        ▼
billing_status = billed, qb_invoice_number set, billed_at/by set
Job leaves the list
```

**Exclude path:** `action: exclude` → `billing_status = excluded` (never returns unless unexcluded).

**Roles:** owner, manager, office only (`BILLING_ROLES`). Techs/dispatch/sales cannot open the list.

**Important non-connections**

- Does **not** write `invoices`, `payments`, or `job_line_items`.
- Does **not** create a QuickBooks invoice — someone still invoices in QB; Loop only stores the number.
- "Completed" date shown in the table is currently **`jobs.created_at`**, not the completion activity time (code comment admits this). `getJobCompletionDate()` exists but is unused in the list.

### Live counts (Nov 4, 2026 PT)

| Fact | Count |
|---|---:|
| Jobs total (not deleted) | 3,717 |
| Completed | 3,530 |
| `billing_eligible = true` | **0** |
| `billing_status = billed` | **0** |
| `billing_status = excluded` | **0** |
| Jobs with `qb_invoice_number` | **0** |
| Rows on Ready to Bill list today | **0** |
| `invoices` rows | 2,370 |
| Completed jobs that already have an `invoices` row | 2,260 |
| `job_line_items` | 5,875 |
| `payments` | 1,966 |

Job types in DB: Install 1,417 · Service 1,114 · Maintenance 898 · Inspection 160 · Callback 122 · Estimate 6. **Only Install and Service tabs exist** — Maintenance/Callback/etc. never appear even after a future Loop completion.

Completion side-effect: `src/services/jobs.ts` calls `setBillingEligible` when status becomes Completed.

---

## 2. Plain-English explainer (can paste into help / onboarding)

> **What is Ready to Bill?**  
> After a job is marked Completed in Loop, it shows up here if we still need to bill the customer in QuickBooks. You type the QuickBooks invoice number and the date you billed. That is your signal that office work is done for that job.
>
> **What it is not**  
> It is not the list of every old Service Fusion invoice. Those live in the imported invoice records. It is also not a place that sends an invoice by itself.
>
> **Mark Billed** — use when you created (or found) the QB invoice and want the job off this list.  
> **Exclude** — use for warranty, no-charge, or internal jobs that should never be invoiced.  
> **Install vs Service tabs** — same idea, split so you can work one pile at a time. Maintenance and other types are not on this screen yet.

---

## 3. Where the UI fails to teach this

| UI moment | What it says / does | Why it confuses |
|---|---|---|
| Page empty state | "All caught up" / "No jobs waiting to be billed." | True for the filter, false for the business — 3,530 completed jobs exist; none are eligible. Sounds like billing is finished. |
| Page description | "Jobs completed and awaiting billing…" | Doesn't say "only jobs completed **in Loop after billing went live**." |
| Section title | "Completed Jobs" | Same problem — reads like all completed work. |
| No link to invoices / payments | Money tables are full, UI ignores them | Office may hunt here for SF history and find nothing. |
| Completed column | Uses `created_at` | Looks like ancient jobs when a newly completed job appears later. |
| Exclude control | Icon-only Ban button, title tooltip | Easy to miss; no confirm copy explaining warranty/no-charge. |
| Tabs only Install / Service | Silent about Maintenance etc. | Completing a maintenance job in Loop will never land here. |
| No "why isn't job X here?" help | — | Common support question after go-live. |

---

## 4. Proposed labels + empty-state copy

### Page header

- **Title:** Ready to Bill *(keep)*  
- **Description:**  
  "Jobs finished in Loop that still need a QuickBooks invoice number. Mark billed after you invoice in QuickBooks, or exclude warranty and no-charge work. Older Service Fusion jobs are not listed here on purpose."

### Section title

- **From:** Completed Jobs  
- **To:** Waiting on QuickBooks #

### Tab labels

- Install (n) / Service (n) — keep counts.  
- Optional footnote under tabs: "Maintenance, inspection, and callback billing is not on this list yet."

### Row actions

- Primary button: **Mark billed in QB** (was "Mark Billed")  
- Secondary: **Don't bill** with confirm: "Exclude this job from Ready to Bill? Use for warranty, no-charge, or internal work. You can undo later from support tools."

### Empty states (two, not one)

**A. Truly idle (eligible filter returns 0 AND at least one job was marked billed this week)**  
Title: **You're caught up**  
Body: "No Install/Service jobs are waiting on a QuickBooks number."

**B. Feature-cold / nothing eligible yet (current production)**  
Title: **Nothing in the billing queue yet**  
Body: "Jobs show up here only after someone marks them Completed in Loop. Past Service Fusion jobs stay out of this list. When you finish a job in Loop, it will appear under Install or Service for a QuickBooks number."

### Optional helper strip (always visible)

"This list does not create invoices. Enter the number from QuickBooks after you bill the customer."

---

## 5. Follow-up product choices (for Collin — not in this docs PR)

1. **Backfill policy:** leave historical SF jobs ineligible (current design) vs one-time mark "already billed" when an `invoices` row exists (2,260 jobs) so reporting is honest.  
2. **Add Maintenance (and maybe Callback) tabs** or a single "All billable types" list.  
3. **Show real completion date** via `job_activity` / `getJobCompletionDate`.  
4. **Surface imported invoice #** as read-only context without mixing it into `qb_invoice_number` until office confirms.

---

## 6. Decision ask for Collin

1. Approve the empty-state B copy as the default until the first Loop-completed job appears.  
2. Keep SF history out of Ready to Bill, or backfill "billed" from imported invoices?  
3. Should Maintenance jobs join this queue when completed in Loop?
