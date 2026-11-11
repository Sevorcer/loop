-- Read-only checks for 20261128000000_inventory_serial_units.sql.
-- Run after the migration. This file changes nothing.

DO $$
DECLARE
  n bigint;
BEGIN
  -- Table, RLS and privileges ------------------------------------------------
  ASSERT to_regclass('public.inventory_serial_units') IS NOT NULL,
    'inventory_serial_units must exist';
  ASSERT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class
          WHERE oid = 'public.inventory_serial_units'::regclass),
    'inventory_serial_units must have RLS enabled and forced';
  ASSERT NOT has_table_privilege('anon', 'public.inventory_serial_units', 'SELECT'),
    'anon must have no access to inventory_serial_units';
  ASSERT NOT has_table_privilege('anon', 'public.inventory_serial_review_queue', 'SELECT'),
    'anon must have no access to the review queue';

  -- Policies: ops read, tech read, office+ write, owner delete. No sales, no portal.
  ASSERT (SELECT count(*) FROM pg_policies
          WHERE schemaname = 'public' AND tablename = 'inventory_serial_units') = 5,
    'inventory_serial_units must have exactly 5 policies';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_serial_units'
      AND (qual ILIKE '%sales%' OR with_check ILIKE '%sales%' OR roles::text ILIKE '%anon%')
  ), 'no policy may grant sales or anon access';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_serial_units'
      AND cmd IN ('INSERT', 'UPDATE') AND (with_check ILIKE '%tech%' OR qual ILIKE '%tech%')
  ), 'technicians must not be able to write serial units directly';

  -- One serial truth ---------------------------------------------------------
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'inventory_serial_units'
      AND indexname = 'inventory_serial_units_identity_uidx'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%needs_review%'
  ), 'identity uniqueness (org, manufacturer, serial) must apply to rows not needing review';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_installed_systems_serial_sync'
      AND tgrelid = 'public.installed_systems'::regclass AND NOT tgisinternal
  ), 'the installed_systems -> units bridge trigger must exist';

  -- Ledger link: column + same-org FK + guard; append-only triggers intact -----
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions'
      AND column_name = 'serial_unit_id'
  ), 'inventory_transactions.serial_unit_id must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_transactions_serial_unit_same_org_fkey'
      AND conrelid = 'public.inventory_transactions'::regclass AND contype = 'f'
  ), 'serial_unit_id must be a same-org composite foreign key';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_inventory_txn_serial_guard'
      AND tgrelid = 'public.inventory_transactions'::regclass AND NOT tgisinternal
  ), 'the ledger serial guard trigger must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_inventory_txn_no_update_delete'
      AND tgrelid = 'public.inventory_transactions'::regclass AND NOT tgisinternal
  ), 'the ledger must still be append-only';

  -- Trigger functions are not callable through the API ------------------------
  ASSERT NOT has_function_privilege('authenticated', 'public.fn_installed_system_serials_sync()', 'EXECUTE'),
    'the bridge function must not be executable by authenticated';
  ASSERT NOT has_function_privilege('authenticated', 'public.fn_inventory_txn_serial_guard()', 'EXECUTE'),
    'the ledger serial guard must not be executable by authenticated';

  -- The review queue respects RLS ---------------------------------------------
  ASSERT (SELECT 'security_invoker=true' = ANY (reloptions) FROM pg_class
          WHERE oid = 'public.inventory_serial_review_queue'::regclass),
    'inventory_serial_review_queue must be security_invoker';

  -- Backfill coverage: every system with a usable serial has a unit ------------
  SELECT count(*) INTO n
  FROM public.installed_systems s
  WHERE EXISTS (
          SELECT 1 FROM unnest(s.serial_numbers) AS x(serial)
          WHERE NOT public.fn_serial_is_placeholder(x.serial)
        )
    AND NOT EXISTS (
          SELECT 1 FROM public.inventory_serial_units u WHERE u.installed_system_id = s.id
        );
  ASSERT n = 0, format('%s installed systems with a usable serial have no serial unit', n);

  -- Placeholders were never turned into units ----------------------------------
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.inventory_serial_units
    WHERE source IN ('backfill', 'sync') AND public.fn_serial_is_placeholder(serial_number)
  ), 'placeholder serials must not become serial units';

  -- Flagged duplicates are flagged as a whole group -----------------------------
  ASSERT NOT EXISTS (
    SELECT 1
    FROM public.inventory_serial_units u
    WHERE NOT u.needs_review
      AND EXISTS (
        SELECT 1 FROM public.inventory_serial_units o
        WHERE o.org_id = u.org_id AND o.manufacturer_key = u.manufacturer_key
          AND o.serial_key = u.serial_key AND o.id <> u.id
          AND o.source = 'backfill' AND u.source = 'backfill'
      )
  ), 'backfilled duplicate serials must all be flagged for review';
END $$;
