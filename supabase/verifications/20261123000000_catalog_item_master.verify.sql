-- Verify: 20261123000000_catalog_item_master
-- Read-only assertions; run after the migration is applied.

-- Tables + RLS (ENABLE and FORCE)
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_categories'), 'catalog_categories must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'catalog_categories' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on catalog_categories';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_items'), 'catalog_items must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'catalog_items' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on catalog_items';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_price_tiers'), 'catalog_price_tiers must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'catalog_price_tiers' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on catalog_price_tiers';
END; $$;

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_item_costs'), 'catalog_item_costs must exist';
  ASSERT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'catalog_item_costs' AND c.relrowsecurity AND c.relforcerowsecurity
  ), 'RLS must be ENABLED and FORCED on catalog_item_costs';
END; $$;

-- Key columns
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items' AND column_name = 'name' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'catalog_items.name must be text (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items' AND column_name = 'item_kind' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'catalog_items.item_kind must be text (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items' AND column_name = 'is_sellable' AND data_type = 'boolean' AND is_nullable = 'NO'
  ), 'catalog_items.is_sellable must be boolean (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items' AND column_name = 'is_stockable' AND data_type = 'boolean' AND is_nullable = 'NO'
  ), 'catalog_items.is_stockable must be boolean (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items' AND column_name = 'sell_price_cents' AND data_type = 'bigint' AND is_nullable = 'YES'
  ), 'catalog_items.sell_price_cents must be bigint (nullable=YES)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items' AND column_name = 'member_price_cents' AND data_type = 'bigint' AND is_nullable = 'YES'
  ), 'catalog_items.member_price_cents must be bigint (nullable=YES)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items' AND column_name = 'sku' AND data_type = 'text' AND is_nullable = 'YES'
  ), 'catalog_items.sku must be text (nullable=YES)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items' AND column_name = 'unit' AND data_type = 'text' AND is_nullable = 'YES'
  ), 'catalog_items.unit must be text (nullable=YES)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items' AND column_name = 'tracking_mode' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'catalog_items.tracking_mode must be text (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_items' AND column_name = 'is_active' AND data_type = 'boolean' AND is_nullable = 'NO'
  ), 'catalog_items.is_active must be boolean (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_item_costs' AND column_name = 'unit_cost_cents' AND data_type = 'bigint' AND is_nullable = 'NO'
  ), 'catalog_item_costs.unit_cost_cents must be bigint (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_item_costs' AND column_name = 'item_id' AND data_type = 'uuid' AND is_nullable = 'NO'
  ), 'catalog_item_costs.item_id must be uuid (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_price_tiers' AND column_name = 'price_cents' AND data_type = 'bigint' AND is_nullable = 'NO'
  ), 'catalog_price_tiers.price_cents must be bigint (nullable=NO)';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalog_categories' AND column_name = 'parent_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ), 'catalog_categories.parent_id must be uuid (nullable=YES)';
END; $$;

-- Policies
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_categories' AND policyname = 'catalog_categories: read for staff'),
    'catalog_categories: policy "catalog_categories: read for staff" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_categories' AND policyname = 'catalog_categories: insert for office+'),
    'catalog_categories: policy "catalog_categories: insert for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_categories' AND policyname = 'catalog_categories: update for office+'),
    'catalog_categories: policy "catalog_categories: update for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_categories' AND policyname = 'catalog_categories: delete for owner'),
    'catalog_categories: policy "catalog_categories: delete for owner" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_items' AND policyname = 'catalog_items: read for staff'),
    'catalog_items: policy "catalog_items: read for staff" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_items' AND policyname = 'catalog_items: insert for office+'),
    'catalog_items: policy "catalog_items: insert for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_items' AND policyname = 'catalog_items: update for office+'),
    'catalog_items: policy "catalog_items: update for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_items' AND policyname = 'catalog_items: delete for owner'),
    'catalog_items: policy "catalog_items: delete for owner" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_price_tiers' AND policyname = 'catalog_price_tiers: read for staff'),
    'catalog_price_tiers: policy "catalog_price_tiers: read for staff" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_price_tiers' AND policyname = 'catalog_price_tiers: insert for office+'),
    'catalog_price_tiers: policy "catalog_price_tiers: insert for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_price_tiers' AND policyname = 'catalog_price_tiers: update for office+'),
    'catalog_price_tiers: policy "catalog_price_tiers: update for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_price_tiers' AND policyname = 'catalog_price_tiers: delete for owner'),
    'catalog_price_tiers: policy "catalog_price_tiers: delete for owner" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_item_costs' AND policyname = 'catalog_item_costs: read for office+'),
    'catalog_item_costs: policy "catalog_item_costs: read for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_item_costs' AND policyname = 'catalog_item_costs: insert for office+'),
    'catalog_item_costs: policy "catalog_item_costs: insert for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_item_costs' AND policyname = 'catalog_item_costs: update for office+'),
    'catalog_item_costs: policy "catalog_item_costs: update for office+" must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'catalog_item_costs' AND policyname = 'catalog_item_costs: delete for owner'),
    'catalog_item_costs: policy "catalog_item_costs: delete for owner" must exist';
