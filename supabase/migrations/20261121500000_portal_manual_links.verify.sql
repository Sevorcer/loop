-- Verify: 20261121500000_portal_manual_links (read-only)
DO $$
DECLARE
  n integer;
  def text;
BEGIN
  -- column
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'drive_manual_files'
     AND column_name = 'portal_eligible' AND data_type = 'boolean'
     AND is_nullable = 'NO' AND column_default = 'false';
  ASSERT n = 1, 'drive_manual_files.portal_eligible boolean NOT NULL DEFAULT false missing';

  -- view exists, invoker rights + barrier
  SELECT count(*) INTO n FROM pg_class c
   WHERE c.oid = 'public.equipment_manual_links_v'::regclass AND c.relkind = 'v'
     AND c.reloptions @> ARRAY['security_invoker=true']
     AND c.reloptions @> ARRAY['security_barrier=true'];
  ASSERT n = 1, 'equipment_manual_links_v must be a security_invoker + security_barrier view';

  -- filters: decided links only, active + portal-eligible manuals
  def := pg_get_viewdef('public.equipment_manual_links_v'::regclass, true);
  ASSERT def LIKE '%confirmed%' AND def LIKE '%auto_linked%', 'view must filter to confirmed/auto_linked';
  ASSERT def NOT LIKE '%suggested%' AND def NOT LIKE '%rejected%', 'view must not include suggested/rejected';
  ASSERT def LIKE '%portal_eligible%', 'view must filter on portal_eligible';
  ASSERT def LIKE '%''active''%', 'view must filter to active manuals';

  -- no PII columns
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'equipment_manual_links_v'
     AND column_name IN ('customer_name', 'notes', 'property_name', 'attributes', 'serial_numbers');
  ASSERT n = 0, 'equipment_manual_links_v exposes a PII column';

  -- grants: service_role only
  ASSERT NOT has_table_privilege('anon', 'public.equipment_manual_links_v', 'SELECT'),
    'anon can read equipment_manual_links_v';
  ASSERT NOT has_table_privilege('authenticated', 'public.equipment_manual_links_v', 'SELECT'),
    'authenticated can read equipment_manual_links_v';
  ASSERT has_table_privilege('service_role', 'public.equipment_manual_links_v', 'SELECT'),
    'service_role cannot read equipment_manual_links_v';

  RAISE NOTICE 'portal_manual_links verify OK';
END $$;
