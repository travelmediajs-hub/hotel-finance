-- Add contract_days_per_month to employees for per-employee work schedule
-- e.g. housekeeper: 26 days/month x 8h, receptionist: 20 days/month x 12h
ALTER TABLE employees ADD COLUMN contract_days_per_month smallint NOT NULL DEFAULT 22;
