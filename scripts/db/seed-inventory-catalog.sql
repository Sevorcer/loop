-- =============================================================================
-- Inventory Lane 1 starter catalog (NOT a migration).
--
-- A small, proposed starting draft: categories, item definitions, and the
-- warehouse + quarantine locations. Collin / the installers should strike what
-- they never pull and add what is missing BEFORE this is loaded in production.
--
-- Deliberately NOT seeded:
--   * vehicles / van locations: vans are added by hand in Locations & vans
--   * stock quantities: first stock enters through real receive/count ledger
--     entries after a physical count, so day-one numbers are real
--   * prices and costs: set per item in the catalog
--
-- Idempotent: re-running adds only what is missing (matched by name per org).
-- Requires migrations 20261123000000 and 20261123100000 to be applied.
--
-- Usage:
--   psql  -v ON_ERROR_STOP=1 -c "SET loop.seed_org_id = '<org uuid>'" -f ...   (same session), or
--   run through the SQL editor / MCP execute_sql after setting the org below.
-- If loop.seed_org_id is not set and the database has exactly ONE organization,
-- that organization is used; otherwise the script stops without writing.
-- =============================================================================

DO $seed$
DECLARE
  v_org uuid := NULLIF(current_setting('loop.seed_org_id', true), '')::uuid;
  v_orgs integer;
