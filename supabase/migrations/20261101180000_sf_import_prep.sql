-- Prepare Loop to receive a Service Fusion import.
--
-- Adds a parent account on customers, address fields that were missing,
-- a Service Fusion id so the import can be run again safely, contacts,
-- and the price records Loop did not have: line items, invoices, payments,
-- and estimates.
--
-- This file does not copy any Service Fusion rows. Run it before the importer.
-- It does not change existing customer, job, or price values except to add
-- empty columns.
--
-- Who can see the new money records:
--   owner, manager, office, dispatch, and sales can read and edit job line
--   items, and can read invoices, payments, and estimates.
--   A technician can read line items only on a job assigned to them, and
--   cannot change them. A technician cannot see invoices, payments, or estimates.
--   Portal users are not given access. Revenue reports are unchanged.
--
-- DOWN
--   DROP FUNCTION IF EXISTS public.sf_import_apply_batch(jsonb);
--   DROP TRIGGER IF EXISTS customers_reject_parent_cycle ON public.customers;
--   DROP TRIGGER IF EXISTS customer_contacts_same_company ON public.customer_contacts;
--   DROP TRIGGER IF EXISTS properties_same_company ON public.properties;
--   DROP TRIGGER IF EXISTS job_line_items_same_company ON public.job_line_items;
--   DROP TRIGGER IF EXISTS invoices_same_company ON public.invoices;
--   DROP TRIGGER IF EXISTS payments_same_company ON public.payments;
--   DROP TRIGGER IF EXISTS estimates_same_company ON public.estimates;
--   DROP TRIGGER IF EXISTS estimate_line_items_same_company ON public.estimate_line_items;
--   DROP TRIGGER IF EXISTS time_off_same_company ON public.time_off;
--   DROP FUNCTION IF EXISTS private.enforce_sf_record_same_company();
--   DROP FUNCTION IF EXISTS private.customers_reject_parent_cycle();
--   DROP TABLE IF EXISTS public.estimate_line_items;
--   DROP TABLE IF EXISTS public.estimates;
--   DROP TABLE IF EXISTS public.payments;
--   DROP TABLE IF EXISTS public.invoices;
--   DROP TABLE IF EXISTS public.job_line_items;
--   DROP TABLE IF EXISTS public.customer_contacts;
--   ALTER TABLE public.time_off DROP COLUMN IF EXISTS sf_key;
--   ALTER TABLE public.calendar_tasks DROP COLUMN IF EXISTS sf_id;
--   ALTER TABLE public.job_assignees DROP COLUMN IF EXISTS sf_tech_id;
--   ALTER TABLE public.job_notes DROP COLUMN IF EXISTS sf_key;
--   ALTER TABLE public.job_financials DROP COLUMN IF EXISTS sf_id;
--   ALTER TABLE public.installed_systems DROP COLUMN IF EXISTS attributes;
--   ALTER TABLE public.installed_systems DROP COLUMN IF EXISTS notes;
--   ALTER TABLE public.installed_systems DROP COLUMN IF EXISTS sf_key;
--   ALTER TABLE public.installed_systems DROP COLUMN IF EXISTS sf_id;
--   ALTER TABLE public.jobs DROP COLUMN IF EXISTS sf_tech_names;
--   ALTER TABLE public.jobs DROP COLUMN IF EXISTS sf_status;
--   ALTER TABLE public.jobs DROP COLUMN IF EXISTS sf_id;
--   ALTER TABLE public.properties DROP COLUMN IF EXISTS sf_key;
--   ALTER TABLE public.properties DROP COLUMN IF EXISTS sf_id;
--   ALTER TABLE public.properties DROP COLUMN IF EXISTS zip;
--   ALTER TABLE public.properties DROP COLUMN IF EXISTS state;
--   ALTER TABLE public.customers DROP COLUMN IF EXISTS sf_id;
--   ALTER TABLE public.customers DROP COLUMN IF EXISTS state;
--   ALTER TABLE public.customers DROP COLUMN IF EXISTS parent_customer_id;

-- ---------------------------------------------------------------------------
-- Customers: builder / property-manager parent, state, Service Fusion id
-- ---------------------------------------------------------------------------

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS parent_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sf_id bigint;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_parent_not_self;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_parent_not_self
  CHECK (parent_customer_id IS DISTINCT FROM id);

CREATE UNIQUE INDEX IF NOT EXISTS customers_org_sf_id_uidx
  ON public.customers (org_id, sf_id);

CREATE INDEX IF NOT EXISTS customers_parent_customer_id_idx
  ON public.customers (parent_customer_id);

-- ---------------------------------------------------------------------------
-- Properties: state and zip. Locations from Service Fusion have no id,
-- so sf_key is the stable address key used on a re-run.
-- ---------------------------------------------------------------------------

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS zip text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sf_id bigint,
  ADD COLUMN IF NOT EXISTS sf_key text;

CREATE UNIQUE INDEX IF NOT EXISTS properties_org_sf_id_uidx
  ON public.properties (org_id, sf_id);

CREATE UNIQUE INDEX IF NOT EXISTS properties_org_sf_key_uidx
  ON public.properties (org_id, sf_key);

-- ---------------------------------------------------------------------------
-- Jobs: original Service Fusion status, and names of techs with no Loop login
-- ---------------------------------------------------------------------------

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS sf_id bigint,
  ADD COLUMN IF NOT EXISTS sf_status text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sf_tech_names text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS jobs_org_sf_id_uidx
  ON public.jobs (org_id, sf_id);

ALTER TABLE public.job_financials
  ADD COLUMN IF NOT EXISTS sf_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS job_financials_org_sf_id_uidx
  ON public.job_financials (org_id, sf_id);

ALTER TABLE public.job_notes
  ADD COLUMN IF NOT EXISTS sf_key text;

CREATE UNIQUE INDEX IF NOT EXISTS job_notes_org_sf_key_uidx
  ON public.job_notes (org_id, sf_key);

