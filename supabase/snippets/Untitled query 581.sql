-- 1. Bank transactions за платени разходи (само тези с BANK_TRANSFER)
INSERT INTO bank_transactions (
  bank_account_id, transaction_date, direction, amount,
  counterparty, description, type, property_id, expense_id, created_by_id
)
SELECT
  ba.id,
  COALESCE(e.paid_at, e.issue_date),
  'OUT',
  e.amount_net + e.vat_amount,
  e.supplier,
  'Плащане по фактура ' || COALESCE(e.document_number, ''),
  'OUT_INVOICE',
  e.property_id,
  e.id,
  e.created_by_id
FROM expenses e
JOIN bank_accounts ba ON ba.name = e.paid_from_cash
WHERE e.status = 'PAID'
  AND e.payment_method = 'BANK_TRANSFER'
  AND (e.amount_net + e.vat_amount) > 0;

-- 2. Bank transactions за приходи с банкова сметка
INSERT INTO bank_transactions (
  bank_account_id, transaction_date, direction, amount,
  counterparty, description, type, property_id, created_by_id
)
SELECT
  ie.bank_account_id,
  ie.entry_date,
  'IN',
  ie.amount,
  ie.payer,
  COALESCE(ie.description, 'Приход'),
  'IN_OTHER',
  ie.property_id,
  ie.created_by_id
FROM income_entries ie
WHERE ie.bank_account_id IS NOT NULL
  AND ie.amount > 0;

-- 3. Провери оборотите по сметки
SELECT name, currency, total_income, total_expense, current_balance
FROM bank_account_balances
ORDER BY name;