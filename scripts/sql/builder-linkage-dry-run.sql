-- builder-linkage-dry-run.sql
-- Dry-run report: shows which site customers would be linked to builder parents.
-- Run in Supabase SQL Editor. Does NOT modify any data.
--
-- For each builder, finds customers whose name starts with "<Builder> - " or
-- "<Builder> -" and who do NOT already have a parent_customer_id set.
-- Flags ambiguous matches (name matches more than one potential parent).

WITH builder_names (builder) AS (
  VALUES
    ('McBride'),
    ('Better Builders'),
    ('Blue Sound Construction'),
    ('Jonathan David Building Company'),
    ('Doran Construction'),
    ('Exalt Services')
),

-- Find the canonical parent customer for each builder (exact name match)
parents AS (
  SELECT
    c.id   AS parent_id,
    c.name AS parent_name,
    bn.builder
  FROM builder_names bn
  JOIN customers c ON c.name = bn.builder
),

-- Find site customers that match any builder pattern
site_matches AS (
  SELECT
    c.id          AS customer_id,
    c.name        AS customer_name,
    c.parent_customer_id,
    bn.builder    AS matched_builder
  FROM builder_names bn
  JOIN customers c
    ON (
      c.name LIKE bn.builder || ' - %'
      OR c.name LIKE bn.builder || ' -%'
      -- Also catch names like "McBride Doscher" (no dash separator)
      OR (c.name LIKE bn.builder || ' %' AND c.name <> bn.builder)
    )
    AND c.name <> bn.builder  -- exclude the parent itself
),

-- Count how many builders each site matches (to flag ambiguous)
match_counts AS (
  SELECT
    customer_id,
    count(DISTINCT matched_builder) AS num_matches
  FROM site_matches
  GROUP BY customer_id
),

-- Build the report
report AS (
  SELECT
    sm.customer_id,
    sm.customer_name,
    p.parent_id       AS proposed_parent_id,
    p.parent_name      AS proposed_parent_name,
    sm.matched_builder,
    CASE
      WHEN mc.num_matches > 1 THEN 'AMBIGUOUS (' || mc.num_matches || ' matches)'
      WHEN p.parent_id IS NULL THEN 'NO PARENT FOUND'
      ELSE 'OK'
    END AS confidence,
    sm.parent_customer_id AS current_parent
  FROM site_matches sm
  LEFT JOIN parents p ON p.builder = sm.matched_builder
  LEFT JOIN match_counts mc ON mc.customer_id = sm.customer_id
  WHERE sm.parent_customer_id IS NULL  -- only unlinked customers
)

SELECT
  proposed_parent_name,
  customer_id,
  customer_name,
  proposed_parent_id,
  confidence,
  current_parent
FROM report
ORDER BY proposed_parent_name, customer_name;
