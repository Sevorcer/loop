# Brief — Allison batch 2: Follow-ups + customer invoice tab (#40, #43)

Source: Allison Baker email "Loop Service Items," 2026-11-05. Start this
AFTER batch 1 (separate PR). Both items verified against production code +
live schema on 2026-11-05.

## 1. Follow-ups (#40)
Today there is NO follow-up concept in LOOP. Allison's workflow: a job gets
marked when a part is on order or a return visit is needed, and she works
that list so returns never get missed. Her hard requirement: it must be
SEPARATE from Needs Attention (that section is full of unassigned jobs and
returns would get buried).

Build:
- Migration on `jobs`: `follow_up_needed` boolean NOT NULL default false,
  `follow_up_note` text nullable, `follow_up_marked_at` timestamptz nullable,
  `follow_up_marked_by` uuid nullable. (Next ledger version after
  20261121900000 — check for collisions with in-flight work first.)
- Job detail: a "Follow-up" control (toggle + optional note) — any signed-in
  role can mark/unmark; stamping who/when on mark, clearing on unmark.
- A Follow-ups view she can work from: a filter chip + count on the Jobs
  board AND a card/section on the dashboard listing open follow-ups (job,
  customer, note, marked date, who). One click from the list to the job, and
  unmark without opening the job.
- Do NOT wire it into Needs Attention or closeout. A completed job can still
  be follow-up-marked (that's the normal case: finished, waiting on a part).

## 2. Invoice tab on customer accounts (#43)
Data is ready: `invoices` has customer_id, number, invoice_date, total_cents,
is_paid, job_id (2,370 rows live). Allison wants to see, per customer,
what's been paid vs still waiting — without opening every job.

Build:
- An "Invoices" tab on the customer detail page (next to the existing Jobs
  view): rows of invoice number, date, linked job (link through), total,
  and a Paid / Awaiting badge; header shows the customer's outstanding total
  (sum of unpaid) and paid total.
- Parent/child customers: show the customer's own invoices; if the existing
  page pattern rolls children into the parent elsewhere, match that pattern
  and say which you did on #337.
- Read-only — invoicing stays in QuickBooks; no create/edit here.

## Rules
- Standard gates: migration applied-shape verified against the live schema
  conventions, `npx tsc --noEmit`, FULL Vitest suite, production build — all
  green. Tests for the follow-up mark/unmark flow and the invoice tab query.
- ONE PR for the batch (migration included), one push. Prep only — Collin
  merges. Report back on #337 with the PR number and the migration version.
