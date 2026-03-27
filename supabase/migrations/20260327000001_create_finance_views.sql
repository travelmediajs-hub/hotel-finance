-- Hotel Finance System — Calculated Views

-- ============================================================
-- V1. BANK ACCOUNT BALANCES
-- ============================================================
CREATE VIEW bank_account_balances AS
SELECT
  ba.id,
  ba.name,
  ba.iban,
  ba.currency,
  ba.status,
  COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'IN'), 0) AS total_income,
  COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'OUT'), 0) AS total_expense,
  ba.opening_balance
    + COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'IN'), 0)
    - COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'OUT'), 0) AS current_balance
FROM bank_accounts ba
LEFT JOIN bank_transactions bt ON bt.bank_account_id = ba.id
GROUP BY ba.id;

-- ============================================================
-- V2. REVOLVING CREDIT BALANCES
-- ============================================================
CREATE VIEW revolving_credit_balances AS
SELECT
  rc.id,
  rc.name,
  rc.credit_limit,
  rc.interest_rate,
  COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'OUT' AND bt.type = 'OUT_REVOLV'), 0)
    - COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'IN' AND bt.type = 'OUT_REVOLV'), 0)
    AS used_amount,
  rc.credit_limit - (
    COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'OUT' AND bt.type = 'OUT_REVOLV'), 0)
    - COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'IN' AND bt.type = 'OUT_REVOLV'), 0)
  ) AS available_limit,
  (COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'OUT' AND bt.type = 'OUT_REVOLV'), 0)
    - COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'IN' AND bt.type = 'OUT_REVOLV'), 0)
  ) * rc.interest_rate / 100.0 / 12.0 AS estimated_monthly_interest
FROM revolving_credits rc
LEFT JOIN bank_transactions bt ON bt.bank_account_id = rc.bank_account_id
GROUP BY rc.id;

-- ============================================================
-- V3. LOAN BALANCES
-- ============================================================
CREATE VIEW loan_balances AS
SELECT
  l.id,
  l.name,
  l.principal_amount,
  l.monthly_payment,
  l.payment_day,
  l.last_payment_date,
  l.status,
  COALESCE(SUM(bt.amount) FILTER (WHERE bt.type = 'OUT_CREDIT'), 0) AS paid_principal,
  l.principal_amount
    - COALESCE(SUM(bt.amount) FILTER (WHERE bt.type = 'OUT_CREDIT'), 0) AS remaining_principal,
  CASE WHEN l.monthly_payment > 0 THEN
    CEIL((l.principal_amount - COALESCE(SUM(bt.amount) FILTER (WHERE bt.type = 'OUT_CREDIT'), 0))
         / l.monthly_payment)::int
  ELSE 0 END AS remaining_payments,
  CASE WHEN l.status = 'ACTIVE' THEN
    CASE WHEN EXTRACT(DAY FROM CURRENT_DATE) < l.payment_day
      THEN DATE_TRUNC('month', CURRENT_DATE) + (l.payment_day - 1) * INTERVAL '1 day'
      ELSE DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + (l.payment_day - 1) * INTERVAL '1 day'
    END
  END AS next_payment_date,
  CASE WHEN l.status = 'ACTIVE' THEN l.monthly_payment END AS next_payment_amount
FROM loans l
LEFT JOIN bank_transactions bt ON bt.loan_id = l.id
GROUP BY l.id;

-- ============================================================
-- V4. CO CASH BALANCES (dynamic from movements)
-- ============================================================
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
    AS current_balance
FROM co_cash cc;

-- ============================================================
-- V5. NET CASH POSITION
-- ============================================================
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
