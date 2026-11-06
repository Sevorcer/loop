-- =============================================================================
-- Billing Phase 1 (M8) — native LOOP invoices
--
-- Plan: docs/briefs/billing-phase1-plan-2026-11-06.md (approved by Collin 2026-11-06).
--
--   - invoices            EXTENDED (additive). The 2,370 imported Service Fusion rows become
--                         source='sf_import', status='issued' and stay read-only for app users.
--                         New rows are source='loop' drafts. Totals and tax are computed in SQL
--                         from invoice_lines; an issued invoice is frozen.
--   - invoice_lines       NEW. Editable only while the invoice is a draft.
--   - tax_rates           NEW. Per-org Washington city rates, owner/manager maintained.
--                         Nothing is seeded here; rates change quarterly and are entered, not guessed.
--   - customer_billing_settings   NEW. PO-required, default terms, default tax rate and the
--                         contact roles copied on invoices. Set on a parent account; sub-customers
--                         inherit (resolved at issue time).
--   - invoice_number_counters     NEW. Ships DISABLED: the office keeps typing the QuickBooks-era
--                         number until the owner turns the counter on with a known start.
--   - payments            EXTENDED (additive). LOOP rows are append-only; a correction is a full
--                         reversing row with a reason. Imported rows are untouched.
--   - invoice_balances    NEW view (security_invoker): paid, balance and derived status.
--   - issue_invoice / void_invoice / next_invoice_number  functions. All SECURITY INVOKER except
--                         next_invoice_number (SECURITY DEFINER, the one definer function here) so
--                         that office roles can take the next number without any write access to
--                         the counter table. It takes the org from the session, never a parameter.
--
-- Expand-only: no existing column, constraint or policy is dropped or narrowed. The new write
-- policies on invoices/payments are a deliberate widening: before this migration no role could
-- write either table; now owner/manager/office can write LOOP-source rows only.
-- Imported rows (sf_id import scripts run with the service role, auth.uid() IS NULL) keep working.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP VIEW IF EXISTS public.invoice_balances;
--   DROP FUNCTION IF EXISTS public.void_invoice(uuid, text);
--   DROP FUNCTION IF EXISTS public.issue_invoice(uuid, text);
--   DROP FUNCTION IF EXISTS public.next_invoice_number();
--   DROP TRIGGER IF EXISTS trg_payments_guard ON public.payments;
--   DROP TRIGGER IF EXISTS trg_payments_apply ON public.payments;
--   DROP FUNCTION IF EXISTS public.fn_payments_guard();
--   DROP FUNCTION IF EXISTS public.fn_payments_apply();
--   ALTER TABLE public.payments
--     DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS reverses_payment_id,
--     DROP COLUMN IF EXISTS reason, DROP COLUMN IF EXISTS created_by;
--   DROP TABLE IF EXISTS public.invoice_lines;
--   DROP TRIGGER IF EXISTS trg_invoices_guard ON public.invoices;
--   DROP FUNCTION IF EXISTS public.fn_invoices_guard();
--   DROP FUNCTION IF EXISTS public.fn_invoice_lines_guard();
--   DROP FUNCTION IF EXISTS public.fn_invoice_lines_touch();
--   ALTER TABLE public.invoices
--     DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS issued_at,
--     DROP COLUMN IF EXISTS due_date, DROP COLUMN IF EXISTS terms_days,
--     DROP COLUMN IF EXISTS tax_rate_id, DROP COLUMN IF EXISTS tax_rate_percent,
--     DROP COLUMN IF EXISTS subtotal_cents, DROP COLUMN IF EXISTS tax_cents,
--     DROP COLUMN IF EXISTS bill_to_customer_id, DROP COLUMN IF EXISTS created_by,
--     DROP COLUMN IF EXISTS voided_at, DROP COLUMN IF EXISTS void_reason;
--   DROP TABLE IF EXISTS public.invoice_number_counters;
--   DROP TABLE IF EXISTS public.customer_billing_settings;
--   DROP TABLE IF EXISTS public.tax_rates;
--   (drop the new policies on invoices/payments by name; they are all prefixed "loop ".)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- tax_rates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tax_rates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  jurisdiction_code  text NOT NULL DEFAULT '' CHECK (char_length(jurisdiction_code) <= 20),
  rate_percent       numeric(6, 4) NOT NULL CHECK (rate_percent >= 0 AND rate_percent <= 20),
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_rates_org_name_key UNIQUE (org_id, name),
  CONSTRAINT tax_rates_org_id_id_key UNIQUE (org_id, id)
);

