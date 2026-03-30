ALTER TABLE in_transits
  ADD COLUMN IF NOT EXISTS destination_type text CHECK (destination_type IN ('BANK_ACCOUNT', 'PROPERTY_CASH', 'CO_CASH')),
  ADD COLUMN IF NOT EXISTS destination_id uuid;

NOTIFY pgrst, 'reload schema';
