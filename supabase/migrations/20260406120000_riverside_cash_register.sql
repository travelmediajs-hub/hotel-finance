-- Property cash registers: one per property, auto-created
CREATE TABLE IF NOT EXISTS property_cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  opening_balance decimal(12,2) NOT NULL DEFAULT 0,
  opening_balance_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_cash_registers_property_id_key UNIQUE (property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_cash_registers_property ON property_cash_registers (property_id);

-- RLS
ALTER TABLE property_cash_registers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_cash_registers_select ON property_cash_registers;
CREATE POLICY property_cash_registers_select ON property_cash_registers FOR SELECT USING (true);
DROP POLICY IF EXISTS property_cash_registers_insert ON property_cash_registers;
CREATE POLICY property_cash_registers_insert ON property_cash_registers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS property_cash_registers_update ON property_cash_registers;
CREATE POLICY property_cash_registers_update ON property_cash_registers FOR UPDATE USING (true);

-- View: property cash balance
CREATE OR REPLACE VIEW property_cash_balances AS
SELECT
  pcr.id,
  pcr.property_id,
  pcr.name,
  pcr.opening_balance,
  pcr.opening_balance_date,
  pcr.opening_balance
    -- Daily report cash revenue (APPROVED/CORRECTED reports only)
    + COALESCE((
      SELECT SUM(drl.cash_net)
      FROM daily_report_lines drl
      JOIN daily_reports dr ON dr.id = drl.daily_report_id
      WHERE dr.property_id = pcr.property_id
        AND dr.status IN ('APPROVED', 'CORRECTED')
        AND dr.date >= pcr.opening_balance_date
    ), 0)
    -- Withdrawals (APPROVED or ACCOUNTED, not voided)
    - COALESCE((
      SELECT SUM(w.amount)
      FROM withdrawals w
      WHERE w.property_id = pcr.property_id
        AND w.status IN ('APPROVED', 'ACCOUNTED')
        AND w.is_void = false
        AND w.withdrawal_date::date >= pcr.opening_balance_date
    ), 0)
    -- Cash collections sent to CO
    - COALESCE((
      SELECT SUM(cc.amount)
      FROM cash_collections cc
      WHERE cc.property_id = pcr.property_id
        AND cc.status IN ('SENT', 'RECEIVED', 'ACCOUNTED')
        AND cc.collection_date >= pcr.opening_balance_date
    ), 0)
    -- Money received from CO
    + COALESCE((
      SELECT SUM(mr.amount)
      FROM money_received mr
      WHERE mr.property_id = pcr.property_id
        AND mr.status IN ('RECEIVED', 'ACCOUNTED')
        AND mr.sent_date >= pcr.opening_balance_date
    ), 0)
    -- In-transit arriving TO this property
    + COALESCE((
      SELECT SUM(it.total_amount)
      FROM in_transits it
      WHERE it.destination_type = 'PROPERTY_CASH'
        AND it.destination_id = pcr.property_id
        AND it.status = 'CLOSED'
        AND it.start_date_time::date >= pcr.opening_balance_date
    ), 0)
    -- In-transit leaving FROM this property
    - COALESCE((
      SELECT SUM(its.amount)
      FROM in_transit_sources its
      JOIN in_transits it ON it.id = its.in_transit_id
      WHERE its.source_type = 'PROPERTY_CASH'
        AND its.source_id = pcr.property_id
        AND it.status = 'CLOSED'
        AND it.start_date_time::date >= pcr.opening_balance_date
    ), 0)
  AS current_balance
FROM property_cash_registers pcr;

-- Auto-create cash registers for existing properties
INSERT INTO property_cash_registers (property_id, name, opening_balance, opening_balance_date)
SELECT p.id, 'Каса ' || p.name, 0, CURRENT_DATE
FROM properties p
WHERE NOT EXISTS (
  SELECT 1 FROM property_cash_registers pcr WHERE pcr.property_id = p.id
);

NOTIFY pgrst, 'reload schema';

-- Riverside cash register