ALTER TABLE public.job_assignees
  ADD COLUMN IF NOT EXISTS sf_tech_id bigint;

ALTER TABLE public.installed_systems
  ADD COLUMN IF NOT EXISTS sf_id bigint,
  ADD COLUMN IF NOT EXISTS sf_key text,
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS installed_systems_org_sf_id_uidx
  ON public.installed_systems (org_id, sf_id);

CREATE UNIQUE INDEX IF NOT EXISTS installed_systems_org_sf_key_uidx
  ON public.installed_systems (org_id, sf_key);

ALTER TABLE public.calendar_tasks
  ADD COLUMN IF NOT EXISTS sf_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS calendar_tasks_org_sf_id_uidx
  ON public.calendar_tasks (org_id, sf_id);

ALTER TABLE public.time_off
  ADD COLUMN IF NOT EXISTS sf_key text;

CREATE UNIQUE INDEX IF NOT EXISTS time_off_org_sf_key_uidx
  ON public.time_off (org_id, sf_key);

-- ---------------------------------------------------------------------------
-- Extra people on an account
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id),
  customer_id  uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sf_id        bigint,
  sf_key       text,
  name         text NOT NULL DEFAULT '',
  email        text NOT NULL DEFAULT '',
  phone        text NOT NULL DEFAULT '',
  phone2       text NOT NULL DEFAULT '',
  job_title    text NOT NULL DEFAULT '',
  is_primary   boolean NOT NULL DEFAULT false,
  notes        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_contacts_org_sf_id_uidx
  ON public.customer_contacts (org_id, sf_id);

CREATE UNIQUE INDEX IF NOT EXISTS customer_contacts_org_sf_key_uidx
  ON public.customer_contacts (org_id, sf_key);

CREATE INDEX IF NOT EXISTS customer_contacts_customer_idx
  ON public.customer_contacts (org_id, customer_id);

-- ---------------------------------------------------------------------------
-- Prices on a job: services, products, and other charges or discounts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_line_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id),
  job_id         uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sf_id          bigint,
  sf_key         text,
  kind           text NOT NULL CHECK (kind IN ('service', 'product', 'other_charge')),
  name           text NOT NULL DEFAULT '',
  description    text NOT NULL DEFAULT '',
  qty            numeric NOT NULL DEFAULT 1,
  rate_cents     bigint,
  rate_percent   numeric,
  total_cents    bigint,
  cost_cents     bigint,
  taxable        boolean NOT NULL DEFAULT false,
  is_discount    boolean NOT NULL DEFAULT false,
  is_percentage  boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_line_items_org_sf_id_uidx
  ON public.job_line_items (org_id, sf_id);

CREATE UNIQUE INDEX IF NOT EXISTS job_line_items_org_sf_key_uidx
  ON public.job_line_items (org_id, sf_key);

CREATE INDEX IF NOT EXISTS job_line_items_job_idx
  ON public.job_line_items (org_id, job_id);

-- ---------------------------------------------------------------------------
-- Invoices and payments. Card numbers and payment tokens are not stored.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id),
  sf_id          bigint,
  job_id         uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id    uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  number         text NOT NULL DEFAULT '',
  invoice_date   timestamptz,
  total_cents    bigint,
  is_paid        boolean NOT NULL DEFAULT false,
  terms          text NOT NULL DEFAULT '',
  notes          text NOT NULL DEFAULT '',
  currency       text NOT NULL DEFAULT '$',
  po_number      text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_org_sf_id_uidx
  ON public.invoices (org_id, sf_id);

CREATE INDEX IF NOT EXISTS invoices_job_idx
  ON public.invoices (org_id, job_id);

CREATE INDEX IF NOT EXISTS invoices_customer_idx
  ON public.invoices (org_id, customer_id);

CREATE TABLE IF NOT EXISTS public.estimates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id),
  sf_id             bigint,
  customer_id       uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  property_id       uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  number            text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT '',
  description       text NOT NULL DEFAULT '',
  tech_notes        text NOT NULL DEFAULT '',
  total_cents       bigint,
  taxes_fees_cents  bigint,
  street            text NOT NULL DEFAULT '',
  city              text NOT NULL DEFAULT '',
  state             text NOT NULL DEFAULT '',
  zip               text NOT NULL DEFAULT '',
  location_name     text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS estimates_org_sf_id_uidx
  ON public.estimates (org_id, sf_id);

CREATE INDEX IF NOT EXISTS estimates_customer_idx
  ON public.estimates (org_id, customer_id);

CREATE TABLE IF NOT EXISTS public.estimate_line_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id),
  estimate_id    uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  sf_id          bigint,
  sf_key         text,
  kind           text NOT NULL CHECK (kind IN ('service', 'product', 'other_charge')),
  name           text NOT NULL DEFAULT '',
  description    text NOT NULL DEFAULT '',
  qty            numeric NOT NULL DEFAULT 1,
  rate_cents     bigint,
  rate_percent   numeric,
  total_cents    bigint,
  cost_cents     bigint,
  taxable        boolean NOT NULL DEFAULT false,
  is_discount    boolean NOT NULL DEFAULT false,
  is_percentage  boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS estimate_line_items_org_sf_id_uidx
  ON public.estimate_line_items (org_id, sf_id);

CREATE UNIQUE INDEX IF NOT EXISTS estimate_line_items_org_sf_key_uidx
  ON public.estimate_line_items (org_id, sf_key);

CREATE INDEX IF NOT EXISTS estimate_line_items_estimate_idx
  ON public.estimate_line_items (org_id, estimate_id);

CREATE TABLE IF NOT EXISTS public.payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.organizations(id),
  sf_id              bigint,
  sf_key             text,
  job_id             uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  invoice_id         uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  estimate_id        uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
  customer_id        uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  amount_cents       bigint NOT NULL,
  received_on        timestamptz,
  memo               text NOT NULL DEFAULT '',
  payment_type       text NOT NULL DEFAULT '',
  reference_number   text NOT NULL DEFAULT '',
  apply_to           text NOT NULL DEFAULT '',
  transaction_type   text NOT NULL DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_org_sf_id_uidx
  ON public.payments (org_id, sf_id);