END; $$;

-- Cost secrecy: the cost table's read policy must not mention tech, dispatch or sales.
DO $$ BEGIN
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'catalog_item_costs'
      AND (qual ~ '(tech|dispatch|sales|portal)' OR with_check ~ '(tech|dispatch|sales|portal)')
  ), 'catalog_item_costs policies must not grant tech, dispatch, sales or portal';
END; $$;

-- No policy anywhere grants portal
DO $$ BEGIN
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('catalog_categories','catalog_items','catalog_price_tiers','catalog_item_costs')
      AND (qual ~ 'portal' OR with_check ~ 'portal')
  ), 'portal must not appear in any catalog policy';
END; $$;

-- No WITH CHECK (true)
DO $$ BEGIN
  ASSERT NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('catalog_categories','catalog_items','catalog_price_tiers','catalog_item_costs')
      AND with_check = 'true'
  ), 'no catalog policy may use WITH CHECK (true)';
END; $$;

-- Check constraints on the item master
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM pg_constraint
          WHERE conrelid = 'public.catalog_items'::regclass AND contype = 'c'
            AND conname IN ('catalog_items_has_a_facet','catalog_items_sellable_has_price',
                            'catalog_items_service_not_stockable','catalog_items_stockable_has_unit',
                            'catalog_items_serialized_is_stockable')) = 5,
    'catalog_items facet/price/stockable CHECK constraints must all exist';
END; $$;

-- Indexes
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'catalog_items' AND indexname = 'catalog_items_org_sku_uidx'),
    'index catalog_items_org_sku_uidx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'catalog_items' AND indexname = 'catalog_items_org_category_idx'),
    'index catalog_items_org_category_idx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'catalog_items' AND indexname = 'catalog_items_org_active_idx'),
    'index catalog_items_org_active_idx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'catalog_items' AND indexname = 'catalog_items_org_name_prefix_idx'),
    'index catalog_items_org_name_prefix_idx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'catalog_categories' AND indexname = 'catalog_categories_sibling_name_uidx'),
    'index catalog_categories_sibling_name_uidx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'catalog_categories' AND indexname = 'catalog_categories_org_parent_idx'),
    'index catalog_categories_org_parent_idx must exist';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'catalog_price_tiers' AND indexname = 'catalog_price_tiers_item_label_uidx'),
    'index catalog_price_tiers_item_label_uidx must exist';
END; $$;

-- updated_at triggers
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.catalog_items'::regclass AND t.tgname = 'trg_catalog_items_updated_at' AND NOT t.tgisinternal
  ), 'trigger trg_catalog_items_updated_at must exist on catalog_items';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.catalog_categories'::regclass AND t.tgname = 'trg_catalog_categories_updated_at' AND NOT t.tgisinternal
  ), 'trigger trg_catalog_categories_updated_at must exist on catalog_categories';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.catalog_price_tiers'::regclass AND t.tgname = 'trg_catalog_price_tiers_updated_at' AND NOT t.tgisinternal
  ), 'trigger trg_catalog_price_tiers_updated_at must exist on catalog_price_tiers';
END; $$;
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.catalog_item_costs'::regclass AND t.tgname = 'trg_catalog_item_costs_updated_at' AND NOT t.tgisinternal
  ), 'trigger trg_catalog_item_costs_updated_at must exist on catalog_item_costs';
END; $$;