DROP TRIGGER IF EXISTS trg_tax_rates_updated_at ON public.tax_rates;
CREATE TRIGGER trg_tax_rates_updated_at
  BEFORE UPDATE ON public.tax_rates
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- customer_billing_settings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_billing_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id          uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  po_required          boolean NOT NULL DEFAULT false,
  default_terms_days   integer CHECK (default_terms_days IS NULL OR default_terms_days BETWEEN 0 AND 365),
  default_tax_rate_id  uuid,
  copy_contact_roles   text[] NOT NULL DEFAULT '{}'
                       CHECK (copy_contact_roles <@ ARRAY['super', 'pm', 'other']::text[]),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_billing_settings_customer_key UNIQUE (customer_id),
  CONSTRAINT customer_billing_settings_tax_rate_fkey
    FOREIGN KEY (org_id, default_tax_rate_id) REFERENCES public.tax_rates (org_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS customer_billing_settings_org_idx
  ON public.customer_billing_settings (org_id);
CREATE INDEX IF NOT EXISTS customer_billing_settings_tax_rate_idx
  ON public.customer_billing_settings (default_tax_rate_id);

DROP TRIGGER IF EXISTS customer_billing_settings_same_company ON public.customer_billing_settings;
CREATE TRIGGER customer_billing_settings_same_company
  BEFORE INSERT OR UPDATE ON public.customer_billing_settings
  FOR EACH ROW EXECUTE FUNCTION private.enforce_sf_record_same_company();

DROP TRIGGER IF EXISTS trg_customer_billing_settings_updated_at ON public.customer_billing_settings;
CREATE TRIGGER trg_customer_billing_settings_updated_at
  BEFORE UPDATE ON public.customer_billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- invoice_number_counters (ships disabled)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_number_counters (
  org_id       uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled      boolean NOT NULL DEFAULT false,
  prefix       text NOT NULL DEFAULT '' CHECK (char_length(prefix) <= 10),
  next_number  bigint NOT NULL DEFAULT 1 CHECK (next_number >= 1),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_invoice_number_counters_updated_at ON public.invoice_number_counters;
CREATE TRIGGER trg_invoice_number_counters_updated_at
  BEFORE UPDATE ON public.invoice_number_counters
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- invoices — additive columns. Existing rows are the Service Fusion import.
-- ---------------------------------------------------------------------------

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source              text NOT NULL DEFAULT 'sf_import',
  ADD COLUMN IF NOT EXISTS status              text NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS issued_at           timestamptz,
  ADD COLUMN IF NOT EXISTS due_date            date,
  ADD COLUMN IF NOT EXISTS terms_days          integer,
  ADD COLUMN IF NOT EXISTS tax_rate_id         uuid,
  ADD COLUMN IF NOT EXISTS tax_rate_percent    numeric(6, 4),
  ADD COLUMN IF NOT EXISTS subtotal_cents      bigint,
  ADD COLUMN IF NOT EXISTS tax_cents           bigint,
  ADD COLUMN IF NOT EXISTS bill_to_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by          uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_at           timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason         text;

-- Existing rows keep 'sf_import' / 'issued' (the defaults above filled them). New rows are LOOP drafts.
ALTER TABLE public.invoices ALTER COLUMN source SET DEFAULT 'loop';
ALTER TABLE public.invoices ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_source_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_source_check CHECK (source IN ('sf_import', 'loop'));
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'issued', 'void'));
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_terms_days_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_terms_days_check
  CHECK (terms_days IS NULL OR terms_days BETWEEN 0 AND 365);
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_loop_shape_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_loop_shape_check CHECK (
  source = 'sf_import'
  OR (
    (status = 'draft' OR (btrim(number) <> '' AND issued_at IS NOT NULL))
    AND (status <> 'void' OR (void_reason IS NOT NULL AND voided_at IS NOT NULL))
    AND (total_cents IS NULL OR total_cents >= 0)
  )
);

-- invoice_lines depends on this key, so it is added once, never dropped and re-added.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.invoices'::regclass AND conname = 'invoices_org_id_id_key') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_org_id_id_key UNIQUE (org_id, id);
  END IF;
END $$;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_tax_rate_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_tax_rate_fkey
  FOREIGN KEY (org_id, tax_rate_id) REFERENCES public.tax_rates (org_id, id) ON DELETE RESTRICT;