CREATE UNIQUE INDEX IF NOT EXISTS payments_org_sf_key_uidx
  ON public.payments (org_id, sf_key);

CREATE INDEX IF NOT EXISTS payments_job_idx
  ON public.payments (org_id, job_id);

CREATE INDEX IF NOT EXISTS payments_invoice_idx
  ON public.payments (org_id, invoice_id);

-- ---------------------------------------------------------------------------
-- A customer cannot be nested under itself, and the parent is in the same company
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.customers_reject_parent_cycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.parent_customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.parent_customer_id IS NOT DISTINCT FROM OLD.parent_customer_id
     AND NEW.org_id IS NOT DISTINCT FROM OLD.org_id THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_customer_id = NEW.id THEN
    RAISE EXCEPTION 'a customer cannot be their own parent';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers parent
    WHERE parent.id = NEW.parent_customer_id
      AND parent.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'parent customer must belong to the same company';
  END IF;
  IF EXISTS (
    WITH RECURSIVE chain AS (
      SELECT parent.parent_customer_id AS id, 1 AS depth
      FROM public.customers parent
      WHERE parent.id = NEW.parent_customer_id
      UNION ALL
      SELECT next_parent.parent_customer_id, chain.depth + 1
      FROM public.customers next_parent
      JOIN chain ON next_parent.id = chain.id
      WHERE next_parent.parent_customer_id IS NOT NULL
        AND chain.depth < 20
    )
    SELECT 1 FROM chain WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'customer parent link would create a cycle';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.customers_reject_parent_cycle() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.customers_reject_parent_cycle() TO authenticated, service_role;

DROP TRIGGER IF EXISTS customers_reject_parent_cycle ON public.customers;
CREATE TRIGGER customers_reject_parent_cycle
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION private.customers_reject_parent_cycle();

CREATE OR REPLACE FUNCTION private.enforce_sf_record_same_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payload jsonb := to_jsonb(NEW);
  company uuid := (payload->>'org_id')::uuid;
BEGIN
  IF company IS NULL THEN
    RAISE EXCEPTION 'company is required';
  END IF;

  IF NULLIF(payload->>'customer_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.customers customer
       WHERE customer.id = (payload->>'customer_id')::uuid
         AND customer.org_id = company
     ) THEN
    RAISE EXCEPTION 'record must belong to a customer in the same company';
  END IF;

  IF NULLIF(payload->>'job_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.jobs job
       WHERE job.id = (payload->>'job_id')::uuid
         AND job.org_id = company
     ) THEN
    RAISE EXCEPTION 'record must belong to a job in the same company';
  END IF;

  IF NULLIF(payload->>'property_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.properties property
       WHERE property.id = (payload->>'property_id')::uuid
         AND property.org_id = company
     ) THEN
    RAISE EXCEPTION 'record must belong to a property in the same company';
  END IF;

  IF NULLIF(payload->>'estimate_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.estimates estimate
       WHERE estimate.id = (payload->>'estimate_id')::uuid
         AND estimate.org_id = company
     ) THEN
    RAISE EXCEPTION 'record must belong to an estimate in the same company';
  END IF;

  IF NULLIF(payload->>'invoice_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.invoices invoice
       WHERE invoice.id = (payload->>'invoice_id')::uuid
         AND invoice.org_id = company
     ) THEN
    RAISE EXCEPTION 'record must belong to an invoice in the same company';
  END IF;

  IF NULLIF(payload->>'user_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_profiles profile
       WHERE profile.id = (payload->>'user_id')::uuid
         AND profile.org_id = company
     ) THEN
    RAISE EXCEPTION 'record must belong to a person in the same company';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_sf_record_same_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.enforce_sf_record_same_company() TO authenticated, service_role;

DROP TRIGGER IF EXISTS customer_contacts_same_company ON public.customer_contacts;
CREATE TRIGGER customer_contacts_same_company
  BEFORE INSERT OR UPDATE ON public.customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_sf_record_same_company();

DROP TRIGGER IF EXISTS properties_same_company ON public.properties;
CREATE TRIGGER properties_same_company
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_sf_record_same_company();

DROP TRIGGER IF EXISTS job_line_items_same_company ON public.job_line_items;
CREATE TRIGGER job_line_items_same_company
  BEFORE INSERT OR UPDATE ON public.job_line_items
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_sf_record_same_company();

DROP TRIGGER IF EXISTS invoices_same_company ON public.invoices;
CREATE TRIGGER invoices_same_company
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_sf_record_same_company();

DROP TRIGGER IF EXISTS payments_same_company ON public.payments;
CREATE TRIGGER payments_same_company
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_sf_record_same_company();

DROP TRIGGER IF EXISTS estimates_same_company ON public.estimates;
CREATE TRIGGER estimates_same_company
  BEFORE INSERT OR UPDATE ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_sf_record_same_company();

DROP TRIGGER IF EXISTS estimate_line_items_same_company ON public.estimate_line_items;
CREATE TRIGGER estimate_line_items_same_company
  BEFORE INSERT OR UPDATE ON public.estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_sf_record_same_company();

DROP TRIGGER IF EXISTS time_off_same_company ON public.time_off;
CREATE TRIGGER time_off_same_company
  BEFORE INSERT OR UPDATE ON public.time_off
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_sf_record_same_company();

-- ---------------------------------------------------------------------------
-- Row security. Portal is intentionally absent.
-- ---------------------------------------------------------------------------

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_line_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_contacts: read for internal operational roles" ON public.customer_contacts;
CREATE POLICY "customer_contacts: read for internal operational roles"
  ON public.customer_contacts FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "customer_contacts: insert for owner/manager/office/sales" ON public.customer_contacts;
CREATE POLICY "customer_contacts: insert for owner/manager/office/sales"
  ON public.customer_contacts FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "customer_contacts: update for owner/manager/office/sales" ON public.customer_contacts;
CREATE POLICY "customer_contacts: update for owner/manager/office/sales"
  ON public.customer_contacts FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'office', 'sales')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "customer_contacts: delete for owner only" ON public.customer_contacts;
