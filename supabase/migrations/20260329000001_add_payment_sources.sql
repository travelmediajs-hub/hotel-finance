-- Add allowed payment methods to bank accounts and co_cash
ALTER TABLE bank_accounts ADD COLUMN allowed_payments text[] NOT NULL DEFAULT '{}';
ALTER TABLE co_cash ADD COLUMN allowed_payments text[] NOT NULL DEFAULT '{}';

-- Add co_cash_id to expenses for tracking cash payments
ALTER TABLE expenses ADD COLUMN co_cash_id uuid REFERENCES co_cash(id);

-- Update existing bank accounts: default to BANK_TRANSFER and CARD
UPDATE bank_accounts SET allowed_payments = ARRAY['BANK_TRANSFER', 'CARD'];

-- Update existing co_cash: default to CASH
UPDATE co_cash SET allowed_payments = ARRAY['CASH'];

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