BEGIN
  IF v_org IS NULL THEN
    SELECT count(*) INTO v_orgs FROM public.organizations;
    IF v_orgs <> 1 THEN
      RAISE EXCEPTION 'Set loop.seed_org_id: found % organizations, expected exactly 1.', v_orgs;
    END IF;
    SELECT id INTO v_org FROM public.organizations;
  ELSIF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
    RAISE EXCEPTION 'Organization % does not exist.', v_org;
  END IF;

  -- Locations (no vans, no job locations).
  INSERT INTO public.inventory_locations (org_id, type, name, address)
  SELECT v_org, t.type, t.name, t.address
  FROM (VALUES
    ('warehouse', 'Shop warehouse', '4403 Russell Rd, Mukilteo'),
    ('quarantine', 'Quarantine / RMA', NULL)
  ) AS t(type, name, address)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.inventory_locations l
    WHERE l.org_id = v_org AND lower(l.name) = lower(t.name)
  );

  -- Root categories.
  INSERT INTO public.catalog_categories (org_id, parent_id, name, sort_order)
  SELECT v_org, NULL, c.name, c.sort_order
  FROM (VALUES
    ('Equipment', 0),
    ('Refrigerant', 1),
    ('Line set & refrigerant side', 2),
    ('Condensate & drain', 3),
    ('Electrical', 4),
    ('Gas & venting', 5),
    ('Mounting & sealing', 6),
    ('Controls', 7)
  ) AS c(name, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.catalog_categories x
    WHERE x.org_id = v_org AND x.parent_id IS NULL AND lower(x.name) = lower(c.name)
  );

  -- Stock-only items (is_sellable = false; price is set later in the catalog).
  INSERT INTO public.catalog_items
    (org_id, category_id, name, item_kind, is_sellable, is_stockable, unit, tracking_mode)
  SELECT v_org, cat.id, i.name, i.item_kind, false, true, i.unit, i.tracking_mode
  FROM (VALUES
    ('Equipment', 'Gas furnace', 'equipment', 'ea', 'serialized'),
    ('Equipment', 'Air handler', 'equipment', 'ea', 'serialized'),
    ('Equipment', 'Evaporator coil', 'equipment', 'ea', 'serialized'),
    ('Equipment', 'AC condenser', 'equipment', 'ea', 'serialized'),
    ('Equipment', 'Heat pump condenser', 'equipment', 'ea', 'serialized'),
    ('Equipment', 'Ductless mini-split outdoor unit', 'equipment', 'ea', 'serialized'),
    ('Equipment', 'Mini-split indoor head', 'equipment', 'ea', 'serialized'),
    ('Refrigerant', 'Refrigerant cylinder R-454B', 'refrigerant', 'lb', 'serialized'),
    ('Refrigerant', 'Refrigerant cylinder R-410A', 'refrigerant', 'lb', 'serialized'),
    ('Line set & refrigerant side', 'Copper line set 1/4 x 3/8', 'consumable', 'ft', 'quantity'),
    ('Line set & refrigerant side', 'Copper line set 3/8 x 3/4', 'consumable', 'ft', 'quantity'),
    ('Line set & refrigerant side', 'Copper line set 3/8 x 5/8', 'consumable', 'ft', 'quantity'),
    ('Line set & refrigerant side', 'Copper line set 1/4 x 1/2', 'consumable', 'ft', 'quantity'),
    ('Line set & refrigerant side', 'Line set insulation', 'consumable', 'ft', 'quantity'),
    ('Line set & refrigerant side', 'Brazing rod 15%', 'consumable', 'ea', 'quantity'),
    ('Line set & refrigerant side', 'Filter drier', 'consumable', 'ea', 'quantity'),
    ('Line set & refrigerant side', 'Flare nuts', 'consumable', 'ea', 'quantity'),
    ('Line set & refrigerant side', 'Mini-split line-set kit', 'consumable', 'ea', 'quantity'),
    ('Line set & refrigerant side', 'Line-set cover / linehide', 'consumable', 'ft', 'quantity'),
    ('Condensate & drain', 'PVC 3/4 pipe', 'consumable', 'ft', 'quantity'),
    ('Condensate & drain', 'PVC 3/4 elbow', 'consumable', 'ea', 'quantity'),
    ('Condensate & drain', 'PVC 3/4 coupling', 'consumable', 'ea', 'quantity'),
    ('Condensate & drain', 'PVC primer', 'consumable', 'ea', 'quantity'),
    ('Condensate & drain', 'PVC cement', 'consumable', 'ea', 'quantity'),
    ('Condensate & drain', 'Condensate pump', 'consumable', 'ea', 'quantity'),
    ('Condensate & drain', 'Float / overflow switch', 'consumable', 'ea', 'quantity'),
    ('Condensate & drain', 'Drain trap', 'consumable', 'ea', 'quantity'),
    ('Condensate & drain', 'Vinyl tubing', 'consumable', 'ft', 'quantity'),
    ('Electrical', 'Disconnect box 60A non-fused', 'consumable', 'ea', 'quantity'),
    ('Electrical', '30A whip / flex', 'consumable', 'ea', 'quantity'),
    ('Electrical', 'Wire 6/3', 'consumable', 'ft', 'quantity'),
    ('Electrical', 'Wire 14/2', 'consumable', 'ft', 'quantity'),
    ('Electrical', 'Thermostat wire 18/5', 'consumable', 'ft', 'quantity'),
    ('Electrical', 'Wire nuts', 'consumable', 'box', 'quantity'),
    ('Electrical', '2-pole breaker 30A', 'consumable', 'ea', 'quantity'),
    ('Electrical', '2-pole breaker 40A', 'consumable', 'ea', 'quantity'),
    ('Electrical', '2-pole breaker 60A', 'consumable', 'ea', 'quantity'),
    ('Electrical', 'Surge protector', 'consumable', 'ea', 'quantity'),
    ('Electrical', 'Contactor 30A 2P', 'consumable', 'ea', 'quantity'),
    ('Electrical', 'Run capacitor dual 45/5', 'consumable', 'ea', 'quantity'),
    ('Electrical', 'Run capacitor dual 35/5', 'consumable', 'ea', 'quantity'),
    ('Electrical', 'Run capacitor dual 40/5', 'consumable', 'ea', 'quantity'),
    ('Gas & venting', 'Gas flex connector 1/2', 'consumable', 'ea', 'quantity'),
    ('Gas & venting', 'Gas flex connector 3/4', 'consumable', 'ea', 'quantity'),
    ('Gas & venting', 'Black pipe nipples assorted', 'consumable', 'ea', 'quantity'),
    ('Gas & venting', 'Gas shutoff valve', 'consumable', 'ea', 'quantity'),
    ('Gas & venting', 'Pipe dope / tape', 'consumable', 'ea', 'quantity'),
    ('Gas & venting', 'B-vent / flue pipe 4 in', 'consumable', 'ft', 'quantity'),
    ('Gas & venting', 'Flue pipe 5 in', 'consumable', 'ft', 'quantity'),
    ('Gas & venting', 'Vent termination / cap', 'consumable', 'ea', 'quantity'),
    ('Gas & venting', 'PVC vent 2 in', 'consumable', 'ft', 'quantity'),
    ('Gas & venting', 'PVC vent 3 in', 'consumable', 'ft', 'quantity'),
    ('Gas & venting', 'PVC vent elbow 2 in', 'consumable', 'ea', 'quantity'),
    ('Gas & venting', 'PVC vent elbow 3 in', 'consumable', 'ea', 'quantity'),
    ('Mounting & sealing', 'Condenser pad', 'consumable', 'ea', 'quantity'),
    ('Mounting & sealing', 'Line-set wall bracket', 'consumable', 'ea', 'quantity'),
    ('Mounting & sealing', 'Mini-split wall bracket', 'consumable', 'ea', 'quantity'),
    ('Mounting & sealing', 'Sheet-metal screws', 'consumable', 'box', 'quantity'),
    ('Mounting & sealing', 'Foil tape', 'consumable', 'roll', 'quantity'),
    ('Mounting & sealing', 'Mastic', 'consumable', 'tub', 'quantity'),
    ('Mounting & sealing', 'Duct straps', 'consumable', 'ea', 'quantity'),
    ('Mounting & sealing', 'Spray foam', 'consumable', 'ea', 'quantity'),
    ('Mounting & sealing', 'Wall sleeve / seal', 'consumable', 'ea', 'quantity'),
    ('Controls', 'Honeywell VisionPro 8000 thermostat', 'consumable', 'ea', 'quantity'),
    ('Controls', 'Generic 24V thermostat', 'consumable', 'ea', 'quantity'),
    ('Controls', 'Honeywell zone panel', 'consumable', 'ea', 'quantity'),
    ('Controls', 'Zone damper round assorted', 'consumable', 'ea', 'quantity'),
    ('Controls', 'Return / supply grille assorted', 'consumable', 'ea', 'quantity'),
    ('Controls', 'Filter 1 in', 'consumable', 'ea', 'quantity'),
    ('Controls', 'Filter 4 in media', 'consumable', 'ea', 'quantity')
  ) AS i(category, name, item_kind, unit, tracking_mode)
  JOIN public.catalog_categories cat
    ON cat.org_id = v_org AND cat.parent_id IS NULL AND lower(cat.name) = lower(i.category)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.catalog_items x
    WHERE x.org_id = v_org AND lower(x.name) = lower(i.name)
  );
END
$seed$;
