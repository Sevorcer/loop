-- Asserts the customer intake columns from 20260929000001.
DO $$ BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND column_name = 'street' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'customers.street must be a NOT NULL text column';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND column_name = 'zip' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'customers.zip must be a NOT NULL text column';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND column_name = 'phone2' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'customers.phone2 must be a NOT NULL text column';
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND column_name = 'notes' AND data_type = 'text' AND is_nullable = 'NO'
  ), 'customers.notes must be a NOT NULL text column';
END; $$;