-- A LOOP number is used once, voided or not (a void keeps its number, as in any books).
CREATE UNIQUE INDEX IF NOT EXISTS invoices_loop_number_uidx
  ON public.invoices (org_id, number)
  WHERE source = 'loop' AND btrim(number) <> '';
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (org_id, status);
CREATE INDEX IF NOT EXISTS invoices_bill_to_customer_idx ON public.invoices (bill_to_customer_id);
CREATE INDEX IF NOT EXISTS invoices_created_by_idx ON public.invoices (created_by);
CREATE INDEX IF NOT EXISTS invoices_tax_rate_idx ON public.invoices (tax_rate_id);

-- ---------------------------------------------------------------------------
-- invoice_lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id        uuid NOT NULL,
  job_line_item_id  uuid REFERENCES public.job_line_items(id) ON DELETE SET NULL,
  kind              text NOT NULL DEFAULT 'service'
                    CHECK (kind IN ('service', 'product', 'other_charge', 'change_order')),
  name              text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 300),
  description       text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  qty               numeric(12, 3) NOT NULL DEFAULT 1 CHECK (qty <> 0),
  rate_cents        bigint NOT NULL,
  total_cents       bigint NOT NULL DEFAULT 0,
  taxable           boolean NOT NULL DEFAULT false,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_lines_invoice_fkey
    FOREIGN KEY (org_id, invoice_id) REFERENCES public.invoices (org_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx ON public.invoice_lines (invoice_id, sort_order);
CREATE INDEX IF NOT EXISTS invoice_lines_org_idx ON public.invoice_lines (org_id);
CREATE INDEX IF NOT EXISTS invoice_lines_job_line_item_idx ON public.invoice_lines (job_line_item_id);

-- ---------------------------------------------------------------------------
-- payments — additive columns. Existing rows are the Service Fusion import.
-- ---------------------------------------------------------------------------

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS source              text NOT NULL DEFAULT 'sf_import',
  ADD COLUMN IF NOT EXISTS reverses_payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reason              text,
  ADD COLUMN IF NOT EXISTS created_by          uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.payments ALTER COLUMN source SET DEFAULT 'loop';

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_source_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_source_check CHECK (source IN ('sf_import', 'loop'));
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_loop_shape_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_loop_shape_check CHECK (
  source = 'sf_import'
  OR (
    invoice_id IS NOT NULL
    AND payment_type IN ('check', 'ach', 'card', 'cash', 'other')
    AND (
      (reverses_payment_id IS NULL AND amount_cents > 0)
      OR (reverses_payment_id IS NOT NULL AND amount_cents < 0
          AND reason IS NOT NULL AND char_length(btrim(reason)) BETWEEN 1 AND 500)
    )
  )
);

-- A payment can be reversed once.
CREATE UNIQUE INDEX IF NOT EXISTS payments_reverses_uidx
  ON public.payments (reverses_payment_id) WHERE reverses_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_created_by_idx ON public.payments (created_by);

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

-- Invoices. App sessions (auth.uid() set) may not touch imported rows, may not edit an issued
-- invoice except to void it (via void_invoice) or to flip is_paid (via the payments trigger), and
-- reach 'issued' only through issue_invoice. The transition is announced through the
-- transaction-local setting loop.invoice_op; the importer (service role, auth.uid() NULL) is untouched.
-- For draft rows this also recomputes subtotal, tax and total from the lines, so the numbers a user
-- sees are always the ones SQL computed.
CREATE OR REPLACE FUNCTION public.fn_invoices_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_op       text := COALESCE(current_setting('loop.invoice_op', true), '');
  v_app      boolean := auth.uid() IS NOT NULL;
  v_sub      bigint;
  v_taxable  bigint;
  v_rate     numeric(6, 4);
  v_loose    text[] := ARRAY['updated_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF v_app AND (OLD.source <> 'loop' OR OLD.status <> 'draft') THEN
      RAISE EXCEPTION 'Only a LOOP draft invoice can be deleted' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_app THEN
      IF NEW.source <> 'loop' OR NEW.status <> 'draft' THEN
        RAISE EXCEPTION 'A new invoice is always a LOOP draft' USING ERRCODE = '42501';
      END IF;
      NEW.number := '';
      NEW.issued_at := NULL;
      NEW.due_date := NULL;
      NEW.voided_at := NULL;
      NEW.void_reason := NULL;
      NEW.is_paid := false;
      NEW.created_by := auth.uid();
    END IF;
  ELSE
    IF v_app THEN
      IF OLD.source = 'sf_import' THEN
        RAISE EXCEPTION 'Imported Service Fusion invoices are read-only' USING ERRCODE = '42501';
      END IF;
      IF NEW.source IS DISTINCT FROM OLD.source OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
        RAISE EXCEPTION 'An invoice''s source and company cannot change' USING ERRCODE = '42501';
      END IF;

      IF OLD.status = 'draft' THEN
        IF NEW.status = 'issued' THEN
          IF v_op <> 'issue' THEN
            RAISE EXCEPTION 'Use issue_invoice to issue an invoice' USING ERRCODE = '42501';
          END IF;
          RETURN NEW;   -- issue_invoice sets number, dates and terms itself
        ELSIF NEW.status <> 'draft' THEN
          RAISE EXCEPTION 'A draft can only be issued' USING ERRCODE = '42501';
        END IF;
        IF NEW.number IS DISTINCT FROM OLD.number
           OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
           OR NEW.due_date IS DISTINCT FROM OLD.due_date
           OR NEW.voided_at IS DISTINCT FROM OLD.voided_at
           OR NEW.void_reason IS DISTINCT FROM OLD.void_reason
           OR NEW.is_paid IS DISTINCT FROM OLD.is_paid THEN
          RAISE EXCEPTION 'The number and dates are set when the invoice is issued' USING ERRCODE = '42501';
        END IF;
      ELSIF OLD.status = 'issued' THEN
        IF NEW.status = 'void' THEN
          IF v_op <> 'void' THEN
            RAISE EXCEPTION 'Use void_invoice to void an invoice' USING ERRCODE = '42501';
          END IF;
          v_loose := v_loose || ARRAY['status', 'voided_at', 'void_reason'];
        ELSIF NEW.status <> 'issued' THEN
          RAISE EXCEPTION 'An issued invoice can only be voided' USING ERRCODE = '42501';
        END IF;
        IF NEW.is_paid IS DISTINCT FROM OLD.is_paid THEN
          IF v_op <> 'pay' THEN
            RAISE EXCEPTION 'Paid status follows the recorded payments' USING ERRCODE = '42501';
          END IF;
          v_loose := v_loose || ARRAY['is_paid'];
        END IF;
        IF (to_jsonb(NEW) - v_loose) IS DISTINCT FROM (to_jsonb(OLD) - v_loose) THEN
          RAISE EXCEPTION 'An issued invoice cannot be edited; void it and create a new one' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
      ELSE
        RAISE EXCEPTION 'A voided invoice cannot be changed' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Draft LOOP invoice: bill-to customer in the same company, then recompute the money.
  IF NEW.source = 'loop' AND NEW.status = 'draft' THEN
    IF NEW.bill_to_customer_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.customers AS c
         WHERE c.id = NEW.bill_to_customer_id AND c.org_id = NEW.org_id) THEN
      RAISE EXCEPTION 'The bill-to customer must belong to the same company' USING ERRCODE = '23514';
    END IF;

    IF NEW.tax_rate_id IS NULL THEN
      v_rate := NULL;
    ELSE
      SELECT r.rate_percent INTO v_rate FROM public.tax_rates AS r
       WHERE r.id = NEW.tax_rate_id AND r.org_id = NEW.org_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'That tax rate does not exist' USING ERRCODE = '23503';
      END IF;
    END IF;

    SELECT COALESCE(SUM(l.total_cents), 0),
           COALESCE(SUM(l.total_cents) FILTER (WHERE l.taxable), 0)
      INTO v_sub, v_taxable
      FROM public.invoice_lines AS l
     WHERE l.invoice_id = NEW.id AND l.org_id = NEW.org_id;

    NEW.tax_rate_percent := v_rate;
    NEW.subtotal_cents := v_sub;
    NEW.tax_cents := round(v_taxable * COALESCE(v_rate, 0) / 100)::bigint;
    NEW.total_cents := v_sub + NEW.tax_cents;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_guard ON public.invoices;
CREATE TRIGGER trg_invoices_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_invoices_guard();

-- Invoice lines. The line total is always qty x rate, computed here. Lines change only on a LOOP draft.
CREATE OR REPLACE FUNCTION public.fn_invoice_lines_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
  v_org_id     uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.org_id ELSE NEW.org_id END;
  v_status     text;
  v_source     text;
BEGIN
  SELECT i.status, i.source INTO v_status, v_source
    FROM public.invoices AS i WHERE i.id = v_invoice_id AND i.org_id = v_org_id;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;   -- the invoice itself is being deleted (cascade)
    END IF;
    RAISE EXCEPTION 'The invoice does not exist' USING ERRCODE = '23503';
  END IF;

  IF auth.uid() IS NOT NULL AND (v_source <> 'loop' OR v_status <> 'draft') THEN
    RAISE EXCEPTION 'Lines can only change while the invoice is a LOOP draft' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.invoice_id IS DISTINCT FROM OLD.invoice_id
                           OR NEW.org_id IS DISTINCT FROM OLD.org_id) THEN
    RAISE EXCEPTION 'A line cannot move to another invoice' USING ERRCODE = '42501';
  END IF;

  NEW.total_cents := round(NEW.qty * NEW.rate_cents)::bigint;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_lines_guard ON public.invoice_lines;
