# Billing Phase 1: native LOOP invoices — implementation plan

| | |
|---|---|
| Status | **DRAFT. Waiting for Collin's go on the decisions in section 2. No code, no migrations written.** |
| Parent plan | `docs/briefs/billing-integration-plan-2026-11-06.md` (Phase 1 approved by Collin, Nov 6) |
| Gates | Zoinks runs tsc, full vitest, lint, build, merge simulation, applies migrations to prod, merges. Claude prepares draft PRs only. |
| Workflow | AGENTS.md sprint workflow: plan, approval, implement, build, summarize. |

## 1. What Phase 1 delivers

A job can be turned into a LOOP invoice, edited as a draft, sent/issued with a LOOP-generated number, and paid down by recorded payments. Status and balance are derived, never hand-set. Imported Service Fusion invoices stay read-only history in the same list. No external calls (no QuickBooks, no processor).

## 2. Decisions needed from Collin (with my recommendation)

| # | Decision | Recommendation |
|---|---|---|
| D1 | One invoice book or two? Extend the existing `invoices` table (2,370 imported rows) vs a new table | **Extend `invoices`** and add `source` ('sf_import' \| 'loop'). One list for the customer tab, balances and later aging. Imported rows are frozen by a guard trigger. |
| D2 | Invoice number sequence | LOOP continues your numbering: per-org counter seeded from the highest current number you give me (Service Fusion shows #8290 on 11/03). **I need the highest number QuickBooks has used.** Until answered, the counter ships disabled and the office types the number (current behaviour). |
| D3 | Sales tax | LOOP has **no tax handling today**. Phase 1: a tax rate (percent) on the invoice, defaulted from the customer's billing settings, applied only to lines marked taxable. No rate lookup by address. Confirm this is acceptable, or tell me the rates you use (Service Fusion shows e.g. "Kirkland 10.4%"). |
| D4 | Who can create / issue / record payments | owner, manager, office (same as Ready to Bill). Dispatch and sales read-only. Techs none. |
| D5 | Builder fields | Per-account billing settings (PO required, default terms, invoice copy-list) on a new table `customer_billing_settings`, applied at the **parent account** and inherited by sub-customers. |

## 3. Architecture decisions

- **Server/client split per AGENTS.md:** `src/app/**` routing only; screens in `src/features/billing`; DB access in `src/repositories`; orchestration in `src/services`; server components by default, client components only for the editable draft form and payment dialog.
- **Derived state in SQL, not in the UI.** `invoice_balances` view (security_invoker) returns total, paid, balance, and computed status (draft / issued / partial / paid / overdue / void). `is_paid` stays for imported rows and is kept in sync by trigger for new ones so the existing customer tab keeps working.
- **Payments are append-only** (SELECT+INSERT only; corrections are a reversing negative row with a reason), same standard as the inventory ledger. Reuses `payments` (already has `invoice_id`, type, reference_number).
- **Issuing is a one-way gate.** A draft is editable. Issuing assigns the number and freezes lines and totals by trigger. Changes after issue go through void + reissue or a credit line, never silent edits.
- **Atomic number assignment** in a `SECURITY INVOKER` function using an advisory lock on (org, 'invoice_number'), so two people issuing at once cannot get the same number.
- **Money is integer cents** end to end. Tax rounding done once per invoice in SQL; the UI only displays.
- **Existing Ready to Bill stays**, but its action becomes "Create invoice" (opens the draft) when the job is eligible. It no longer asks for a typed number unless D2 is unanswered. Its empty state and completed-date bugs from note #26 are fixed in this phase.
- **Imported history:** `source='sf_import'`, immutable by guard, shown read-only on the job and customer pages.

## 4. Planned PR split (each a draft PR; Zoinks gates each)

### PR 1: Schema and authorization (M8, one migration + verify)
Migration `<next timestamp after 20261127200000>_billing_phase1`:
- `invoices` gains: `source`, `status` (draft/issued/void), `issued_at`, `due_date`, `terms_days`, `tax_rate_percent`, `subtotal_cents`, `tax_cents`, `parent_customer_id`, `created_by`, `voided_at`, `void_reason`; imported rows backfilled `source='sf_import'`, status `issued`.
- New `invoice_lines` (org, invoice, job_line_item_id nullable, kind, name, description, qty, rate_cents, total_cents, taxable, sort_order), same-org composite FKs.
- New `invoice_number_counters` (one row per org) + `issue_invoice(invoice_id)` function.
- `payments`: add `invoice_id` same-org composite FK check, reversal link, append-only policies for LOOP-source rows (imported rows untouched).
- `customer_billing_settings` (customer_id unique, po_required, default_terms_days, copy_contact_ids uuid[]).
- `invoice_balances` view (security_invoker).
- RLS: ENABLE+FORCE, initplan `(select ...)` policies, REVOKE anon + explicit grants, DOWN section, paired `.verify.sql`, checksum lines appended (append only).
- Same-commit docs: `rls-role-matrix.md`, `endpoint-authz-inventory.md` + changelog; `CoreTables` + `permissionsMatrix.ts` labels + authorization tests.
- Tested against scratch Postgres (role refusals, frozen invoice, concurrent issue, append-only payments, import-row immutability) before I open the PR.

### PR 2: Data layer and domain logic (no UI)
- `src/repositories/invoices.ts`, `invoiceLines.ts`, `payments.ts`, `customerBillingSettings.ts`.
- `src/services/invoicing.ts`: createDraftFromJob (copies job lines and reconciled materials), editDraft, issue, void, recordPayment, reversePayment.
- Pure utils in `src/features/billing/utils`: totals/tax math, status derivation, validation (unit tests, no mocks).
- API routes: `invoices` (list/create), `invoices/[id]` (get/update draft), `invoices/[id]/issue`, `invoices/[id]/void`, `invoices/[id]/payments`.
- Tests: utils, services, routes; follows the existing `vi.mock` conventions (and the lesson from #457: any screen test that mocks a module I extend gets the new exports in the same PR).

### PR 3: UI
- `InvoiceScreen` (draft editor), `InvoicesScreen` (list with status filter), invoice section on the job page and the customer invoices tab, payment dialog, billing settings on the customer (parent) page.
- Ready to Bill action changed to Create invoice; fix the empty state and completed-date issues.
- ATLAS components only: PageHeader, StatusBadge, StatRow, SectionCard; semantic tokens, no hardcoded colors; routes added to `src/lib/routes.ts`.
- Print-ready invoice view (browser print/PDF). Emailing the invoice is **not** in Phase 1.

## 5. Explicitly not in Phase 1
QuickBooks export or sync, payment processing/pay links, emailing invoices, change orders and draws (Phase 2; existing `job_change_orders` table will be reused), recurring invoices, Lane 2/3 files.

## 6. Risks / open items
- D2 and D3 block the number counter and tax; everything else can proceed.
- The `invoices` table is currently read-only for every role; adding writes is a deliberate RLS change, called out in PR 1 and in the authz inventory.
- Imported rows have no line items; the invoice page shows the total only for them.

## 7. Verification (per AGENTS.md checklist)
Zoinks: tsc, full vitest, lint, production build, merge simulation, apply M8 to prod. Mine before each PR: scratch-Postgres test run for the migration, shim test run for pure tests, `@/` import resolution check, checksum verification.