CREATE POLICY "customer_contacts: delete for owner only"
  ON public.customer_contacts FOR DELETE
  USING (
    current_app_role() = 'owner'
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_line_items: finance read" ON public.job_line_items;
CREATE POLICY "job_line_items: finance read"
  ON public.job_line_items FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.jobs priced_job
      WHERE priced_job.id = job_line_items.job_id
        AND priced_job.org_id = job_line_items.org_id
    )
  );

DROP POLICY IF EXISTS "job_line_items: finance insert" ON public.job_line_items;
CREATE POLICY "job_line_items: finance insert"
  ON public.job_line_items FOR INSERT
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.jobs priced_job
      WHERE priced_job.id = job_line_items.job_id
        AND priced_job.org_id = job_line_items.org_id
    )
  );

DROP POLICY IF EXISTS "job_line_items: finance update" ON public.job_line_items;
CREATE POLICY "job_line_items: finance update"
  ON public.job_line_items FOR UPDATE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.jobs priced_job
      WHERE priced_job.id = job_line_items.job_id
        AND priced_job.org_id = job_line_items.org_id
    )
  );

DROP POLICY IF EXISTS "job_line_items: finance delete" ON public.job_line_items;
CREATE POLICY "job_line_items: finance delete"
  ON public.job_line_items FOR DELETE
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "job_line_items: tech reads assigned" ON public.job_line_items;
CREATE POLICY "job_line_items: tech reads assigned"
  ON public.job_line_items FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.jobs priced_job
      WHERE priced_job.id = job_line_items.job_id
        AND priced_job.org_id = job_line_items.org_id
        AND (
          priced_job.assigned_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.job_assignees assignee
            WHERE assignee.job_id = priced_job.id
              AND assignee.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "invoices: finance read" ON public.invoices;
CREATE POLICY "invoices: finance read"
  ON public.invoices FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "payments: finance read" ON public.payments;
CREATE POLICY "payments: finance read"
  ON public.payments FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "estimates: finance read" ON public.estimates;
CREATE POLICY "estimates: finance read"
  ON public.estimates FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "estimate_line_items: finance read" ON public.estimate_line_items;
CREATE POLICY "estimate_line_items: finance read"
  ON public.estimate_line_items FOR SELECT
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'office', 'sales')
    AND org_id = current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.estimates estimate
      WHERE estimate.id = estimate_line_items.estimate_id
        AND estimate.org_id = estimate_line_items.org_id
    )
  );

REVOKE ALL ON TABLE public.customer_contacts FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.job_line_items FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.invoices FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.payments FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.estimates FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.estimate_line_items FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.job_line_items TO authenticated;
GRANT SELECT ON TABLE public.invoices TO authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.estimates TO authenticated;
GRANT SELECT ON TABLE public.estimate_line_items TO authenticated;

GRANT ALL ON TABLE public.customer_contacts TO service_role;
GRANT ALL ON TABLE public.job_line_items TO service_role;
GRANT ALL ON TABLE public.invoices TO service_role;
GRANT ALL ON TABLE public.payments TO service_role;
GRANT ALL ON TABLE public.estimates TO service_role;
GRANT ALL ON TABLE public.estimate_line_items TO service_role;