CREATE TRIGGER trg_invoice_lines_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_invoice_lines_guard();

-- After any line change, touch the invoice so its guard recomputes the totals.
CREATE OR REPLACE FUNCTION public.fn_invoice_lines_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.invoices
     SET updated_at = now()
   WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END
     AND org_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.org_id ELSE NEW.org_id END
     AND status = 'draft';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_lines_touch ON public.invoice_lines;
CREATE TRIGGER trg_invoice_lines_touch
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_invoice_lines_touch();

-- Payments. Append-only for app sessions and for every LOOP row. A new LOOP payment must hit an
-- issued LOOP invoice and may not push the invoice past its total; a reversal must undo one earlier
-- payment in full. Customer and job come from the invoice, not from the caller.
CREATE OR REPLACE FUNCTION public.fn_payments_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inv   public.invoices%ROWTYPE;
  v_orig  public.payments%ROWTYPE;
  v_paid  bigint;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.source = 'loop' OR auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Payments cannot be changed; record a reversal instead' USING ERRCODE = '42501';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF auth.uid() IS NOT NULL AND NEW.source <> 'loop' THEN
    RAISE EXCEPTION 'Only LOOP payments can be recorded here' USING ERRCODE = '42501';
  END IF;
  IF NEW.source <> 'loop' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_inv FROM public.invoices AS i
   WHERE i.id = NEW.invoice_id AND i.org_id = NEW.org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The invoice does not exist' USING ERRCODE = '23503';
  END IF;
  IF v_inv.source <> 'loop' OR v_inv.status <> 'issued' THEN
    RAISE EXCEPTION 'Payments can only be recorded against an issued LOOP invoice' USING ERRCODE = '23514';
  END IF;

  IF NEW.reverses_payment_id IS NOT NULL THEN
    SELECT * INTO v_orig FROM public.payments AS p
     WHERE p.id = NEW.reverses_payment_id AND p.org_id = NEW.org_id;
    IF NOT FOUND OR v_orig.invoice_id IS DISTINCT FROM NEW.invoice_id
       OR v_orig.reverses_payment_id IS NOT NULL OR v_orig.amount_cents <= 0 THEN
      RAISE EXCEPTION 'A reversal must undo one earlier payment on the same invoice' USING ERRCODE = '23514';
    END IF;
    IF NEW.amount_cents <> -v_orig.amount_cents THEN
      RAISE EXCEPTION 'A reversal must undo the whole payment' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT COALESCE(SUM(p.amount_cents), 0) INTO v_paid
      FROM public.payments AS p WHERE p.invoice_id = NEW.invoice_id;
    IF v_paid + NEW.amount_cents > COALESCE(v_inv.total_cents, 0) THEN
      RAISE EXCEPTION 'That payment is more than the balance on the invoice' USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.customer_id := v_inv.customer_id;
  NEW.job_id := v_inv.job_id;
  NEW.created_by := auth.uid();
  NEW.received_on := COALESCE(NEW.received_on, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_guard ON public.payments;
CREATE TRIGGER trg_payments_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_payments_guard();

-- After a LOOP payment, keep invoices.is_paid in step (the customer invoices tab reads it).
CREATE OR REPLACE FUNCTION public.fn_payments_apply()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_paid  bigint;
BEGIN
  IF NEW.source <> 'loop' THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(i.total_cents, 0) INTO v_total FROM public.invoices AS i WHERE i.id = NEW.invoice_id;
  SELECT COALESCE(SUM(p.amount_cents), 0) INTO v_paid FROM public.payments AS p WHERE p.invoice_id = NEW.invoice_id;

  PERFORM set_config('loop.invoice_op', 'pay', true);
  UPDATE public.invoices SET is_paid = (v_paid >= v_total AND v_total > 0)
   WHERE id = NEW.invoice_id AND is_paid IS DISTINCT FROM (v_paid >= v_total AND v_total > 0);
  PERFORM set_config('loop.invoice_op', '', true);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_apply ON public.payments;
CREATE TRIGGER trg_payments_apply
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_payments_apply();

-- ---------------------------------------------------------------------------
-- invoice_balances — derived paid, balance and display status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.invoice_balances
WITH (security_invoker = true) AS
SELECT
  i.id                                   AS invoice_id,
  i.org_id,
  i.number,
  i.source,
  i.status                               AS invoice_status,
  i.customer_id,
  i.bill_to_customer_id,
  i.job_id,
  i.issued_at,
  i.due_date,
  COALESCE(i.total_cents, 0)             AS total_cents,
  COALESCE(p.paid_cents, 0)              AS paid_cents,
  CASE WHEN i.status <> 'issued' OR i.is_paid THEN 0
       ELSE GREATEST(COALESCE(i.total_cents, 0) - COALESCE(p.paid_cents, 0), 0) END AS balance_cents,
  CASE
    WHEN i.status = 'draft' THEN 'draft'
    WHEN i.status = 'void' THEN 'void'
    WHEN i.is_paid THEN 'paid'
    WHEN i.due_date IS NOT NULL AND i.due_date < current_date THEN 'overdue'
    WHEN COALESCE(p.paid_cents, 0) > 0 THEN 'partial'
    ELSE 'issued'
  END                                    AS display_status
FROM public.invoices AS i
LEFT JOIN (
  SELECT pay.invoice_id, SUM(pay.amount_cents) AS paid_cents
  FROM public.payments AS pay
  WHERE pay.invoice_id IS NOT NULL
  GROUP BY pay.invoice_id
) AS p ON p.invoice_id = i.id;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Takes the next number when the owner has enabled the counter; NULL when it is off.
-- SECURITY DEFINER so office roles never need write access to the counter table. The org comes
-- from the session, never a parameter, and the role is re-checked here.
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org     uuid := public.current_org_id();
  v_counter public.invoice_number_counters%ROWTYPE;
BEGIN
  IF public.current_app_role() NOT IN ('owner', 'manager', 'office') OR v_org IS NULL THEN
    RAISE EXCEPTION 'Not allowed to issue invoices' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_counter FROM public.invoice_number_counters AS c
   WHERE c.org_id = v_org FOR UPDATE;
  IF NOT FOUND OR NOT v_counter.enabled THEN
    RETURN NULL;
  END IF;

  UPDATE public.invoice_number_counters SET next_number = next_number + 1 WHERE org_id = v_org;
  RETURN v_counter.prefix || v_counter.next_number::text;
END;
$$;

-- Issue a draft: assign the number, freeze it, set the due date. Enforces the parent account's
-- PO-required rule and picks up its default terms when the invoice has none.
CREATE OR REPLACE FUNCTION public.issue_invoice(p_invoice_id uuid, p_number text DEFAULT NULL)
RETURNS public.invoices
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org      uuid := current_org_id();
  v_inv      public.invoices%ROWTYPE;
  v_parent   uuid;
  v_po_req   boolean;
  v_terms    integer;
  v_number   text;
  v_row      public.invoices%ROWTYPE;
BEGIN
  IF current_app_role() NOT IN ('owner', 'manager', 'office') THEN
    RAISE EXCEPTION 'Not allowed to issue invoices' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.invoices AS i
   WHERE i.id = p_invoice_id AND i.org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_inv.source <> 'loop' OR v_inv.status <> 'draft' THEN
    RAISE EXCEPTION 'Only a LOOP draft can be issued' USING ERRCODE = '23514';
  END IF;
  IF v_inv.customer_id IS NULL THEN
    RAISE EXCEPTION 'The invoice needs a customer' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.invoice_lines AS l WHERE l.invoice_id = v_inv.id) THEN
    RAISE EXCEPTION 'The invoice has no lines' USING ERRCODE = '23514';
  END IF;

  -- Settings come from the customer, else its parent account.
  SELECT c.parent_customer_id INTO v_parent FROM public.customers AS c WHERE c.id = v_inv.customer_id;
  SELECT s.po_required, s.default_terms_days INTO v_po_req, v_terms
    FROM public.customer_billing_settings AS s
   WHERE s.org_id = v_org AND s.customer_id IN (v_inv.customer_id, v_parent)
   ORDER BY (s.customer_id = v_inv.customer_id) DESC
   LIMIT 1;

  IF COALESCE(v_po_req, false) AND btrim(v_inv.po_number) = '' THEN
    RAISE EXCEPTION 'This account requires a PO number on every invoice' USING ERRCODE = '23514';
  END IF;

  v_number := NULLIF(btrim(COALESCE(p_number, '')), '');
  IF v_number IS NULL THEN
    v_number := public.next_invoice_number();
  END IF;
  IF v_number IS NULL THEN
    RAISE EXCEPTION 'Enter an invoice number (the automatic counter is off)' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices AS o
              WHERE o.org_id = v_org AND o.id <> v_inv.id AND btrim(o.number) = v_number) THEN
    RAISE EXCEPTION 'Invoice number % is already used', v_number USING ERRCODE = '23505';
  END IF;

  PERFORM set_config('loop.invoice_op', 'issue', true);
  UPDATE public.invoices
     SET status = 'issued',
         number = v_number,
         issued_at = now(),
         terms_days = COALESCE(v_inv.terms_days, v_terms, 0),
         due_date = current_date + COALESCE(v_inv.terms_days, v_terms, 0),
         terms = CASE WHEN COALESCE(v_inv.terms_days, v_terms, 0) = 0 THEN 'Due upon receipt'
                      ELSE 'Net ' || COALESCE(v_inv.terms_days, v_terms)::text END
   WHERE id = v_inv.id
   RETURNING * INTO v_row;
  PERFORM set_config('loop.invoice_op', '', true);
  RETURN v_row;
