-- Verify: 20261126100000_material_plans
-- Read-only assertions; run after the migration is applied.

-- Tables + RLS (ENABLE and FORCE)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_material_plans', 'job_kits', 'job_material_line_events', 'catalog_item_aliases'] LOOP
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t),
      t || ' must exist';
    ASSERT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relrowsecurity AND c.relforcerowsecurity
    ), 'RLS must be ENABLED and FORCED on ' || t;
    ASSERT NOT has_table_privilege('anon', 'public.' || t, 'SELECT'), 'anon must have no access to ' || t;
    ASSERT NOT has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE'), 'authenticated must not TRUNCATE ' || t;
    -- No policy may be permissive without an org check.
    ASSERT NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND (coalesce(qual, '') = 'true' OR coalesce(with_check, '') = 'true')
    ), t || ' must have no unconditional policy';
  END LOOP;
END; $$;

-- Append-only history
DO $$ BEGIN
  ASSERT NOT has_table_privilege('authenticated', 'public.job_material_line_events', 'UPDATE'),
    'job_material_line_events must not be updatable';
  ASSERT NOT has_table_privilege('authenticated', 'public.job_material_line_events', 'DELETE'),
    'job_material_line_events must not be deletable';
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_material_line_events' AND cmd IN ('UPDATE', 'DELETE', 'ALL')
  ), 'job_material_line_events must have no UPDATE/DELETE policy';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.job_material_line_events'::regclass
      AND tgname = 'trg_job_material_events_guard' AND NOT tgisinternal
  ), 'history guard trigger must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.job_material_line_events'::regclass
      AND tgname = 'trg_job_material_events_stamp' AND NOT tgisinternal
  ), 'history actor stamp trigger must exist';
END; $$;

-- Plans: one per job, no delete path
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.job_material_plans'::regclass
      AND conname = 'job_material_plans_job_key' AND contype = 'u'
  ), 'one plan per job must be enforced';
  ASSERT NOT has_table_privilege('authenticated', 'public.job_material_plans', 'DELETE'),
    'plans must not be deletable by authenticated';
END; $$;

-- job_material_lines additive columns
DO $$
DECLARE
  c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['plan_id', 'catalog_item_id', 'source', 'job_line_item_id', 'estimate_line_item_id',
                           'kit_id', 'kit_version', 'kit_quantity', 'is_optional', 'non_stock_reason'] LOOP
    ASSERT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'job_material_lines' AND column_name = c
    ), 'job_material_lines.' || c || ' must exist';
  END LOOP;
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_material_lines' AND column_name = 'source'
      AND is_nullable = 'NO' AND column_default LIKE '%manual%'
  ), 'job_material_lines.source must be NOT NULL defaulting to manual';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_material_lines' AND column_name = 'catalog_item_id'
      AND is_nullable = 'YES'
  ), 'catalog_item_id must be nullable (NULL = needs SKU)';
END; $$;

-- Same-org composite FKs
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['job_material_lines_plan_same_org_fkey', 'job_material_lines_item_same_org_fkey',
                           'job_material_lines_kit_same_org_fkey', 'job_kits_kit_same_org_fkey',
                           'catalog_item_aliases_item_same_org_fkey'] LOOP
    ASSERT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = f AND contype = 'f' AND array_length(conkey, 1) = 2),
      f || ' must be a two-column (id, org_id) foreign key';
  END LOOP;
END; $$;

-- D7 / idempotency indexes
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'job_material_lines_job_item_uidx'),
    'one line per catalog item per job must be enforced';
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'job_material_lines_job_line_item_uidx'),
    'plan generation must be idempotent per job line item';
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'job_material_lines_job_estimate_item_uidx'),
    'plan generation must be idempotent per estimate line item';
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'job_material_lines_needs_sku_idx'),
    'needs-SKU partial index must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.catalog_item_aliases'::regclass
      AND conname = 'catalog_item_aliases_org_alias_key' AND contype = 'u'
  ), 'aliases must be unique per org';
END; $$;

-- Tech guard covers the new columns
DO $$ BEGIN
  ASSERT pg_get_functiondef('public.guard_tech_job_material_update'::regproc) LIKE '%catalog_item_id%'
    AND pg_get_functiondef('public.guard_tech_job_material_update'::regproc) LIKE '%non_stock_reason%'
    AND pg_get_functiondef('public.guard_tech_job_material_update'::regproc) LIKE '%plan_id%',
    'tech guard must reject changes to plan columns';
END; $$;

-- History trigger on lines
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.job_material_lines'::regclass
      AND tgname = 'trg_job_material_lines_events' AND NOT tgisinternal
  ), 'line history trigger must exist';
END; $$;

-- RPCs: authenticated only, invoker (RLS applies)
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.generate_material_plan(uuid,text,jsonb,jsonb)',
    'public.refresh_job_kit(uuid,uuid,integer,numeric,jsonb)',
    'public.adjust_material_line(uuid,jsonb,text)',
    'public.link_material_line_sku(uuid,uuid,boolean)',
    'public.remove_material_line(uuid,text)'] LOOP
    ASSERT has_function_privilege('authenticated', f::regprocedure, 'EXECUTE'), f || ' must be executable by authenticated';
    ASSERT NOT has_function_privilege('anon', f::regprocedure, 'EXECUTE'), f || ' must not be executable by anon';
    ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid = f::regprocedure), f || ' must be SECURITY INVOKER';
  END LOOP;
END; $$;

-- Trigger functions are not RPCs
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.fn_job_material_plans_stamp()', 'public.fn_job_kits_stamp()',
    'public.fn_catalog_item_aliases_stamp()', 'public.fn_job_material_events_stamp()',
    'public.fn_job_material_events_guard()', 'public.fn_job_material_lines_events()',
    'public.guard_tech_job_material_update()'] LOOP
    ASSERT NOT has_function_privilege('authenticated', f::regprocedure, 'EXECUTE'), f || ' must not be an RPC';
    ASSERT NOT has_function_privilege('anon', f::regprocedure, 'EXECUTE'), f || ' must not be callable by anon';
  END LOOP;
END; $$;
