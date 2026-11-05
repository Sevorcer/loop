-- builder-linkage.sql
-- Links site customers to their parent builder customer.
-- Idempotent: only updates rows where parent_customer_id IS NULL.
-- Run in Supabase SQL Editor inside a transaction.

BEGIN;

-- Helper: create a temp table to collect update counts
CREATE TEMP TABLE IF NOT EXISTS _linkage_results (
  builder text,
  rows_updated integer
) ON COMMIT DROP;

-- ============================================================
-- McBride
-- ============================================================
WITH parent AS (
  SELECT id FROM customers WHERE name = 'McBride' LIMIT 1
)
UPDATE customers c
SET parent_customer_id = parent.id,
    updated_at = now()
FROM parent
WHERE c.parent_customer_id IS NULL
  AND c.id <> parent.id
  AND (
    c.name LIKE 'McBride - %'
    OR c.name LIKE 'McBride -%'
    OR (c.name LIKE 'McBride %' AND c.name <> 'McBride')
  );

INSERT INTO _linkage_results VALUES ('McBride', (SELECT count(*) FROM customers WHERE parent_customer_id = (SELECT id FROM customers WHERE name = 'McBride' LIMIT 1)));

-- ============================================================
-- Better Builders
-- ============================================================
WITH parent AS (
  SELECT id FROM customers WHERE name = 'Better Builders' LIMIT 1
)
UPDATE customers c
SET parent_customer_id = parent.id,
    updated_at = now()
FROM parent
WHERE c.parent_customer_id IS NULL
  AND c.id <> parent.id
  AND (
    c.name LIKE 'Better Builders - %'
    OR c.name LIKE 'Better Builders -%'
    OR (c.name LIKE 'Better Builders %' AND c.name <> 'Better Builders')
  );

INSERT INTO _linkage_results VALUES ('Better Builders', (SELECT count(*) FROM customers WHERE parent_customer_id = (SELECT id FROM customers WHERE name = 'Better Builders' LIMIT 1)));

-- ============================================================
-- Blue Sound Construction
-- ============================================================
WITH parent AS (
  SELECT id FROM customers WHERE name = 'Blue Sound Construction' LIMIT 1
)
UPDATE customers c
SET parent_customer_id = parent.id,
    updated_at = now()
FROM parent
WHERE c.parent_customer_id IS NULL
  AND c.id <> parent.id
  AND (
    c.name LIKE 'Blue Sound Construction - %'
    OR c.name LIKE 'Blue Sound Construction -%'
    OR c.name LIKE 'Blue Sound - %'
    OR c.name LIKE 'Blue Sound -%'
    OR (c.name LIKE 'Blue Sound Construction %' AND c.name <> 'Blue Sound Construction')
    OR (c.name LIKE 'Blue Sound %' AND c.name NOT LIKE 'Blue Sound Construction%')
  );

INSERT INTO _linkage_results VALUES ('Blue Sound Construction', (SELECT count(*) FROM customers WHERE parent_customer_id = (SELECT id FROM customers WHERE name = 'Blue Sound Construction' LIMIT 1)));

-- ============================================================
-- Jonathan David Building Company
-- ============================================================
WITH parent AS (
  SELECT id FROM customers WHERE name = 'Jonathan David Building Company' LIMIT 1
)
UPDATE customers c
SET parent_customer_id = parent.id,
    updated_at = now()
FROM parent
WHERE c.parent_customer_id IS NULL
  AND c.id <> parent.id
  AND (
    c.name LIKE 'Jonathan David Building Company - %'
    OR c.name LIKE 'Jonathan David Building Company -%'
    OR (c.name LIKE 'Jonathan David Building Company %' AND c.name <> 'Jonathan David Building Company')
  );

INSERT INTO _linkage_results VALUES ('Jonathan David Building Company', (SELECT count(*) FROM customers WHERE parent_customer_id = (SELECT id FROM customers WHERE name = 'Jonathan David Building Company' LIMIT 1)));

-- ============================================================
-- Doran Construction
-- ============================================================
WITH parent AS (
  SELECT id FROM customers WHERE name = 'Doran Construction' LIMIT 1
)
UPDATE customers c
SET parent_customer_id = parent.id,
    updated_at = now()
FROM parent
WHERE c.parent_customer_id IS NULL
  AND c.id <> parent.id
  AND (
    c.name LIKE 'Doran Construction - %'
    OR c.name LIKE 'Doran Construction -%'
    OR (c.name LIKE 'Doran Construction %' AND c.name <> 'Doran Construction')
  );

INSERT INTO _linkage_results VALUES ('Doran Construction', (SELECT count(*) FROM customers WHERE parent_customer_id = (SELECT id FROM customers WHERE name = 'Doran Construction' LIMIT 1)));

-- ============================================================
-- Exalt Services
-- ============================================================
WITH parent AS (
  SELECT id FROM customers WHERE name = 'Exalt Services' LIMIT 1
)
UPDATE customers c
SET parent_customer_id = parent.id,
    updated_at = now()
FROM parent
WHERE c.parent_customer_id IS NULL
  AND c.id <> parent.id
  AND (
    c.name LIKE 'Exalt Services - %'
    OR c.name LIKE 'Exalt Services -%'
    OR (c.name LIKE 'Exalt Services %' AND c.name <> 'Exalt Services')
  );

INSERT INTO _linkage_results VALUES ('Exalt Services', (SELECT count(*) FROM customers WHERE parent_customer_id = (SELECT id FROM customers WHERE name = 'Exalt Services' LIMIT 1)));

-- ============================================================
-- Summary
-- ============================================================
SELECT builder, rows_updated FROM _linkage_results ORDER BY builder;

COMMIT;
