-- Service Fusion import: emit a backdated completion activity event.
--
-- Imported "Completed" jobs showed up in "Completed today" forever because the
-- upsert stamps jobs.updated_at = now() and both dashboards fall back to that
-- when a job has no completion activity row. The dashboards' PREFERRED signal
-- is a job_activity row (type 'status', title 'Job completed', filtered on
-- created_at >= today) — the same row native completion writes in
-- src/services/jobs.ts. This makes the importer write that row too, but dated
-- to the REAL Service Fusion completion time (the SF job's updated_at, carried
-- on the jobs batch as completed_at), not now(). So "Completed today" counts
-- only jobs actually completed today.
--
-- The INSERT lives inside the 'jobs' branch so it is transactional with the job
-- upsert. It mirrors the native event's columns exactly (org_id, job_id,
-- actor_id, type, title) and leaves actor_id NULL, as an import has no actor.
-- It never fabricates a date: a completed job with no usable updated_at has
-- completed_at NULL and emits nothing.
--
-- Idempotency: the history fix is a RE-IMPORT (re-upserts every job), so the
-- INSERT is guarded by NOT EXISTS against any existing 'Job completed' status
-- row for the job. Re-running creates no duplicate, and a job already completed
-- natively keeps its real event untouched. No schema change is needed.
--
-- updated_at = now() on the jobs upsert is intentionally left unchanged, and
-- the dashboards' read path is not touched.
--
-- DOWN
--   Restore public.sf_import_apply_batch from 20261101193000_sf_import_followups.sql.

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
BEGIN
  company_id := (payload->>'org_id')::uuid;
  table_name := payload->>'table';
  IF company_id IS NULL OR table_name IS NULL THEN
    RAISE EXCEPTION 'import batch needs a company and a table';
  END IF;
  -- App roles live on profiles, not in the token. The service role and a
  -- direct database login have no signed-in user. A signed-in person may
  -- run this only when their profile role is owner, in their own company.
  IF auth.uid() IS NOT NULL AND (
    public.current_app_role() IS DISTINCT FROM 'owner'
    OR public.current_org_id() IS DISTINCT FROM company_id
  ) THEN
    RAISE EXCEPTION 'import denied' USING ERRCODE = '42501';
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
      name = CASE WHEN btrim(EXCLUDED.name) = '' THEN customers.name ELSE EXCLUDED.name END,
      primary_contact = CASE WHEN btrim(EXCLUDED.primary_contact) = '' THEN customers.primary_contact ELSE EXCLUDED.primary_contact END,
      email = CASE WHEN btrim(EXCLUDED.email) = '' THEN customers.email ELSE EXCLUDED.email END,
      phone = CASE WHEN btrim(EXCLUDED.phone) = '' THEN customers.phone ELSE EXCLUDED.phone END,
      phone2 = CASE WHEN btrim(EXCLUDED.phone2) = '' THEN customers.phone2 ELSE EXCLUDED.phone2 END,
      street = CASE WHEN btrim(EXCLUDED.street) = '' THEN customers.street ELSE EXCLUDED.street END,
      city = CASE WHEN btrim(EXCLUDED.city) = '' THEN customers.city ELSE EXCLUDED.city END,
      state = CASE WHEN btrim(EXCLUDED.state) = '' THEN customers.state ELSE EXCLUDED.state END,
      zip = CASE WHEN btrim(EXCLUDED.zip) = '' THEN customers.zip ELSE EXCLUDED.zip END,
      status = CASE WHEN btrim(EXCLUDED.status) = '' THEN customers.status ELSE EXCLUDED.status END,
      notes = CASE WHEN btrim(EXCLUDED.notes) = '' THEN customers.notes ELSE EXCLUDED.notes END,
      last_activity = COALESCE(
        GREATEST(customers.last_activity, EXCLUDED.last_activity),
        customers.last_activity,
        EXCLUDED.last_activity
      ),
      updated_at = now();
  ELSIF table_name = 'customer_links' THEN
    UPDATE public.customers AS existing
    SET sf_id = r.sf_id,
        updated_at = now()
    FROM jsonb_to_recordset(payload->'rows') AS r(loop_customer_id uuid, sf_id bigint)
    WHERE existing.id = r.loop_customer_id
      AND existing.org_id = company_id
      AND (existing.sf_id IS NULL OR existing.sf_id = r.sf_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.customers AS other
        WHERE other.org_id = company_id
          AND other.sf_id = r.sf_id
          AND other.id <> existing.id
      );
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
      arrival_window_start_at, arrival_window_end_at, created_at
    )
    SELECT
      company_id, r.sf_id, r.job_number, r.title, coalesce(r.summary, ''), coalesce(r.notes, ''),
      r.type, r.status, coalesce(r.sf_status, ''), r.priority, customer.id,
      coalesce(r.customer_name, ''), property.id, coalesce(r.property_name, ''),
      coalesce(r.location, ''), coalesce(r.assigned_to, ''), r.assigned_user_id,
      coalesce(r.sf_tech_names, ''), r.scheduled_for, r.scheduled_start_at, r.scheduled_end_at,
      r.arrival_window_start_at, r.arrival_window_end_at, coalesce(r.created_at, now())
    FROM jsonb_to_recordset(payload->'rows') AS r(
      sf_id bigint, customer_sf_id bigint, property_sf_key text, job_number text, title text,
      summary text, notes text, type text, status text, sf_status text, priority text,
      customer_name text, property_name text, location text, assigned_to text,
      assigned_user_id uuid, sf_tech_names text, scheduled_for date, scheduled_start_at timestamptz,
      scheduled_end_at timestamptz, arrival_window_start_at timestamptz,
      arrival_window_end_at timestamptz, created_at timestamptz
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
      updated_at = now();
    -- Capture the jobs upsert count before the activity INSERT runs, so the
    -- returned 'upserted' still reports the jobs that were upserted.
    GET DIAGNOSTICS row_count = ROW_COUNT;
    upserted := row_count;

    -- Backdated completion event for imported completed jobs. Mirrors the native
    -- completion event (src/services/jobs.ts: type 'status', title 'Job completed',
    -- actor_id NULL for an import) but dated to the real Service Fusion completion
    -- time instead of now(). Only for Completed jobs that carry a real updated_at
    -- (completed_at) — never fabricated. Guarded by NOT EXISTS so a re-import, and
    -- a job already completed natively, never gain a duplicate completion row.
    INSERT INTO public.job_activity (org_id, job_id, actor_id, type, title, description, created_at)
    SELECT
      company_id, job.id, NULL, 'status', 'Job completed',
      'Completed in Service Fusion.', r.completed_at
    FROM jsonb_to_recordset(payload->'rows') AS r(
      sf_id bigint, status text, completed_at timestamptz
    )
    JOIN public.jobs job
      ON job.org_id = company_id AND job.sf_id = r.sf_id
    WHERE r.status = 'Completed'
      AND r.completed_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_activity existing
        WHERE existing.job_id = job.id
          AND existing.type = 'status'
          AND existing.title = 'Job completed'
      );

    RETURN jsonb_build_object('upserted', upserted);
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
        last_visit = COALESCE(
          GREATEST(
            property.last_visit,
            (
              SELECT max(job.scheduled_for)
              FROM public.jobs job
              WHERE job.property_id = property.id
                AND job.org_id = property.org_id
            )
          ),
          property.last_visit,
          (
            SELECT max(job.scheduled_for)
            FROM public.jobs job
            WHERE job.property_id = property.id
              AND job.org_id = property.org_id
          )
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
