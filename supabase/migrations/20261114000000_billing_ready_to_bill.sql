-- Migration: 20261114000000_billing_ready_to_bill
-- Purpose: Add billing columns to jobs table for the ready-to-bill feature.
--
-- billing_status: 'unbilled' | 'billed' | 'excluded'
--   - Defaults to 'unbilled' for all rows.
-- billing_eligible: boolean
--   - false for all existing rows (keeps ~3,531 historical completed jobs out of the list).
--   - The app sets this to true only when a job newly transitions to Completed.
-- qb_invoice_number: text, nullable — QuickBooks invoice number.
-- billed_at: date, nullable — when the job was marked billed.
-- billed_by: uuid, nullable — who marked it billed.

-- Add columns
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'unbilled',
  ADD COLUMN IF NOT EXISTS billing_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qb_invoice_number text,
  ADD COLUMN IF NOT EXISTS billed_at date,
  ADD COLUMN IF NOT EXISTS billed_by uuid;

-- Enforce valid billing_status values
ALTER TABLE jobs
  ADD CONSTRAINT jobs_billing_status_check
  CHECK (billing_status IN ('unbilled', 'billed', 'excluded'));

-- Index for the ready-to-bill query: completed, unbilled, eligible jobs by type.
-- This covers the primary list query efficiently.
CREATE INDEX IF NOT EXISTS idx_jobs_billing_ready
  ON jobs (org_id, type)
  WHERE status = 'Completed'
    AND billing_status = 'unbilled'
    AND billing_eligible = true;

-- Comment for clarity
COMMENT ON COLUMN jobs.billing_status IS 'Billing lifecycle: unbilled (default), billed (invoice sent), excluded (warranty/no-charge/internal).';
COMMENT ON COLUMN jobs.billing_eligible IS 'True only for jobs that completed after the billing feature go-live. Historical imports default to false.';
COMMENT ON COLUMN jobs.qb_invoice_number IS 'QuickBooks invoice number, set when marking a job billed.';
COMMENT ON COLUMN jobs.billed_at IS 'Date the job was marked billed.';
COMMENT ON COLUMN jobs.billed_by IS 'User who marked the job billed.';
