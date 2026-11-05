-- permit-type-derivation.sql
-- ---------------------------------------------------------------------------
-- Derive permit_type from the permit_number suffix for imported permits
-- that have no permit_type set.
--
-- Suffix -> permit_type map (confirm with Zowe/Collin before running):
--   -ME -> TBD (mechanical?)
--   -RF -> TBD (refrigeration?)
--   -FR -> TBD (fire?)
--
-- Replace the TBD values below with the correct permit types before running.
-- ---------------------------------------------------------------------------

-- ========================
-- DRY-RUN: preview what would be updated (run this first)
-- ========================
SELECT
  id,
  permit_number,
  jurisdiction,
  permit_type AS current_permit_type,
  CASE
    WHEN permit_number ILIKE '%-ME' THEN 'TBD_ME'
    WHEN permit_number ILIKE '%-RF' THEN 'TBD_RF'
    WHEN permit_number ILIKE '%-FR' THEN 'TBD_FR'
  END AS derived_permit_type
FROM public.job_permits
WHERE (permit_type IS NULL OR permit_type = '')
  AND permit_number IS NOT NULL
  AND (
    permit_number ILIKE '%-ME'
    OR permit_number ILIKE '%-RF'
    OR permit_number ILIKE '%-FR'
  )
ORDER BY permit_number;

-- ========================
-- UPDATE: apply derived permit_type (idempotent — only touches NULL/empty rows)
-- ========================
-- UPDATE public.job_permits
-- SET
--   permit_type = CASE
--     WHEN permit_number ILIKE '%-ME' THEN 'TBD_ME'
--     WHEN permit_number ILIKE '%-RF' THEN 'TBD_RF'
--     WHEN permit_number ILIKE '%-FR' THEN 'TBD_FR'
--   END,
--   updated_at = now()
-- WHERE (permit_type IS NULL OR permit_type = '')
--   AND permit_number IS NOT NULL
--   AND (
--     permit_number ILIKE '%-ME'
--     OR permit_number ILIKE '%-RF'
--     OR permit_number ILIKE '%-FR'
--   );
