-- =============================================================================
-- Migration — Inventory settings + kit templates (Inventory Lane 4, PR A, M1)
-- Plan: docs/briefs/inventory-lane4-plan-2026-11-05.md (approved by Collin 2026-11-05)
--
-- UP (expand-only; nothing existing is touched):
--   - inventory_settings        one row per org: readiness lead/buffer days and the
--                               closeout enforcement stage (warn | soft | hard). The
--                               row is created lazily by the owner; absent = defaults.
--   - kit_templates             named install kits (consumables/accessories pallets)
--   - kit_template_lines        catalog-backed lines (never free text)
--   - save_kit_template()       atomic header + lines save; bumps kit_templates.version
--                               only when the LINE CONTENT changes (D9)
--
-- Nothing is seeded: kits are built in-app from the catalog (plan §7.2).
-- Kits are snapshots once attached to a job (PR B), so editing a kit never changes
-- existing jobs.
--
-- DOWN (manual rollback — create a new forward migration to apply):
--   DROP FUNCTION IF EXISTS public.save_kit_template(uuid, jsonb, jsonb);
--   DROP TABLE IF EXISTS public.kit_template_lines;
--   DROP TABLE IF EXISTS public.kit_templates;
--   DROP TABLE IF EXISTS public.inventory_settings;
--   DROP FUNCTION IF EXISTS public.fn_kit_template_line_guard();
--   DROP FUNCTION IF EXISTS public.fn_kit_templates_stamp();
--   DROP FUNCTION IF EXISTS public.fn_inventory_settings_stamp();
-- =============================================================================

