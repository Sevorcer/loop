-- =============================================================================
-- Migration — Catalog item master (Inventory Lane 1, part 1 of 2)
-- Plan: docs/briefs/inventory-lane1-plan-2026-11-05.md (approved by Collin 2026-11-05)
--
-- ONE item master for everything LOOP sells and/or stocks. Two facets on one
-- row: sellable (price, member price, rate tiers) and stockable (SKU, unit,
-- tracking mode). Cost lives in a separate table so tech/dispatch/sales/portal
-- can never read it (RLS, not UI). There is no separate service_items table.
--
-- UP:
--   - catalog_categories   hierarchical categories
--   - catalog_items        the item master (sellable / stockable / both)
--   - catalog_price_tiers  flat-rate tiers for sellable items (sell prices only)
--   - catalog_item_costs   1:1 cost + preferred vendor (office-and-up only)
--   - RLS (ENABLE + FORCE) on all four, updated_at triggers, indexes
--
-- Same-org integrity: catalog_items has UNIQUE (id, org_id); child tables use a
-- composite FK (item_id, org_id) so a row can never point at another org's item.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP TABLE IF EXISTS public.catalog_item_costs;
--   DROP TABLE IF EXISTS public.catalog_price_tiers;
--   DROP TABLE IF EXISTS public.catalog_items;
--   DROP TABLE IF EXISTS public.catalog_categories;
--   (Only safe before M2 20261123100000 is applied: the ledger FKs to catalog_items.)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- catalog_categories
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.catalog_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id   uuid,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_categories_id_org_key UNIQUE (id, org_id),
  CONSTRAINT catalog_categories_parent_same_org_fkey
    FOREIGN KEY (parent_id, org_id) REFERENCES public.catalog_categories (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT catalog_categories_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

-- Sibling names are unique case-insensitively (root siblings share a NULL parent).
CREATE UNIQUE INDEX IF NOT EXISTS catalog_categories_sibling_name_uidx
  ON public.catalog_categories (org_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

CREATE INDEX IF NOT EXISTS catalog_categories_org_parent_idx
  ON public.catalog_categories (org_id, parent_id);

-- ---------------------------------------------------------------------------
-- catalog_items — THE item master
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.catalog_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id         uuid,
  name                text NOT NULL CHECK (length(btrim(name)) > 0),
  description         text,
  item_kind           text NOT NULL
                        CHECK (item_kind IN ('product', 'service', 'labor', 'equipment', 'refrigerant', 'consumable')),

  -- Sellable facet
  is_sellable         boolean NOT NULL DEFAULT false,
  sell_price_cents    bigint CHECK (sell_price_cents IS NULL OR sell_price_cents >= 0),
  member_price_cents  bigint CHECK (member_price_cents IS NULL OR member_price_cents >= 0),
  is_taxable          boolean NOT NULL DEFAULT true,

  -- Stockable facet
  is_stockable        boolean NOT NULL DEFAULT false,
  sku                 text CHECK (sku IS NULL OR length(btrim(sku)) > 0),
  unit                text CHECK (unit IS NULL OR length(btrim(unit)) > 0),
  tracking_mode       text NOT NULL DEFAULT 'quantity'
                        CHECK (tracking_mode IN ('quantity', 'serialized')),
  brand               text,
  model               text,
  mfr_part_number     text,
  size_attrs          jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_active           boolean NOT NULL DEFAULT true,
  sf_id               text,  -- reserved for the Service Fusion crosswalk (#36); unused in Lane 1
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT catalog_items_id_org_key UNIQUE (id, org_id),
  CONSTRAINT catalog_items_category_same_org_fkey
    FOREIGN KEY (category_id, org_id) REFERENCES public.catalog_categories (id, org_id) ON DELETE SET NULL (category_id),
  CONSTRAINT catalog_items_has_a_facet CHECK (is_sellable OR is_stockable),
  CONSTRAINT catalog_items_sellable_has_price CHECK (NOT is_sellable OR sell_price_cents IS NOT NULL),
  CONSTRAINT catalog_items_service_not_stockable CHECK (item_kind NOT IN ('service', 'labor') OR NOT is_stockable),
  CONSTRAINT catalog_items_stockable_has_unit CHECK (NOT is_stockable OR unit IS NOT NULL),
  CONSTRAINT catalog_items_serialized_is_stockable CHECK (tracking_mode = 'quantity' OR is_stockable)
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_org_sku_uidx
  ON public.catalog_items (org_id, sku) WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS catalog_items_org_category_idx
  ON public.catalog_items (org_id, category_id);

CREATE INDEX IF NOT EXISTS catalog_items_org_active_idx
  ON public.catalog_items (org_id, is_active);

-- Type-ahead picker: prefix match on lower(name).
CREATE INDEX IF NOT EXISTS catalog_items_org_name_prefix_idx
  ON public.catalog_items (org_id, lower(name) text_pattern_ops);

-- ---------------------------------------------------------------------------
-- catalog_price_tiers — flat-rate tiers (sell prices only; same visibility as items)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.catalog_price_tiers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id             uuid NOT NULL,
  label               text NOT NULL CHECK (length(btrim(label)) > 0),
  price_cents         bigint NOT NULL CHECK (price_cents >= 0),
  member_price_cents  bigint CHECK (member_price_cents IS NULL OR member_price_cents >= 0),
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_price_tiers_item_same_org_fkey
    FOREIGN KEY (item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_price_tiers_item_label_uidx
  ON public.catalog_price_tiers (item_id, lower(label));

-- ---------------------------------------------------------------------------
-- catalog_item_costs — 1:1, separate table so cost is unreadable to tech/portal
-- Costing METHOD (average / last price) is deferred to Lane 5; this only stores.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.catalog_item_costs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id          uuid NOT NULL,
  unit_cost_cents  bigint NOT NULL CHECK (unit_cost_cents >= 0),
  preferred_vendor text,
  cost_updated_at  timestamptz NOT NULL DEFAULT now(),
  cost_updated_by  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_item_costs_item_key UNIQUE (item_id),
  CONSTRAINT catalog_item_costs_item_same_org_fkey
    FOREIGN KEY (item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- RLS — ENABLE + FORCE on every table; portal has no policy anywhere.
-- ---------------------------------------------------------------------------

ALTER TABLE public.catalog_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_categories  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_price_tiers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_costs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_costs  FORCE ROW LEVEL SECURITY;

-- catalog_categories ---------------------------------------------------------
DROP POLICY IF EXISTS "catalog_categories: read for staff" ON public.catalog_categories;
CREATE POLICY "catalog_categories: read for staff"
  ON public.catalog_categories FOR SELECT TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_categories: insert for office+" ON public.catalog_categories;
CREATE POLICY "catalog_categories: insert for office+"
  ON public.catalog_categories FOR INSERT TO authenticated
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_categories: update for office+" ON public.catalog_categories;
CREATE POLICY "catalog_categories: update for office+"
  ON public.catalog_categories FOR UPDATE TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_categories: delete for owner" ON public.catalog_categories;
CREATE POLICY "catalog_categories: delete for owner"
  ON public.catalog_categories FOR DELETE TO authenticated
  USING (current_app_role() = 'owner' AND org_id = current_org_id());

-- catalog_items --------------------------------------------------------------
DROP POLICY IF EXISTS "catalog_items: read for staff" ON public.catalog_items;
CREATE POLICY "catalog_items: read for staff"
  ON public.catalog_items FOR SELECT TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_items: insert for office+" ON public.catalog_items;
CREATE POLICY "catalog_items: insert for office+"
  ON public.catalog_items FOR INSERT TO authenticated
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_items: update for office+" ON public.catalog_items;
CREATE POLICY "catalog_items: update for office+"
  ON public.catalog_items FOR UPDATE TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_items: delete for owner" ON public.catalog_items;
CREATE POLICY "catalog_items: delete for owner"
  ON public.catalog_items FOR DELETE TO authenticated
  USING (current_app_role() = 'owner' AND org_id = current_org_id());

-- catalog_price_tiers --------------------------------------------------------
DROP POLICY IF EXISTS "catalog_price_tiers: read for staff" ON public.catalog_price_tiers;
CREATE POLICY "catalog_price_tiers: read for staff"
  ON public.catalog_price_tiers FOR SELECT TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_price_tiers: insert for office+" ON public.catalog_price_tiers;
CREATE POLICY "catalog_price_tiers: insert for office+"
  ON public.catalog_price_tiers FOR INSERT TO authenticated
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_price_tiers: update for office+" ON public.catalog_price_tiers;
CREATE POLICY "catalog_price_tiers: update for office+"
  ON public.catalog_price_tiers FOR UPDATE TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_price_tiers: delete for owner" ON public.catalog_price_tiers;
CREATE POLICY "catalog_price_tiers: delete for owner"
  ON public.catalog_price_tiers FOR DELETE TO authenticated
  USING (current_app_role() = 'owner' AND org_id = current_org_id());

-- catalog_item_costs: NO policy for dispatch / tech / sales / portal ----------
DROP POLICY IF EXISTS "catalog_item_costs: read for office+" ON public.catalog_item_costs;
CREATE POLICY "catalog_item_costs: read for office+"
  ON public.catalog_item_costs FOR SELECT TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_item_costs: insert for office+" ON public.catalog_item_costs;
CREATE POLICY "catalog_item_costs: insert for office+"
  ON public.catalog_item_costs FOR INSERT TO authenticated
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_item_costs: update for office+" ON public.catalog_item_costs;
CREATE POLICY "catalog_item_costs: update for office+"
  ON public.catalog_item_costs FOR UPDATE TO authenticated
  USING (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  )
  WITH CHECK (
    current_app_role() IN ('owner', 'manager', 'office')
    AND org_id = current_org_id()
  );

DROP POLICY IF EXISTS "catalog_item_costs: delete for owner" ON public.catalog_item_costs;
CREATE POLICY "catalog_item_costs: delete for owner"
  ON public.catalog_item_costs FOR DELETE TO authenticated
  USING (current_app_role() = 'owner' AND org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- updated_at triggers (shared helper already present)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_catalog_categories_updated_at ON public.catalog_categories;
CREATE TRIGGER trg_catalog_categories_updated_at
  BEFORE UPDATE ON public.catalog_categories
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_catalog_items_updated_at ON public.catalog_items;
CREATE TRIGGER trg_catalog_items_updated_at
  BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_catalog_price_tiers_updated_at ON public.catalog_price_tiers;
CREATE TRIGGER trg_catalog_price_tiers_updated_at
  BEFORE UPDATE ON public.catalog_price_tiers
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_catalog_item_costs_updated_at ON public.catalog_item_costs;
CREATE TRIGGER trg_catalog_item_costs_updated_at
  BEFORE UPDATE ON public.catalog_item_costs
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
