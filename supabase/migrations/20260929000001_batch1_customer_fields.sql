-- Batch 1 friction fixes (F1, F3, F4): intake fields on customers.
--
-- Street address + ZIP (F1), second phone (F4), and call-reason / intake
-- notes (F3). All nullable-in-practice via NOT NULL DEFAULT '' so existing
-- rows and old code paths keep working. The API reads/writes these columns
-- explicitly, so this migration must be applied before the batch-1 deploy.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS zip text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone2 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
-- DOWN
-- Drop the intake columns added to customers. Doing so discards street, ZIP,
-- second phone, and notes stored in those columns. It does not delete customer rows.
--   ALTER TABLE public.customers DROP COLUMN IF EXISTS notes;
--   ALTER TABLE public.customers DROP COLUMN IF EXISTS phone2;
--   ALTER TABLE public.customers DROP COLUMN IF EXISTS zip;
--   ALTER TABLE public.customers DROP COLUMN IF EXISTS street;
