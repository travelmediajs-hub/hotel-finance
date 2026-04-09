-- Backfill kind='REVENUE' for departments that have a fiscal device or POS terminal
-- (these are points of sale that should appear in daily reports).

UPDATE departments
SET kind = 'REVENUE'
WHERE kind <> 'REVENUE'
  AND (fiscal_device_id IS NOT NULL OR pos_terminal_id IS NOT NULL);

NOTIFY pgrst, 'reload schema';
