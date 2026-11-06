-- Verify: 20261126000000_kit_templates_and_settings
-- Read-only assertions; run after the migration is applied.

-- Tables + RLS (ENABLE and FORCE)
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_settings'), 'inventory_settings must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'inventory_settings' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on inventory_settings';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_templates'), 'kit_templates must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'kit_templates' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on kit_templates';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kit_template_lines'), 'kit_template_lines must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'kit_template_lines' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on kit_template_lines';
END; $$;

-- Key columns
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_settings' AND column_name = 'closeout_enforcement'
      AND data_type = 'text' AND is_nullable = 'NO' AND column_default LIKE '%warn%'
  ), 'inventory_settings.closeout_enforcement must be text NOT NULL defaulting to warn';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_settings' AND column_name = 'readiness_lead_days'
      AND data_type = 'integer' AND is_nullable = 'NO' AND column_default LIKE '%3%'
  ), 'inventory_settings.readiness_lead_days must default to 3';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_settings' AND column_name = 'arrival_buffer_days'
      AND data_type = 'integer' AND is_nullable = 'NO' AND column_default LIKE '%1%'
  ), 'inventory_settings.arrival_buffer_days must default to 1';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kit_templates' AND column_name = 'version'
      AND data_type = 'integer' AND is_nullable = 'NO'
  ), 'kit_templates.version must be integer NOT NULL';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kit_templates' AND column_name = 'status'
      AND data_type = 'text' AND is_nullable = 'NO'
  ), 'kit_templates.status must be text NOT NULL';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kit_template_lines' AND column_name = 'catalog_item_id'
      AND data_type = 'uuid' AND is_nullable = 'NO'
  ), 'kit_template_lines.catalog_item_id must be uuid NOT NULL (kits are never free text)';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kit_template_lines' AND column_name = 'quantity'
      AND data_type = 'numeric' AND is_nullable = 'NO'
  ), 'kit_template_lines.quantity must be numeric NOT NULL';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kit_template_lines' AND column_name = 'is_optional'
      AND data_type = 'boolean' AND is_nullable = 'NO'
  ), 'kit_template_lines.is_optional must be boolean NOT NULL';
END; $$;

-- Uniqueness + same-org foreign keys
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'kit_templates' AND indexname = 'kit_templates_org_name_uidx'
  ), 'kit_templates must have a unique (org_id, lower(name)) index';
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.kit_template_lines'::regclass AND conname = 'kit_template_lines_kit_item_key' AND contype = 'u'
  ), 'kit_template_lines must be unique per (kit_id, catalog_item_id)';
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.kit_template_lines'::regclass AND conname = 'kit_template_lines_item_same_org_fkey' AND contype = 'f'
  ), 'kit_template_lines must reference catalog_items with a same-org foreign key';
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.kit_template_lines'::regclass AND conname = 'kit_template_lines_kit_same_org_fkey' AND contype = 'f'
  ), 'kit_template_lines must reference kit_templates with a same-org foreign key';
END; $$;

-- CHECK constraints present
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inventory_settings'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%warn%' AND pg_get_constraintdef(oid) LIKE '%soft%' AND pg_get_constraintdef(oid) LIKE '%hard%'
  ), 'inventory_settings must constrain closeout_enforcement to warn|soft|hard';
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.kit_template_lines'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%quantity%> (0)%'
  ), 'kit_template_lines.quantity must be constrained above zero';
END; $$;

-- Triggers
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.kit_templates'::regclass AND tgname = 'trg_kit_templates_stamp' AND NOT tgisinternal), 'kit_templates stamp trigger must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.kit_template_lines'::regclass AND tgname = 'trg_kit_template_line_guard' AND NOT tgisinternal), 'kit_template_lines guard trigger must exist';
  ASSERT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.inventory_settings'::regclass AND tgname = 'trg_inventory_settings_stamp' AND NOT tgisinternal), 'inventory_settings stamp trigger must exist';
END; $$;

-- Policies (names are the contract; count per table)
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_settings') = 3,
    'inventory_settings must have exactly 3 policies (read, insert, update); there is no DELETE policy';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_settings' AND cmd = 'DELETE'),
    'inventory_settings must have no DELETE policy';
  ASSERT (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kit_templates') = 4,
    'kit_templates must have exactly 4 policies';
  ASSERT (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kit_template_lines') = 4,
    'kit_template_lines must have exactly 4 policies';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('inventory_settings', 'kit_templates', 'kit_template_lines')
      AND (roles <> '{authenticated}' OR with_check = 'true' OR qual = 'true')
  ), 'every policy must be TO authenticated and none may be unconditional';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('inventory_settings', 'kit_templates', 'kit_template_lines')
      AND roles::text LIKE '%anon%'
  ), 'no policy may apply to anon';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('inventory_settings', 'kit_templates', 'kit_template_lines')
      AND (coalesce(qual, '') LIKE '%portal%' OR coalesce(with_check, '') LIKE '%portal%')
  ), 'portal must not appear in any policy';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'inventory_settings' AND cmd = 'UPDATE'
      AND qual LIKE '%owner%' AND qual NOT LIKE '%manager%'
  ), 'inventory_settings UPDATE must be owner-only';
  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'kit_templates' AND cmd = 'DELETE'
      AND qual LIKE '%owner%' AND qual NOT LIKE '%manager%'
  ), 'kit_templates DELETE must be owner-only';
END; $$;

-- save_kit_template: exists, invoker (RLS applies), callable by authenticated only
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'save_kit_template' AND NOT p.prosecdef
  ), 'save_kit_template must exist and be SECURITY INVOKER';
  ASSERT has_function_privilege('authenticated', 'public.save_kit_template(uuid, jsonb, jsonb)', 'EXECUTE'),
    'authenticated must be able to execute save_kit_template';
  ASSERT NOT has_function_privilege('anon', 'public.save_kit_template(uuid, jsonb, jsonb)', 'EXECUTE'),
    'anon must not be able to execute save_kit_template';
END; $$;

-- Privileges beneath RLS
DO $$ BEGIN
  ASSERT NOT has_table_privilege('anon', 'public.inventory_settings', 'SELECT'), 'anon must have no access to inventory_settings';
  ASSERT NOT has_table_privilege('anon', 'public.kit_templates', 'SELECT'), 'anon must have no access to kit_templates';
  ASSERT NOT has_table_privilege('anon', 'public.kit_template_lines', 'SELECT'), 'anon must have no access to kit_template_lines';
  ASSERT NOT has_table_privilege('authenticated', 'public.inventory_settings', 'DELETE'), 'authenticated must not DELETE inventory_settings';
END; $$;

-- Nothing is seeded by this migration
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.kit_templates) = 0, 'kit_templates must start empty (kits are built in-app)';
  ASSERT (SELECT count(*) FROM public.kit_template_lines) = 0, 'kit_template_lines must start empty';
  ASSERT (SELECT count(*) FROM public.inventory_settings) = 0, 'inventory_settings rows are created lazily by the owner, not seeded';
END; $$;
