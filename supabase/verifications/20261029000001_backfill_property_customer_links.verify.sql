-- Verification for 20261029000001_backfill_property_customer_links.sql
-- The backfill may update zero rows. It must not attach a property to a
-- customer in a different organization, and it must leave the column in place.

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'customer_id'
  ), 'properties.customer_id must still exist';
END;
$$;

DO $$
BEGIN
  ASSERT NOT EXISTS (
    SELECT 1
    FROM public.properties p
    JOIN public.customers c ON c.id = p.customer_id
    WHERE p.customer_id IS NOT NULL
      AND c.org_id IS DISTINCT FROM p.org_id
  ), 'property customer links must stay inside the same organization';
END;
$$;