END;
$$;

-- Void an issued invoice that has no net payments. A paid invoice must have its payments reversed first.
CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id uuid, p_reason text)
RETURNS public.invoices
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org   uuid := current_org_id();
  v_inv   public.invoices%ROWTYPE;
  v_net   bigint;
  v_row   public.invoices%ROWTYPE;
BEGIN
  IF current_app_role() NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'Only an owner or manager can void an invoice' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' OR char_length(p_reason) > 500 THEN
    RAISE EXCEPTION 'A reason (up to 500 characters) is required' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_inv FROM public.invoices AS i
   WHERE i.id = p_invoice_id AND i.org_id = v_org FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_inv.source <> 'loop' OR v_inv.status <> 'issued' THEN
    RAISE EXCEPTION 'Only an issued LOOP invoice can be voided' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(p.amount_cents), 0) INTO v_net FROM public.payments AS p WHERE p.invoice_id = v_inv.id;
  IF v_net <> 0 THEN
    RAISE EXCEPTION 'Reverse the payments on this invoice before voiding it' USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('loop.invoice_op', 'void', true);
  UPDATE public.invoices
     SET status = 'void', voided_at = now(), void_reason = btrim(p_reason)
   WHERE id = v_inv.id
   RETURNING * INTO v_row;
  PERFORM set_config('loop.invoice_op', '', true);
  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_billing_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_number_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_number_counters FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.tax_rates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tax_rates TO authenticated;
