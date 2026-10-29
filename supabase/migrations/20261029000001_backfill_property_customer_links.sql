-- Backfill properties.customer_id from jobs when the link is unambiguous.
--
-- Properties were saved with a null customer_id when the create form sent a
-- customer id in the name field, or when the customer name did not match
-- exactly. Jobs already store property_id / property_name and customer_id /
-- customer_name. This fills only NULL property links. It never deletes rows
-- and never overwrites a customer_id that is already set.
--
-- DOWN
-- Do not null out properties.customer_id. After this runs, a filled value
-- cannot be told apart from a link someone set by hand. Reversing it would
-- unlink real customers. Leave the filled rows in place.

-- Pass 1: jobs that point at the property by id and agree on one customer.
WITH job_links AS (
  SELECT
    j.org_id,
    j.property_id,
    j.customer_id
  FROM public.jobs j
  WHERE j.property_id IS NOT NULL
    AND j.customer_id IS NOT NULL
),
unique_links AS (
  SELECT
    org_id,
    property_id,
    MIN(customer_id::text)::uuid AS customer_id
  FROM job_links
  GROUP BY org_id, property_id
  HAVING COUNT(DISTINCT customer_id) = 1
)
UPDATE public.properties p
SET
  customer_id = u.customer_id,
  updated_at = now()
FROM unique_links u
WHERE p.id = u.property_id
  AND p.org_id = u.org_id
  AND p.customer_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = u.customer_id
      AND c.org_id = p.org_id
  );

-- Pass 2: same property name and customer name (or customer id) inside the org,
-- still only when every matching job names one customer.
WITH name_links AS (
  SELECT
    p.id AS property_id,
    c.id AS customer_id
  FROM public.properties p
  JOIN public.jobs j
    ON j.org_id = p.org_id
   AND length(btrim(j.property_name)) > 0
   AND lower(btrim(j.property_name)) = lower(btrim(p.name))
  JOIN public.customers c
    ON c.org_id = p.org_id
   AND (
     c.id = j.customer_id
     OR (
       j.customer_id IS NULL
       AND length(btrim(j.customer_name)) > 0
       AND lower(btrim(c.name)) = lower(btrim(j.customer_name))
     )
   )
  WHERE p.customer_id IS NULL
),
unique_name_links AS (
  SELECT
    property_id,
    MIN(customer_id::text)::uuid AS customer_id
  FROM name_links
  GROUP BY property_id
  HAVING COUNT(DISTINCT customer_id) = 1
)
UPDATE public.properties p
SET
  customer_id = u.customer_id,
  updated_at = now()
FROM unique_name_links u
WHERE p.id = u.property_id
  AND p.customer_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = u.customer_id
      AND c.org_id = p.org_id
  );
