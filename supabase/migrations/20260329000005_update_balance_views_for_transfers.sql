-- Update co_cash_balances to include in-transit transfers
-- Also fix: filter by cc.id (was missing before)
DROP VIEW IF EXISTS net_cash_position;
DROP VIEW IF EXISTS co_cash_balances;

CREATE VIEW co_cash_balances AS
SELECT
  cc.id,
  cc.name,
  cc.opening_balance,
  cc.opening_balance
    + COALESCE((SELECT SUM(amount) FROM cash_collections
                WHERE status = 'ACCOUNTED'), 0)
    - COALESCE((SELECT SUM(amount) FROM money_received
                WHERE source_type = 'CO_CASH' AND status IN ('SENT', 'RECEIVED', 'ACCOUNTED')), 0)
    -- In-transit: money arriving TO this co_cash
    + COALESCE((SELECT SUM(total_amount) FROM in_transits
                WHERE destination_type = 'CO_CASH'
                  AND destination_id = cc.id
                  AND status = 'CLOSED'), 0)
    -- In-transit: money leaving FROM this co_cash
    - COALESCE((SELECT SUM(its.amount) FROM in_transit_sources its
                JOIN in_transits it ON it.id = its.in_transit_id
                WHERE its.source_type = 'CO_CASH'
                  AND its.source_id = cc.id
                  AND it.status = 'CLOSED'), 0)
    AS current_balance
FROM co_cash cc;

-- Recreate net_cash_position (depends on co_cash_balances)
CREATE VIEW net_cash_position AS
SELECT
  (SELECT COALESCE(SUM(current_balance), 0) FROM bank_account_balances) AS total_bank_balance,
  (SELECT COALESCE(SUM(current_balance), 0) FROM co_cash_balances) AS co_cash_balance,
  (SELECT COALESCE(SUM(dr.total_cash_net), 0)
   FROM daily_reports dr
   WHERE dr.status IN ('APPROVED', 'CORRECTED')
     AND dr.date >= CURRENT_DATE - INTERVAL '30 days') AS property_cash_estimate,
  (SELECT COALESCE(SUM(e.remaining_amount), 0)
   FROM expenses e
   WHERE e.status IN ('UNPAID', 'SENT_TO_CO')) AS unpaid_obligations,
  (SELECT COALESCE(SUM(lb.next_payment_amount), 0)
   FROM loan_balances lb
   WHERE lb.next_payment_date IS NOT NULL
     AND lb.next_payment_date <= CURRENT_DATE + INTERVAL '30 days') AS loan_payments_30d;

NOTIFY pgrst, 'reload schema';