REVOKE ALL ON public.customer_billing_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customer_billing_settings TO authenticated;
REVOKE ALL ON public.invoice_number_counters FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoice_number_counters TO authenticated;
REVOKE ALL ON public.invoice_lines FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_lines TO authenticated;
REVOKE ALL ON public.invoices FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
REVOKE ALL ON public.payments FROM anon, authenticated;
GRANT SELECT, INSERT ON public.payments TO authenticated;
REVOKE ALL ON public.invoice_balances FROM anon, authenticated;
GRANT SELECT ON public.invoice_balances TO authenticated;

-- tax_rates: finance roles read; owner/manager maintain (a rate changes money everywhere).
DROP POLICY IF EXISTS "tax_rates: finance read" ON public.tax_rates;
CREATE POLICY "tax_rates: finance read"
  ON public.tax_rates FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
         AND org_id = (select current_org_id()));
DROP POLICY IF EXISTS "tax_rates: owner manager insert" ON public.tax_rates;
CREATE POLICY "tax_rates: owner manager insert"
  ON public.tax_rates FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager') AND org_id = (select current_org_id()));
DROP POLICY IF EXISTS "tax_rates: owner manager update" ON public.tax_rates;
CREATE POLICY "tax_rates: owner manager update"
  ON public.tax_rates FOR UPDATE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager') AND org_id = (select current_org_id()))
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager') AND org_id = (select current_org_id()));

