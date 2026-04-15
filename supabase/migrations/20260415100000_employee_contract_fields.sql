-- Contract type and start date
ALTER TABLE employees ADD COLUMN contract_type text NOT NULL DEFAULT 'indefinite';
ALTER TABLE employees ADD COLUMN contract_start_date date;
