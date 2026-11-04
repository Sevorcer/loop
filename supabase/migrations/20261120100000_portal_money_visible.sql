-- Migration: portal_money_visible on jobs
-- GC Portal — Task 3: Per-job toggle for money visibility in the portal
--
-- When false (default), the portal API returns no money fields at all.
-- When true, the portal shows the job's financial data from the GC ledger.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS portal_money_visible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN jobs.portal_money_visible IS
  'When true, the GC builder portal shows financial data (price, change orders, invoices, balance, retainer) for this job. Default false — office+ toggles it on per job.';