-- customer_billing_settings: finance roles read; office roles maintain.
DROP POLICY IF EXISTS "customer_billing_settings: finance read" ON public.customer_billing_settings;
CREATE POLICY "customer_billing_settings: finance read"
  ON public.customer_billing_settings FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
         AND org_id = (select current_org_id()));
DROP POLICY IF EXISTS "customer_billing_settings: office insert" ON public.customer_billing_settings;
CREATE POLICY "customer_billing_settings: office insert"
  ON public.customer_billing_settings FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office') AND org_id = (select current_org_id()));
DROP POLICY IF EXISTS "customer_billing_settings: office update" ON public.customer_billing_settings;
CREATE POLICY "customer_billing_settings: office update"
  ON public.customer_billing_settings FOR UPDATE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'office') AND org_id = (select current_org_id()))
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office') AND org_id = (select current_org_id()));

-- invoice_number_counters: owner turns it on and sets the start; manager and office read.
DROP POLICY IF EXISTS "invoice_number_counters: office read" ON public.invoice_number_counters;
CREATE POLICY "invoice_number_counters: office read"
  ON public.invoice_number_counters FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'office') AND org_id = (select current_org_id()));
DROP POLICY IF EXISTS "invoice_number_counters: owner insert" ON public.invoice_number_counters;
CREATE POLICY "invoice_number_counters: owner insert"
  ON public.invoice_number_counters FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) = 'owner' AND org_id = (select current_org_id()));
