-- =============================================================================
-- Migration 20261116000000 — GC Tracking Ledger
--
-- Two tables for the general-contractor (GC/builder) billing ledger:
--
--   gc_ledger_entries — one row per job under a builder customer, storing the
--     money fields that are NOT already tracked in other tables (job_bids for
--     price, jobs.qb_invoice_number for invoice #). Includes estimate number,
--     GC P.O. number, invoice sent/received dates, balance, retainer, and notes.
--
--   gc_change_orders — repeatable entries per ledger row, each with its own
--     change order number, amount, and description.
--
-- RLS:
--   SELECT — owner, manager, dispatch, office, sales (same-org)
--   INSERT — owner, manager, office (same-org)
--   UPDATE — owner, manager, office (same-org)
--   DELETE — owner only (same-org)
--
-- Depends on: organizations, jobs (baseline). Composes with:
--   Task 2 (jobs.qb_invoice_number) — read at query time, not duplicated
--   Task 3 (job_bids.amount_cents)  — read at query time, not duplicated
-- =============================================================================

-- ---------------------------------------------------------------------------
-- gc_ledger_entries
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gc_ledger_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.organizations(id),
  job_id           uuid        NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  estimate_number  text        NOT NULL DEFAULT '',
  gc_po_number     text        NOT NULL DEFAULT '',
  date_sent        date,
  date_received    date,
  balance_cents    bigint      NOT NULL DEFAULT 0,
  retainer_cents   bigint      NOT NULL DEFAULT 0,
  notes            text        NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gc_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gc_ledger_entries_org_select"
  ON public.gc_ledger_entries FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','office','sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "gc_ledger_entries_office_insert"
  ON public.gc_ledger_entries FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager','office')
    AND org_id = current_org_id()
  );

CREATE POLICY "gc_ledger_entries_office_update"
  ON public.gc_ledger_entries FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager','office')
    AND org_id = current_org_id()
  );

CREATE POLICY "gc_ledger_entries_owner_delete"
  ON public.gc_ledger_entries FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

-- Index for looking up entries by job
CREATE INDEX IF NOT EXISTS idx_gc_ledger_entries_org_id ON public.gc_ledger_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_gc_ledger_entries_job_id ON public.gc_ledger_entries(job_id);

-- ---------------------------------------------------------------------------
-- gc_change_orders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gc_change_orders (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES public.organizations(id),
  ledger_entry_id       uuid        NOT NULL REFERENCES public.gc_ledger_entries(id) ON DELETE CASCADE,
  change_order_number   text        NOT NULL DEFAULT '',
  amount_cents          bigint      NOT NULL DEFAULT 0,
  description           text        NOT NULL DEFAULT '',
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gc_change_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gc_change_orders_org_select"
  ON public.gc_change_orders FOR SELECT
  USING (
    current_app_role() IN ('owner','manager','dispatch','office','sales')
    AND org_id = current_org_id()
  );

CREATE POLICY "gc_change_orders_office_insert"
  ON public.gc_change_orders FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner','manager','office')
    AND org_id = current_org_id()
  );

CREATE POLICY "gc_change_orders_office_update"
  ON public.gc_change_orders FOR UPDATE
  USING (
    current_app_role() IN ('owner','manager','office')
    AND org_id = current_org_id()
  );

CREATE POLICY "gc_change_orders_owner_delete"
  ON public.gc_change_orders FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

CREATE INDEX IF NOT EXISTS idx_gc_change_orders_ledger_entry_id ON public.gc_change_orders(ledger_entry_id);
CREATE INDEX IF NOT EXISTS idx_gc_change_orders_org_id ON public.gc_change_orders(org_id);
