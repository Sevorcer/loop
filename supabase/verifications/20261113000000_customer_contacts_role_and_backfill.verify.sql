-- Read-only checks for the customer_contacts role + backfill migration.
-- Run after 20261113000000_customer_contacts_role_and_backfill.sql.
-- Changes nothing.

DO $$
DECLARE
  col_default text;
BEGIN
  -- 1. role column exists on customer_contacts
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_contacts'
      AND column_name = 'role'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ), 'customer_contacts must have a NOT NULL text column "role"';

  -- 2. role column default is 'other'
  SELECT column_default INTO col_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'customer_contacts'
    AND column_name = 'role';

  ASSERT col_default IS NOT NULL AND col_default LIKE '%other%',
    'role column default must be ''other''';

  -- 3. CHECK constraint on role values
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name = 'customer_contacts_role_check'
  ), 'CHECK constraint customer_contacts_role_check must exist';

  -- 4. Tech read policy exists
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_contacts'
      AND policyname = 'customer_contacts: read for tech'
      AND cmd = 'SELECT'
  ), 'SELECT policy "customer_contacts: read for tech" must exist';

  -- 5. Original operational roles read policy still exists
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_contacts'
      AND policyname = 'customer_contacts: read for internal operational roles'
      AND cmd = 'SELECT'
  ), 'SELECT policy for internal operational roles must still exist';

  -- 6. Write policies unchanged
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_contacts'
      AND policyname = 'customer_contacts: insert for owner/manager/office/sales'
      AND cmd = 'INSERT'
  ), 'INSERT policy for owner/manager/office/sales must still exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_contacts'
      AND policyname = 'customer_contacts: update for owner/manager/office/sales'
      AND cmd = 'UPDATE'
  ), 'UPDATE policy for owner/manager/office/sales must still exist';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_contacts'
      AND policyname = 'customer_contacts: delete for owner only'
      AND cmd = 'DELETE'
  ), 'DELETE policy for owner only must still exist';

  -- 7. Backfill correctness: no customer with contact info is left without a
  --    row in customer_contacts.
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE (
      COALESCE(TRIM(c.primary_contact), '') <> ''
      OR COALESCE(TRIM(c.phone), '') <> ''
      OR COALESCE(TRIM(c.email), '') <> ''
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_contacts cc
      WHERE cc.customer_id = c.id
    )
  ), 'every customer with contact info must have at least one customer_contacts row';

  -- 8. RLS still enabled and forced
  ASSERT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'customer_contacts'
      AND relnamespace = 'public'::regnamespace
      AND relrowsecurity = true
      AND relforcerowsecurity = true
  ), 'RLS must be enabled and forced on customer_contacts';
END $$;