-- ---------------------------------------------------------------------------
-- inventory_settings — one row per org
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_settings (
  org_id                    uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  readiness_lead_days       integer NOT NULL DEFAULT 3 CHECK (readiness_lead_days BETWEEN 0 AND 30),
  arrival_buffer_days       integer NOT NULL DEFAULT 1 CHECK (arrival_buffer_days BETWEEN 0 AND 14),
  closeout_enforcement      text NOT NULL DEFAULT 'warn'
                              CHECK (closeout_enforcement IN ('warn', 'soft', 'hard')),
  enforcement_changed_by    uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  enforcement_changed_at    timestamptz,
  updated_by                uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- kit_templates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kit_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(btrim(name)) > 0),
  description  text,
  category     text,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version      integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kit_templates_id_org_key UNIQUE (id, org_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS kit_templates_org_name_uidx
  ON public.kit_templates (org_id, lower(name));

CREATE INDEX IF NOT EXISTS kit_templates_org_status_idx
  ON public.kit_templates (org_id, status);

-- ---------------------------------------------------------------------------
-- kit_template_lines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kit_template_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kit_id           uuid NOT NULL,
  catalog_item_id  uuid NOT NULL,
  quantity         numeric(12, 3) NOT NULL CHECK (quantity > 0),
  is_optional      boolean NOT NULL DEFAULT false,
  notes            text,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kit_template_lines_kit_same_org_fkey
    FOREIGN KEY (kit_id, org_id) REFERENCES public.kit_templates (id, org_id) ON DELETE CASCADE,
  CONSTRAINT kit_template_lines_item_same_org_fkey
    FOREIGN KEY (catalog_item_id, org_id) REFERENCES public.catalog_items (id, org_id) ON DELETE RESTRICT,
  CONSTRAINT kit_template_lines_kit_item_key UNIQUE (kit_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS kit_template_lines_org_item_idx
  ON public.kit_template_lines (org_id, catalog_item_id);

-- ---------------------------------------------------------------------------
-- Trigger functions (SECURITY INVOKER: callers already hold the privileges they use)
-- ---------------------------------------------------------------------------

-- Stamps authorship and keeps version monotonic (+1 at most per UPDATE).
CREATE OR REPLACE FUNCTION public.fn_kit_templates_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := 1;
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  ELSE
    NEW.org_id := OLD.org_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    IF NEW.version <> OLD.version AND NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION 'kit_templates.version can only increase by one per change'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kit_templates_stamp ON public.kit_templates;
CREATE TRIGGER trg_kit_templates_stamp
  BEFORE INSERT OR UPDATE ON public.kit_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_kit_templates_stamp();

-- A kit line must point at a stockable catalog item (services and labor are not
-- pulled from the shop); new lines also require the item to be active.
CREATE OR REPLACE FUNCTION public.fn_kit_template_line_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_item public.catalog_items%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.catalog_item_id = OLD.catalog_item_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_item FROM public.catalog_items
  WHERE id = NEW.catalog_item_id AND org_id = NEW.org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog item % not found', NEW.catalog_item_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NOT v_item.is_stockable THEN
    RAISE EXCEPTION '"%" is not a stocked item, so it cannot be part of a kit', v_item.name
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT v_item.is_active THEN
    RAISE EXCEPTION '"%" is inactive, so it cannot be added to a kit', v_item.name
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kit_template_line_guard ON public.kit_template_lines;
CREATE TRIGGER trg_kit_template_line_guard
  BEFORE INSERT OR UPDATE ON public.kit_template_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_kit_template_line_guard();

-- inventory_settings: stamp authorship; record who/when moved the enforcement stage.
CREATE OR REPLACE FUNCTION public.fn_inventory_settings_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    IF NEW.closeout_enforcement <> 'warn' THEN
      NEW.enforcement_changed_by := auth.uid();
      NEW.enforcement_changed_at := now();
    END IF;
  ELSIF NEW.closeout_enforcement IS DISTINCT FROM OLD.closeout_enforcement THEN
    NEW.enforcement_changed_by := auth.uid();
    NEW.enforcement_changed_at := now();
  ELSE
    NEW.enforcement_changed_by := OLD.enforcement_changed_by;
    NEW.enforcement_changed_at := OLD.enforcement_changed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_settings_stamp ON public.inventory_settings;
CREATE TRIGGER trg_inventory_settings_stamp
  BEFORE INSERT OR UPDATE ON public.inventory_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_settings_stamp();

-- ---------------------------------------------------------------------------
-- save_kit_template — atomic create/update of a kit and (optionally) its lines.
--
--   p_kit_id   NULL creates a kit; otherwise the kit to update.
--   p_header   jsonb with any of: name, description, category, status. Only keys that
--              are present change (a JSON null clears description/category).
--   p_lines    NULL leaves lines untouched. Otherwise an array of
--              {catalog_item_id, quantity, is_optional, notes} that REPLACES the kit's
--              lines. The array order becomes sort_order.
--
-- version bumps by one iff the line content (item, quantity, optional flag, notes)
-- changed on an existing kit. Header edits and re-ordering never bump it.
-- SECURITY INVOKER: RLS applies, so only owner/manager/office can save.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_kit_template(
  p_kit_id  uuid,
  p_header  jsonb,
  p_lines   jsonb
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org      uuid := current_org_id();
  v_id       uuid := p_kit_id;
  v_header   jsonb := COALESCE(p_header, '{}'::jsonb);
  v_norm     jsonb;
  v_changed  boolean := false;
  v_rows     integer;
  v_dupes    integer;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization in session' USING ERRCODE = '42501';
  END IF;
  -- A JSON null from the API means "not provided", same as SQL NULL.
  IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'null' THEN
    p_lines := NULL;
  END IF;
  IF jsonb_typeof(v_header) = 'null' THEN
    v_header := '{}'::jsonb;
  END IF;
  IF jsonb_typeof(v_header) <> 'object' THEN
    RAISE EXCEPTION 'header must be an object' USING ERRCODE = 'check_violation';
  END IF;
  IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'lines must be an array' USING ERRCODE = 'check_violation';
  END IF;

  -- Normalise and validate lines once.
  IF p_lines IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'item',  (e.v ->> 'catalog_item_id')::uuid,
             'qty',   (e.v ->> 'quantity')::numeric(12, 3),
             'opt',   COALESCE((e.v ->> 'is_optional')::boolean, false),
             'notes', nullif(btrim(e.v ->> 'notes'), ''),
             'ord',   e.ord
           ) ORDER BY e.ord), '[]'::jsonb)
      INTO v_norm
      FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS e(v, ord);

    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(v_norm) AS n(item uuid, qty numeric, opt boolean, notes text, ord int)
      WHERE n.item IS NULL OR n.qty IS NULL OR n.qty <= 0
    ) THEN
      RAISE EXCEPTION 'every kit line needs an item and a quantity above zero'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT count(*) - count(DISTINCT n.item) INTO v_dupes
      FROM jsonb_to_recordset(v_norm) AS n(item uuid, qty numeric, opt boolean, notes text, ord int);
    IF v_dupes > 0 THEN
      RAISE EXCEPTION 'an item can appear only once in a kit'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF v_id IS NULL THEN
    IF NOT (v_header ? 'name') THEN
      RAISE EXCEPTION 'name is required' USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.kit_templates (org_id, name, description, category, status)
    VALUES (
      v_org,
      v_header ->> 'name',
      nullif(btrim(v_header ->> 'description'), ''),
      nullif(btrim(v_header ->> 'category'), ''),
      COALESCE(v_header ->> 'status', 'active')
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.kit_templates k SET
      name        = CASE WHEN v_header ? 'name'        THEN v_header ->> 'name' ELSE k.name END,
      description = CASE WHEN v_header ? 'description' THEN nullif(btrim(v_header ->> 'description'), '') ELSE k.description END,
      category    = CASE WHEN v_header ? 'category'    THEN nullif(btrim(v_header ->> 'category'), '') ELSE k.category END,
      status      = CASE WHEN v_header ? 'status'      THEN v_header ->> 'status' ELSE k.status END
    WHERE k.id = v_id AND k.org_id = v_org;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'kit template not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_lines IS NOT NULL THEN
    IF p_kit_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
          FROM jsonb_to_recordset(v_norm) AS n(item uuid, qty numeric, opt boolean, notes text, ord int)
          FULL JOIN (SELECT * FROM public.kit_template_lines WHERE kit_id = v_id) l
            ON l.catalog_item_id = n.item
         WHERE n.item IS NULL
            OR l.id IS NULL
            OR l.quantity IS DISTINCT FROM n.qty
            OR l.is_optional <> n.opt
            OR l.notes IS DISTINCT FROM n.notes
      ) INTO v_changed;
    END IF;

    DELETE FROM public.kit_template_lines l
     WHERE l.kit_id = v_id
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_to_recordset(v_norm) AS n(item uuid, qty numeric, opt boolean, notes text, ord int)
          WHERE n.item = l.catalog_item_id
       );

    INSERT INTO public.kit_template_lines (org_id, kit_id, catalog_item_id, quantity, is_optional, notes, sort_order)
    SELECT v_org, v_id, n.item, n.qty, n.opt, n.notes, n.ord
      FROM jsonb_to_recordset(v_norm) AS n(item uuid, qty numeric, opt boolean, notes text, ord int)
    ON CONFLICT (kit_id, catalog_item_id) DO UPDATE
      SET quantity   = EXCLUDED.quantity,
          is_optional = EXCLUDED.is_optional,
          notes      = EXCLUDED.notes,
          sort_order = EXCLUDED.sort_order;

    IF v_changed THEN
      UPDATE public.kit_templates SET version = version + 1 WHERE id = v_id AND org_id = v_org;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_kit_template(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_kit_template(uuid, jsonb, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Privileges — defense in depth beneath RLS
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.inventory_settings   FROM anon;
REVOKE ALL ON public.kit_templates        FROM anon;
REVOKE ALL ON public.kit_template_lines   FROM anon;
REVOKE DELETE, TRUNCATE ON public.inventory_settings FROM authenticated;

-- ---------------------------------------------------------------------------
-- RLS — ENABLE + FORCE; portal has no policy anywhere.
-- ---------------------------------------------------------------------------

ALTER TABLE public.inventory_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_settings   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.kit_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_templates        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.kit_template_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_template_lines   FORCE ROW LEVEL SECURITY;

-- inventory_settings: ops roles read; owner writes. No DELETE policy (privilege revoked) -
DROP POLICY IF EXISTS "inventory_settings: read for ops" ON public.inventory_settings;
CREATE POLICY "inventory_settings: read for ops"
  ON public.inventory_settings FOR SELECT TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'office')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "inventory_settings: insert for owner" ON public.inventory_settings;
CREATE POLICY "inventory_settings: insert for owner"
  ON public.inventory_settings FOR INSERT TO authenticated
  WITH CHECK (
    (select current_app_role()) = 'owner'
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "inventory_settings: update for owner" ON public.inventory_settings;
CREATE POLICY "inventory_settings: update for owner"
  ON public.inventory_settings FOR UPDATE TO authenticated
  USING (
    (select current_app_role()) = 'owner'
    AND org_id = (select current_org_id())
  )
  WITH CHECK (
    (select current_app_role()) = 'owner'
    AND org_id = (select current_org_id())
  );

-- kit_templates: every internal role reads (crews should see what is in a kit); ----
-- owner/manager/office write; owner deletes.
DROP POLICY IF EXISTS "kit_templates: read for staff" ON public.kit_templates;
CREATE POLICY "kit_templates: read for staff"
  ON public.kit_templates FOR SELECT TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "kit_templates: insert for office+" ON public.kit_templates;
CREATE POLICY "kit_templates: insert for office+"
  ON public.kit_templates FOR INSERT TO authenticated
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'office')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "kit_templates: update for office+" ON public.kit_templates;
CREATE POLICY "kit_templates: update for office+"
  ON public.kit_templates FOR UPDATE TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'office')
    AND org_id = (select current_org_id())
  )
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'office')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "kit_templates: delete for owner" ON public.kit_templates;
CREATE POLICY "kit_templates: delete for owner"
  ON public.kit_templates FOR DELETE TO authenticated
  USING ((select current_app_role()) = 'owner' AND org_id = (select current_org_id()));

-- kit_template_lines: same shape -------------------------------------------------
DROP POLICY IF EXISTS "kit_template_lines: read for staff" ON public.kit_template_lines;
CREATE POLICY "kit_template_lines: read for staff"
  ON public.kit_template_lines FOR SELECT TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'dispatch', 'tech', 'office', 'sales')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "kit_template_lines: insert for office+" ON public.kit_template_lines;
CREATE POLICY "kit_template_lines: insert for office+"
  ON public.kit_template_lines FOR INSERT TO authenticated
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'office')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "kit_template_lines: update for office+" ON public.kit_template_lines;
CREATE POLICY "kit_template_lines: update for office+"
  ON public.kit_template_lines FOR UPDATE TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'office')
    AND org_id = (select current_org_id())
  )
  WITH CHECK (
    (select current_app_role()) IN ('owner', 'manager', 'office')
    AND org_id = (select current_org_id())
  );

DROP POLICY IF EXISTS "kit_template_lines: delete for office+" ON public.kit_template_lines;
CREATE POLICY "kit_template_lines: delete for office+"
  ON public.kit_template_lines FOR DELETE TO authenticated
  USING (
    (select current_app_role()) IN ('owner', 'manager', 'office')
    AND org_id = (select current_org_id())
  );
