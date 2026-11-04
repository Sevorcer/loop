-- =============================================================================
-- Migration — Add role column to customer_contacts and backfill from customers
-- Money Layer Task 1 / Multiple contacts per customer
--
-- The customer_contacts table already exists (20261101180000_sf_import_prep.sql).
-- This migration adds a role column with a fixed set of values
-- (super / pm / other), backfills existing single-contact customers into the
-- contacts table, and adds a tech read policy so technicians can view contacts.
--
-- UP:
--   - ADD role column to customer_contacts (text NOT NULL DEFAULT 'other')
--   - CHECK constraint: role IN ('super', 'pm', 'other')
--   - Backfill: customers with primary_contact/phone/email but no contacts row
--   - Add tech read policy on customer_contacts
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP POLICY IF EXISTS "customer_contacts: read for tech" ON public.customer_contacts;
--   ALTER TABLE public.customer_contacts DROP CONSTRAINT IF EXISTS customer_contacts_role_check;
--   ALTER TABLE public.customer_contacts DROP COLUMN IF EXISTS role;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add role column
-- ---------------------------------------------------------------------------

ALTER TABLE public.customer_contacts
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'other';

ALTER TABLE public.customer_contacts
  DROP CONSTRAINT IF EXISTS customer_contacts_role_check;

ALTER TABLE public.customer_contacts
  ADD CONSTRAINT customer_contacts_role_check
  CHECK (role IN ('super', 'pm', 'other'));

-- ---------------------------------------------------------------------------
-- 2. Backfill: migrate existing single-contact data from customers table
-- For each customer that has primary_contact, phone, or email set but NO
-- existing row in customer_contacts, insert one contact row.
-- ---------------------------------------------------------------------------

INSERT INTO public.customer_contacts (org_id, customer_id, name, phone, email, is_primary, role)
SELECT
  c.org_id,
  c.id,
  COALESCE(NULLIF(TRIM(c.primary_contact), ''), ''),
  COALESCE(NULLIF(TRIM(c.phone), ''), ''),
  COALESCE(NULLIF(TRIM(c.email), ''), ''),
  true,
  'other'
FROM public.customers c
WHERE (
  COALESCE(TRIM(c.primary_contact), '') <> ''
  OR COALESCE(TRIM(c.phone), '') <> ''
  OR COALESCE(TRIM(c.email), '') <> ''
)
AND NOT EXISTS (
  SELECT 1 FROM public.customer_contacts cc
  WHERE cc.customer_id = c.id
);

-- ---------------------------------------------------------------------------
-- 3. RLS — add tech read policy
-- Techs should be able to read contacts (read-only per brief).
-- The existing read policy covers owner/manager/dispatch/office/sales.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "customer_contacts: read for tech" ON public.customer_contacts;
CREATE POLICY "customer_contacts: read for tech"
  ON public.customer_contacts FOR SELECT
  USING (
    current_app_role() = 'tech'
    AND org_id = current_org_id()
  );

-- =============================================================================
-- POST-MIGRATION CHECKLIST
--
--   1. Companion verification file created:
--      supabase/verifications/20261113000000_customer_contacts_role_and_backfill.verify.sql
--
--   2. Assertions cover:
--      - role column exists with correct type and default
--      - CHECK constraint present
--      - Tech read policy exists
--      - Backfill correctness (no customer left behind)
--
--   3. DOWN rollback notes present above.
--
--   4. Run: bash scripts/update-migration-checksums.sh
-- =============================================================================