DROP POLICY IF EXISTS "invoice_number_counters: owner update" ON public.invoice_number_counters;
CREATE POLICY "invoice_number_counters: owner update"
  ON public.invoice_number_counters FOR UPDATE TO authenticated
  USING ((select current_app_role()) = 'owner' AND org_id = (select current_org_id()))
  WITH CHECK ((select current_app_role()) = 'owner' AND org_id = (select current_org_id()));

-- invoices: the existing "invoices: finance read" policy stays. New writes are LOOP-source only.
DROP POLICY IF EXISTS "loop invoices: office insert" ON public.invoices;
CREATE POLICY "loop invoices: office insert"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office')
              AND org_id = (select current_org_id())
              AND source = 'loop' AND status = 'draft');
DROP POLICY IF EXISTS "loop invoices: office update" ON public.invoices;
CREATE POLICY "loop invoices: office update"
  ON public.invoices FOR UPDATE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'office')
         AND org_id = (select current_org_id()) AND source = 'loop')
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office')
              AND org_id = (select current_org_id()) AND source = 'loop');
DROP POLICY IF EXISTS "loop invoices: office delete draft" ON public.invoices;
CREATE POLICY "loop invoices: office delete draft"
  ON public.invoices FOR DELETE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'office')
         AND org_id = (select current_org_id()) AND source = 'loop' AND status = 'draft');

-- invoice_lines: finance roles read; office roles write (the guard limits writes to drafts).
DROP POLICY IF EXISTS "loop invoice_lines: finance read" ON public.invoice_lines;
CREATE POLICY "loop invoice_lines: finance read"
  ON public.invoice_lines FOR SELECT TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office', 'sales')
         AND org_id = (select current_org_id()));
DROP POLICY IF EXISTS "loop invoice_lines: office insert" ON public.invoice_lines;
CREATE POLICY "loop invoice_lines: office insert"
  ON public.invoice_lines FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office') AND org_id = (select current_org_id()));
DROP POLICY IF EXISTS "loop invoice_lines: office update" ON public.invoice_lines;
CREATE POLICY "loop invoice_lines: office update"
  ON public.invoice_lines FOR UPDATE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'office') AND org_id = (select current_org_id()))
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office') AND org_id = (select current_org_id()));
DROP POLICY IF EXISTS "loop invoice_lines: office delete" ON public.invoice_lines;
CREATE POLICY "loop invoice_lines: office delete"
  ON public.invoice_lines FOR DELETE TO authenticated
  USING ((select current_app_role()) IN ('owner', 'manager', 'office') AND org_id = (select current_org_id()));

-- payments: the existing "payments: finance read" policy stays. Office roles append LOOP rows only.
DROP POLICY IF EXISTS "loop payments: office insert" ON public.payments;
CREATE POLICY "loop payments: office insert"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK ((select current_app_role()) IN ('owner', 'manager', 'office')
              AND org_id = (select current_org_id()) AND source = 'loop');

REVOKE EXECUTE ON FUNCTION public.fn_invoices_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_invoice_lines_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_invoice_lines_touch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_payments_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_payments_apply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.issue_invoice(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_invoice(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_invoice(uuid, text) TO authenticated;