-- ---------------------------------------------------------------------------
-- One batch of already-mapped rows, in a single database transaction.
-- The importer calls this. A signed-in app user cannot.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sf_import_apply_batch(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  company_id uuid;
  table_name text;
  upserted integer := 0;
  row_count integer := 0;
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF jwt_role IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'import denied' USING ERRCODE = '42501';
  END IF;

  company_id := (payload->>'org_id')::uuid;
  table_name := payload->>'table';
  IF company_id IS NULL OR table_name IS NULL THEN
    RAISE EXCEPTION 'import batch needs a company and a table';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = company_id) THEN
    RAISE EXCEPTION 'company not found';
  END IF;
  IF jsonb_typeof(payload->'rows') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'rows') = 0 THEN
    IF table_name IS DISTINCT FROM 'reconcile' THEN
      RETURN jsonb_build_object('upserted', 0);
    END IF;
  END IF;

  IF table_name = 'customers' THEN
    INSERT INTO public.customers (
      org_id, sf_id, name, primary_contact, email, phone, phone2,
      street, city, state, zip, status, notes, last_activity, created_at
    )
    SELECT
      company_id, r.sf_id, r.name, coalesce(r.primary_contact, ''), coalesce(r.email, ''),
      coalesce(r.phone, ''), coalesce(r.phone2, ''), coalesce(r.street, ''),
      coalesce(r.city, ''), coalesce(r.state, ''), coalesce(r.zip, ''),
      coalesce(r.status, 'Active'), coalesce(r.notes, ''), r.last_activity,
      coalesce(r.created_at, now())
    FROM jsonb_to_recordset(payload->'rows') AS r(
      sf_id bigint, name text, primary_contact text, email text, phone text, phone2 text,
      street text, city text, state text, zip text, status text, notes text,
      last_activity date, created_at timestamptz
    )
    ON CONFLICT (org_id, sf_id) DO UPDATE SET
      name = EXCLUDED.name,
      primary_contact = EXCLUDED.primary_contact,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      phone2 = EXCLUDED.phone2,
      street = EXCLUDED.street,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip = EXCLUDED.zip,
      status = EXCLUDED.status,
      notes = EXCLUDED.notes,
      last_activity = EXCLUDED.last_activity,
      updated_at = now();
  ELSIF table_name = 'customer_parents' THEN
    UPDATE public.customers AS child
    SET parent_customer_id = parent.id,
        updated_at = now()
    FROM jsonb_to_recordset(payload->'rows') AS r(sf_id bigint, parent_sf_id bigint)
    JOIN public.customers AS parent
      ON parent.org_id = company_id
     AND parent.sf_id = r.parent_sf_id
    WHERE child.org_id = company_id
      AND child.sf_id = r.sf_id
      AND parent.id <> child.id;
  ELSIF table_name = 'customer_contacts' THEN
    INSERT INTO public.customer_contacts (
      org_id, customer_id, sf_key, name, email, phone, phone2, job_title, is_primary, notes
    )
    SELECT
      company_id, customer.id, r.sf_key, coalesce(r.name, ''), coalesce(r.email, ''),
      coalesce(r.phone, ''), coalesce(r.phone2, ''), coalesce(r.job_title, ''),
      coalesce(r.is_primary, false), coalesce(r.notes, '')
    FROM jsonb_to_recordset(payload->'rows') AS r(
      customer_sf_id bigint, sf_key text, name text, email text, phone text, phone2 text,
      job_title text, is_primary boolean, notes text
    )
    JOIN public.customers customer
      ON customer.org_id = company_id AND customer.sf_id = r.customer_sf_id
    ON CONFLICT (org_id, sf_key) DO UPDATE SET
      customer_id = EXCLUDED.customer_id,
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      phone2 = EXCLUDED.phone2,
      job_title = EXCLUDED.job_title,
      is_primary = EXCLUDED.is_primary,
      notes = EXCLUDED.notes,
      updated_at = now();
  ELSIF table_name = 'properties' THEN
    INSERT INTO public.properties (
      org_id, customer_id, sf_key, name, address, city, state, zip,
      formatted_address, latitude, longitude, type, status
    )
    SELECT
      company_id, customer.id, r.sf_key, r.name, coalesce(r.address, ''),
      coalesce(r.city, ''), coalesce(r.state, ''), coalesce(r.zip, ''),
      nullif(r.formatted_address, ''), r.latitude, r.longitude,
      coalesce(r.type, 'Residential'), coalesce(r.status, 'Active')
    FROM jsonb_to_recordset(payload->'rows') AS r(
      customer_sf_id bigint, sf_key text, name text, address text, city text, state text,
      zip text, formatted_address text, latitude numeric, longitude numeric, type text, status text
    )
    JOIN public.customers customer
      ON customer.org_id = company_id AND customer.sf_id = r.customer_sf_id
    ON CONFLICT (org_id, sf_key) DO UPDATE SET
      customer_id = EXCLUDED.customer_id,
      name = EXCLUDED.name,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip = EXCLUDED.zip,
      formatted_address = EXCLUDED.formatted_address,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      type = EXCLUDED.type,
      status = EXCLUDED.status,
      updated_at = now();
  ELSIF table_name = 'jobs' THEN
    INSERT INTO public.jobs (
      org_id, sf_id, job_number, title, summary, notes, type, status, sf_status, priority,
      customer_id, customer_name, property_id, property_name, location, assigned_to,
      assigned_user_id, sf_tech_names, scheduled_for, scheduled_start_at, scheduled_end_at,
      arrival_window_start_at, arrival_window_end_at, created_at, closeout_mode
    )
    SELECT
      company_id, r.sf_id, r.job_number, r.title, coalesce(r.summary, ''), coalesce(r.notes, ''),
      r.type, r.status, coalesce(r.sf_status, ''), r.priority, customer.id,
      coalesce(r.customer_name, ''), property.id, coalesce(r.property_name, ''),
      coalesce(r.location, ''), coalesce(r.assigned_to, ''), r.assigned_user_id,
      coalesce(r.sf_tech_names, ''), r.scheduled_for, r.scheduled_start_at, r.scheduled_end_at,
      r.arrival_window_start_at, r.arrival_window_end_at, coalesce(r.created_at, now()),
      coalesce(r.closeout_mode, 'full')
    FROM jsonb_to_recordset(payload->'rows') AS r(
      sf_id bigint, customer_sf_id bigint, property_sf_key text, job_number text, title text,
      summary text, notes text, type text, status text, sf_status text, priority text,
      customer_name text, property_name text, location text, assigned_to text,
      assigned_user_id uuid, sf_tech_names text, scheduled_for date, scheduled_start_at timestamptz,
      scheduled_end_at timestamptz, arrival_window_start_at timestamptz,
      arrival_window_end_at timestamptz, created_at timestamptz, closeout_mode text
    )
    JOIN public.customers customer
      ON customer.org_id = company_id AND customer.sf_id = r.customer_sf_id
    LEFT JOIN public.properties property
      ON property.org_id = company_id AND property.sf_key = r.property_sf_key
    ON CONFLICT (org_id, sf_id) DO UPDATE SET
      job_number = EXCLUDED.job_number,
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      notes = EXCLUDED.notes,
      type = EXCLUDED.type,
      status = EXCLUDED.status,
      sf_status = EXCLUDED.sf_status,
      priority = EXCLUDED.priority,
      customer_id = EXCLUDED.customer_id,
      customer_name = EXCLUDED.customer_name,
      property_id = EXCLUDED.property_id,
      property_name = EXCLUDED.property_name,
      location = EXCLUDED.location,
      assigned_to = EXCLUDED.assigned_to,
      assigned_user_id = EXCLUDED.assigned_user_id,
      sf_tech_names = EXCLUDED.sf_tech_names,
      scheduled_for = EXCLUDED.scheduled_for,
      scheduled_start_at = EXCLUDED.scheduled_start_at,
      scheduled_end_at = EXCLUDED.scheduled_end_at,
      arrival_window_start_at = EXCLUDED.arrival_window_start_at,
      arrival_window_end_at = EXCLUDED.arrival_window_end_at,
      closeout_mode = EXCLUDED.closeout_mode,
      updated_at = now();
  ELSIF table_name = 'job_financials' THEN
    INSERT INTO public.job_financials (org_id, job_id, sf_id, revenue_cents)
    SELECT company_id, job.id, job.sf_id, r.revenue_cents
    FROM jsonb_to_recordset(payload->'rows') AS r(job_sf_id bigint, revenue_cents bigint)
    JOIN public.jobs job
      ON job.org_id = company_id AND job.sf_id = r.job_sf_id
    ON CONFLICT (job_id) DO UPDATE SET
      sf_id = EXCLUDED.sf_id,
      revenue_cents = EXCLUDED.revenue_cents,
      updated_at = now();
  ELSIF table_name = 'job_line_items' THEN
    INSERT INTO public.job_line_items (
      org_id, job_id, sf_key, kind, name, description, qty, rate_cents, rate_percent,
      total_cents, cost_cents, taxable, is_discount, is_percentage, sort_order
    )
    SELECT
      company_id, job.id, r.sf_key, r.kind, coalesce(r.name, ''), coalesce(r.description, ''),
      coalesce(r.qty, 1), r.rate_cents, r.rate_percent, r.total_cents, r.cost_cents,
      coalesce(r.taxable, false), coalesce(r.is_discount, false),
      coalesce(r.is_percentage, false), coalesce(r.sort_order, 0)
    FROM jsonb_to_recordset(payload->'rows') AS r(
      owner_sf_id bigint, sf_key text, kind text, name text, description text, qty numeric,
      rate_cents bigint, rate_percent numeric, total_cents bigint, cost_cents bigint,
      taxable boolean, is_discount boolean, is_percentage boolean, sort_order integer
    )
    JOIN public.jobs job
      ON job.org_id = company_id AND job.sf_id = r.owner_sf_id
    ON CONFLICT (org_id, sf_key) DO UPDATE SET
      job_id = EXCLUDED.job_id,
      kind = EXCLUDED.kind,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      qty = EXCLUDED.qty,
      rate_cents = EXCLUDED.rate_cents,
      rate_percent = EXCLUDED.rate_percent,
      total_cents = EXCLUDED.total_cents,
      cost_cents = EXCLUDED.cost_cents,
      taxable = EXCLUDED.taxable,
      is_discount = EXCLUDED.is_discount,
      is_percentage = EXCLUDED.is_percentage,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
  ELSIF table_name = 'job_assignees' THEN
    INSERT INTO public.job_assignees (org_id, job_id, user_id, sf_tech_id)
    SELECT company_id, job.id, profile.id, r.sf_tech_id
    FROM jsonb_to_recordset(payload->'rows') AS r(job_sf_id bigint, user_id uuid, sf_tech_id bigint)
    JOIN public.jobs job
      ON job.org_id = company_id AND job.sf_id = r.job_sf_id
    JOIN public.user_profiles profile
      ON profile.id = r.user_id AND profile.org_id = company_id
    ON CONFLICT (job_id, user_id) DO UPDATE SET
      sf_tech_id = EXCLUDED.sf_tech_id;
  ELSIF table_name = 'job_notes' THEN
    INSERT INTO public.job_notes (org_id, job_id, sf_key, body, author_name, author_role, created_at)
    SELECT
      company_id, job.id, r.sf_key, r.body, coalesce(r.author_name, 'Service Fusion import'),
      coalesce(r.author_role, ''), coalesce(r.created_at, now())
    FROM jsonb_to_recordset(payload->'rows') AS r(
      job_sf_id bigint, sf_key text, body text, author_name text, author_role text, created_at timestamptz
    )
    JOIN public.jobs job
      ON job.org_id = company_id AND job.sf_id = r.job_sf_id
    WHERE btrim(coalesce(r.body, '')) <> ''
    ON CONFLICT (org_id, sf_key) DO UPDATE SET
      body = EXCLUDED.body,
      author_name = EXCLUDED.author_name;
  ELSIF table_name = 'invoices' THEN
    INSERT INTO public.invoices (
      org_id, sf_id, job_id, customer_id, number, invoice_date, total_cents,
      is_paid, terms, notes, currency, po_number
    )
    SELECT
      company_id, r.sf_id, job.id, customer.id, coalesce(r.number, ''), r.invoice_date,
      r.total_cents, coalesce(r.is_paid, false), coalesce(r.terms, ''), coalesce(r.notes, ''),
      coalesce(r.currency, '$'), coalesce(r.po_number, '')
    FROM jsonb_to_recordset(payload->'rows') AS r(
      sf_id bigint, job_sf_id bigint, customer_sf_id bigint, number text, invoice_date timestamptz,
      total_cents bigint, is_paid boolean, terms text, notes text, currency text, po_number text
    )
    LEFT JOIN public.jobs job
      ON job.org_id = company_id AND job.sf_id = r.job_sf_id
    LEFT JOIN public.customers customer
      ON customer.org_id = company_id AND customer.sf_id = r.customer_sf_id
    ON CONFLICT (org_id, sf_id) DO UPDATE SET
      job_id = coalesce(EXCLUDED.job_id, public.invoices.job_id),
      customer_id = coalesce(EXCLUDED.customer_id, public.invoices.customer_id),
      number = EXCLUDED.number,
      invoice_date = EXCLUDED.invoice_date,
      total_cents = EXCLUDED.total_cents,
      is_paid = EXCLUDED.is_paid,
      terms = EXCLUDED.terms,
      notes = EXCLUDED.notes,
      currency = EXCLUDED.currency,
      po_number = EXCLUDED.po_number,
      updated_at = now();
  ELSIF table_name = 'estimates' THEN
    INSERT INTO public.estimates (
      org_id, sf_id, customer_id, property_id, number, status, description, tech_notes,
      total_cents, taxes_fees_cents, street, city, state, zip, location_name, created_at
    )
    SELECT
      company_id, r.sf_id, customer.id, property.id, coalesce(r.number, ''),
      coalesce(r.status, ''), coalesce(r.description, ''), coalesce(r.tech_notes, ''),
      r.total_cents, r.taxes_fees_cents, coalesce(r.street, ''), coalesce(r.city, ''),
      coalesce(r.state, ''), coalesce(r.zip, ''), coalesce(r.location_name, ''),
      coalesce(r.created_at, now())
    FROM jsonb_to_recordset(payload->'rows') AS r(
      sf_id bigint, customer_sf_id bigint, property_sf_key text, number text, status text,
      description text, tech_notes text, total_cents bigint, taxes_fees_cents bigint,
      street text, city text, state text, zip text, location_name text, created_at timestamptz
    )
    LEFT JOIN public.customers customer
      ON customer.org_id = company_id AND customer.sf_id = r.customer_sf_id
    LEFT JOIN public.properties property
      ON property.org_id = company_id AND property.sf_key = r.property_sf_key
    ON CONFLICT (org_id, sf_id) DO UPDATE SET
      customer_id = EXCLUDED.customer_id,
      property_id = EXCLUDED.property_id,
      number = EXCLUDED.number,
      status = EXCLUDED.status,
      description = EXCLUDED.description,
      tech_notes = EXCLUDED.tech_notes,
      total_cents = EXCLUDED.total_cents,
      taxes_fees_cents = EXCLUDED.taxes_fees_cents,
      street = EXCLUDED.street,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip = EXCLUDED.zip,
      location_name = EXCLUDED.location_name,
      updated_at = now();
  ELSIF table_name = 'estimate_line_items' THEN
    INSERT INTO public.estimate_line_items (
      org_id, estimate_id, sf_key, kind, name, description, qty, rate_cents, rate_percent,
      total_cents, cost_cents, taxable, is_discount, is_percentage, sort_order
    )
    SELECT
      company_id, estimate.id, r.sf_key, r.kind, coalesce(r.name, ''), coalesce(r.description, ''),
      coalesce(r.qty, 1), r.rate_cents, r.rate_percent, r.total_cents, r.cost_cents,
      coalesce(r.taxable, false), coalesce(r.is_discount, false),
      coalesce(r.is_percentage, false), coalesce(r.sort_order, 0)
    FROM jsonb_to_recordset(payload->'rows') AS r(
      owner_sf_id bigint, sf_key text, kind text, name text, description text, qty numeric,
      rate_cents bigint, rate_percent numeric, total_cents bigint, cost_cents bigint,
      taxable boolean, is_discount boolean, is_percentage boolean, sort_order integer
    )
    JOIN public.estimates estimate
      ON estimate.org_id = company_id AND estimate.sf_id = r.owner_sf_id
    ON CONFLICT (org_id, sf_key) DO UPDATE SET
      estimate_id = EXCLUDED.estimate_id,
      kind = EXCLUDED.kind,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      qty = EXCLUDED.qty,
      rate_cents = EXCLUDED.rate_cents,
      rate_percent = EXCLUDED.rate_percent,
      total_cents = EXCLUDED.total_cents,
      cost_cents = EXCLUDED.cost_cents,
      taxable = EXCLUDED.taxable,
      is_discount = EXCLUDED.is_discount,
      is_percentage = EXCLUDED.is_percentage,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
  ELSIF table_name = 'payments' THEN
    INSERT INTO public.payments (
      org_id, sf_id, sf_key, job_id, invoice_id, estimate_id, customer_id, amount_cents,
      received_on, memo, payment_type, reference_number, apply_to, transaction_type
    )
    SELECT
      company_id, r.sf_id, r.sf_key, job.id, invoice.id, estimate.id, customer.id, r.amount_cents,
      r.received_on, coalesce(r.memo, ''), coalesce(r.payment_type, ''),
      coalesce(r.reference_number, ''), coalesce(r.apply_to, ''), coalesce(r.transaction_type, '')
    FROM jsonb_to_recordset(payload->'rows') AS r(
      sf_id bigint, sf_key text, job_sf_id bigint, invoice_sf_id bigint, estimate_sf_id bigint,
      customer_sf_id bigint, amount_cents bigint, received_on timestamptz, memo text,
      payment_type text, reference_number text, apply_to text, transaction_type text
    )
    LEFT JOIN public.jobs job
      ON job.org_id = company_id AND job.sf_id = r.job_sf_id
    LEFT JOIN public.invoices invoice
      ON invoice.org_id = company_id AND invoice.sf_id = r.invoice_sf_id
    LEFT JOIN public.estimates estimate
      ON estimate.org_id = company_id AND estimate.sf_id = r.estimate_sf_id
    LEFT JOIN public.customers customer
      ON customer.org_id = company_id AND customer.sf_id = r.customer_sf_id
    ON CONFLICT (org_id, sf_key) DO UPDATE SET
      sf_id = EXCLUDED.sf_id,
      job_id = EXCLUDED.job_id,
      invoice_id = EXCLUDED.invoice_id,
      estimate_id = EXCLUDED.estimate_id,
      customer_id = EXCLUDED.customer_id,
      amount_cents = EXCLUDED.amount_cents,
      received_on = EXCLUDED.received_on,
      memo = EXCLUDED.memo,
      payment_type = EXCLUDED.payment_type,
      reference_number = EXCLUDED.reference_number,
      apply_to = EXCLUDED.apply_to,
      transaction_type = EXCLUDED.transaction_type,
      updated_at = now();
  ELSIF table_name = 'installed_systems' THEN
    INSERT INTO public.installed_systems (
      org_id, sf_id, sf_key, system_name, manufacturer, model_number, serial_numbers,
      install_date, warranty_expiry, location, property_id, property_name, customer_name,
      lifecycle_status, match_state, notes, attributes
    )
    SELECT
      company_id, r.sf_id, r.sf_key, coalesce(r.system_name, 'Equipment'),
      coalesce(r.manufacturer, ''), coalesce(r.model_number, ''),
      CASE
        WHEN nullif(btrim(coalesce(r.serial_number, '')), '') IS NULL THEN '{}'::text[]
        ELSE ARRAY[r.serial_number]::text[]
      END,
      coalesce(r.install_date, ''), coalesce(r.warranty_expiry, ''), coalesce(r.location, ''),
      property.id, coalesce(r.property_name, ''), coalesce(r.customer_name, ''),
      coalesce(r.lifecycle_status, 'Active'), coalesce(r.match_state, 'unmatched'),
      coalesce(r.notes, ''), coalesce(r.attributes, '{}'::jsonb)
    FROM jsonb_to_recordset(payload->'rows') AS r(
      sf_id bigint, sf_key text, customer_sf_id bigint, property_sf_key text, system_name text,
      manufacturer text, model_number text, serial_number text, install_date text,
      warranty_expiry text, location text, property_name text, customer_name text,
      lifecycle_status text, match_state text, notes text, attributes jsonb
    )
    LEFT JOIN public.properties property
      ON property.org_id = company_id AND property.sf_key = r.property_sf_key
    ON CONFLICT (org_id, sf_key) DO UPDATE SET
      sf_id = EXCLUDED.sf_id,
      system_name = EXCLUDED.system_name,
      manufacturer = EXCLUDED.manufacturer,
      model_number = EXCLUDED.model_number,
      serial_numbers = EXCLUDED.serial_numbers,
      install_date = EXCLUDED.install_date,
      warranty_expiry = EXCLUDED.warranty_expiry,
      location = EXCLUDED.location,
      property_id = EXCLUDED.property_id,
      property_name = EXCLUDED.property_name,
      customer_name = EXCLUDED.customer_name,
      lifecycle_status = EXCLUDED.lifecycle_status,
      match_state = EXCLUDED.match_state,
      notes = EXCLUDED.notes,
      attributes = EXCLUDED.attributes,
      updated_at = now();
  ELSIF table_name = 'calendar_tasks' THEN
    INSERT INTO public.calendar_tasks (
      org_id, sf_id, title, description, starts_at, ends_at, all_day, job_id, customer_id, done_at
    )
    SELECT
      company_id, r.sf_id, r.title, coalesce(r.description, ''), r.starts_at, r.ends_at,
      coalesce(r.all_day, false), job.id, customer.id, r.done_at
    FROM jsonb_to_recordset(payload->'rows') AS r(
      sf_id bigint, title text, description text, starts_at timestamptz, ends_at timestamptz,
      all_day boolean, job_sf_id bigint, customer_sf_id bigint, done_at timestamptz
    )
    LEFT JOIN public.jobs job
      ON job.org_id = company_id AND job.sf_id = r.job_sf_id
    LEFT JOIN public.customers customer
      ON customer.org_id = company_id AND customer.sf_id = r.customer_sf_id
    ON CONFLICT (org_id, sf_id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      all_day = EXCLUDED.all_day,
      job_id = EXCLUDED.job_id,
      customer_id = EXCLUDED.customer_id,
      done_at = EXCLUDED.done_at,
      updated_at = now();
  ELSIF table_name = 'calendar_task_assignees' THEN
    INSERT INTO public.calendar_task_assignees (org_id, task_id, user_id)
    SELECT company_id, task.id, profile.id
    FROM jsonb_to_recordset(payload->'rows') AS r(task_sf_id bigint, user_id uuid)
    JOIN public.calendar_tasks task
      ON task.org_id = company_id AND task.sf_id = r.task_sf_id
    JOIN public.user_profiles profile
      ON profile.id = r.user_id AND profile.org_id = company_id
    ON CONFLICT (task_id, user_id) DO NOTHING;
  ELSIF table_name = 'time_off' THEN
    INSERT INTO public.time_off (
      org_id, sf_key, user_id, starts_at, ends_at, all_day, reason, note
    )
    SELECT
      company_id, r.sf_key, profile.id, r.starts_at, r.ends_at, coalesce(r.all_day, false),
      r.reason, coalesce(r.note, '')
    FROM jsonb_to_recordset(payload->'rows') AS r(
      sf_key text, user_id uuid, starts_at timestamptz, ends_at timestamptz,
      all_day boolean, reason text, note text
    )
    JOIN public.user_profiles profile
      ON profile.id = r.user_id AND profile.org_id = company_id
    ON CONFLICT (org_id, sf_key) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      all_day = EXCLUDED.all_day,
      reason = EXCLUDED.reason,
      note = EXCLUDED.note,
      updated_at = now();
  ELSIF table_name = 'reconcile' THEN
    UPDATE public.customers AS customer
    SET property_count = (
          SELECT count(*)::integer
          FROM public.properties property
          WHERE property.customer_id = customer.id
            AND property.org_id = customer.org_id
        ),
        open_jobs = (
          SELECT count(*)::integer
          FROM public.jobs job
          WHERE job.customer_id = customer.id
            AND job.org_id = customer.org_id
            AND job.status NOT IN ('Completed', 'Cancelled')
        ),
        updated_at = now()
    WHERE customer.org_id = company_id
      AND customer.sf_id IS NOT NULL;

    UPDATE public.properties AS property
    SET open_jobs = (
          SELECT count(*)::integer
          FROM public.jobs job
          WHERE job.property_id = property.id
            AND job.org_id = property.org_id
            AND job.status NOT IN ('Completed', 'Cancelled')
        ),
        last_visit = (
          SELECT max(job.scheduled_for)
          FROM public.jobs job
          WHERE job.property_id = property.id
            AND job.org_id = property.org_id
        ),
        updated_at = now()
    WHERE property.org_id = company_id
      AND property.sf_key IS NOT NULL;
  ELSE
    RAISE EXCEPTION 'unknown import table';
  END IF;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  upserted := row_count;
  RETURN jsonb_build_object('upserted', upserted);
END;
$$;

REVOKE ALL ON FUNCTION public.sf_import_apply_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sf_import_apply_batch(jsonb) TO service_role;
