-- Hotel Finance System — Core Tables
-- Phase 1: Foundation migration

-- ============================================================
-- 1. USER PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. PROPERTIES (Hotels, Shops)
-- ============================================================
CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('HOTEL', 'APARTMENT_HOTEL', 'HOSTEL', 'SHOP', 'OTHER')),
  category text NOT NULL CHECK (category IN ('1_STAR', '2_STAR', '3_STAR', '4_STAR', '5_STAR', 'NONE')),
  city text NOT NULL,
  address text NOT NULL,
  phone text,
  email text,
  eik text NOT NULL UNIQUE CHECK (eik ~ '^\d{9}$'),
  vat_number text,
  mol text NOT NULL,
  iban text,
  bank text,
  manager_id uuid NOT NULL REFERENCES user_profiles(id),
  authorized_person_id uuid REFERENCES user_profiles(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  active_since date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES user_profiles(id)
);

-- ============================================================
-- 3. ACCESS CONTROL JUNCTION TABLES
-- ============================================================
CREATE TABLE user_property_access (
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, property_id)
);

-- ============================================================
-- 4. FISCAL DEVICES
-- ============================================================
CREATE TABLE fiscal_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  serial_number text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. POS TERMINALS
-- ============================================================
CREATE TABLE pos_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tid text NOT NULL,
  bank text NOT NULL,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  manager_id uuid NOT NULL REFERENCES user_profiles(id),
  authorized_person_id uuid REFERENCES user_profiles(id),
  fiscal_device_id uuid REFERENCES fiscal_devices(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, name)
);

CREATE TABLE department_pos_terminals (
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  pos_terminal_id uuid NOT NULL REFERENCES pos_terminals(id) ON DELETE CASCADE,
  PRIMARY KEY (department_id, pos_terminal_id)
);

CREATE TABLE user_department_access (
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, department_id)
);

-- ============================================================
-- 7. PROPERTY CONSOLIDATIONS (must be before daily_reports for FK)
-- ============================================================
CREATE TABLE property_consolidations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  date date NOT NULL,
  manager_id uuid NOT NULL REFERENCES user_profiles(id),
  status text NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN (
    'IN_PROGRESS', 'SENT_TO_CO', 'APPROVED', 'RETURNED', 'CORRECTED'
  )),
  sent_at timestamptz,
  manager_comment text,
  total_cash_net decimal(12,2) NOT NULL DEFAULT 0,
  total_pos_net decimal(12,2) NOT NULL DEFAULT 0,
  total_z_report decimal(12,2) NOT NULL DEFAULT 0,
  total_diff decimal(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, date)
);

CREATE INDEX idx_consolidations_status ON property_consolidations (status);

-- ============================================================
-- 8. DAILY REPORTS
-- ============================================================
CREATE TABLE daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  date date NOT NULL,
  created_by_id uuid NOT NULL REFERENCES user_profiles(id),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'SUBMITTED', 'CONFIRMED', 'RETURNED', 'SENT_TO_CO', 'APPROVED', 'CORRECTED'
  )),
  submitted_at timestamptz,
  confirmed_by_id uuid REFERENCES user_profiles(id),
  confirmed_at timestamptz,
  approved_by_id uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  co_comment text,
  manager_comment text,
  total_cash_net decimal(12,2) NOT NULL DEFAULT 0,
  total_pos_net decimal(12,2) NOT NULL DEFAULT 0,
  cash_diff decimal(12,2) NOT NULL DEFAULT 0,
  pos_diff decimal(12,2) NOT NULL DEFAULT 0,
  total_diff decimal(12,2) NOT NULL DEFAULT 0,
  diff_explanation text,
  consolidation_id uuid REFERENCES property_consolidations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, date)
);

CREATE INDEX idx_daily_reports_property_date ON daily_reports (property_id, date);
CREATE INDEX idx_daily_reports_status ON daily_reports (status);
CREATE INDEX idx_daily_reports_consolidation ON daily_reports (consolidation_id)
  WHERE consolidation_id IS NOT NULL;

-- ============================================================
-- 9. DAILY REPORT LINES (cash income per department)
-- ============================================================
CREATE TABLE daily_report_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id),
  cash_income decimal(12,2) NOT NULL DEFAULT 0 CHECK (cash_income >= 0),
  cash_return decimal(12,2) NOT NULL DEFAULT 0 CHECK (cash_return >= 0),
  cash_net decimal(12,2) NOT NULL GENERATED ALWAYS AS (cash_income - cash_return) STORED,
  UNIQUE (daily_report_id, department_id)
);

-- ============================================================
-- 10. POS ENTRIES
-- ============================================================
CREATE TABLE pos_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  pos_terminal_id uuid NOT NULL REFERENCES pos_terminals(id),
  amount decimal(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  return_amount decimal(12,2) NOT NULL DEFAULT 0 CHECK (return_amount >= 0),
  net_amount decimal(12,2) NOT NULL GENERATED ALWAYS AS (amount - return_amount) STORED,
  UNIQUE (daily_report_id, pos_terminal_id)
);

-- ============================================================
-- 11. Z-REPORTS (1:1 with daily_report)
-- ============================================================
CREATE TABLE z_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL UNIQUE REFERENCES daily_reports(id) ON DELETE CASCADE,
  cash_amount decimal(12,2) NOT NULL DEFAULT 0,
  pos_amount decimal(12,2) NOT NULL DEFAULT 0,
  total_amount decimal(12,2) NOT NULL GENERATED ALWAYS AS (cash_amount + pos_amount) STORED,
  attachment_url text NOT NULL,
  additional_files text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 12. BANK ACCOUNTS
-- ============================================================
CREATE TABLE bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  iban text NOT NULL UNIQUE,
  bank text NOT NULL,
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency IN ('BGN', 'EUR', 'USD')),
  account_type text NOT NULL CHECK (account_type IN (
    'CURRENT', 'SAVINGS', 'CREDIT', 'DEPOSIT'
  )),
  opening_balance decimal(14,2) NOT NULL DEFAULT 0,
  opening_balance_date date NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 13. LOANS
-- ============================================================
CREATE TABLE loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bank text NOT NULL,
  principal_amount decimal(14,2) NOT NULL,
  disbursed_amount decimal(14,2) NOT NULL DEFAULT 0,
  interest_rate decimal(5,2) NOT NULL,
  monthly_payment decimal(14,2) NOT NULL,
  payment_day int NOT NULL CHECK (payment_day BETWEEN 1 AND 31),
  first_payment_date date NOT NULL,
  last_payment_date date NOT NULL,
  collateral text,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 14. REVOLVING CREDITS
-- ============================================================
CREATE TABLE revolving_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bank text NOT NULL,
  credit_limit decimal(14,2) NOT NULL,
  interest_rate decimal(5,2) NOT NULL,
  commitment_fee decimal(5,4),
  open_date date NOT NULL,
  expiry_date date,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 15. CO CASH
-- ============================================================
CREATE TABLE co_cash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  opening_balance decimal(14,2) NOT NULL DEFAULT 0,
  opening_balance_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 16. EXPENSES
-- ============================================================
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  department_id uuid NOT NULL REFERENCES departments(id),
  category text NOT NULL CHECK (category IN (
    'CONSUMABLES', 'SALARIES', 'FOOD_KITCHEN', 'FUEL', 'TAXES_FEES',
    'MAINTENANCE', 'UTILITIES', 'MARKETING', 'INSURANCE', 'ACCOUNTING', 'OTHER'
  )),
  supplier text NOT NULL,
  supplier_eik text,
  document_type text NOT NULL CHECK (document_type IN (
    'INVOICE', 'EXPENSE_ORDER', 'RECEIPT', 'NO_DOCUMENT'
  )),
  document_number text,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  amount_net decimal(12,2) NOT NULL,
  vat_amount decimal(12,2) NOT NULL DEFAULT 0,
  total_amount decimal(12,2) NOT NULL GENERATED ALWAYS AS (amount_net + vat_amount) STORED,
  payment_method text NOT NULL CHECK (payment_method IN (
    'BANK_TRANSFER', 'CASH', 'CARD', 'OTHER'
  )),
  paid_at date,
  paid_from_cash text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'UNPAID', 'SENT_TO_CO', 'APPROVED', 'PARTIAL', 'PAID', 'OVERDUE', 'REJECTED'
  )),
  paid_amount decimal(12,2) NOT NULL DEFAULT 0,
  remaining_amount decimal(12,2) NOT NULL GENERATED ALWAYS AS (
    amount_net + vat_amount - paid_amount
  ) STORED,
  attachment_url text,
  note text,
  created_by_id uuid NOT NULL REFERENCES user_profiles(id),
  approved_by_id uuid REFERENCES user_profiles(id),
  paid_by_id uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_property_status ON expenses (property_id, status);
CREATE INDEX idx_expenses_due_date ON expenses (due_date)
  WHERE status IN ('UNPAID', 'SENT_TO_CO');

-- ============================================================
-- 17. BANK TRANSACTIONS
-- ============================================================
CREATE TABLE bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id),
  transaction_date date NOT NULL,
  direction text NOT NULL CHECK (direction IN ('IN', 'OUT')),
  amount decimal(14,2) NOT NULL CHECK (amount > 0),
  counterparty text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN (
    'IN_HOTEL', 'IN_POS', 'IN_OTHER',
    'OUT_INVOICE', 'OUT_CREDIT', 'OUT_REVOLV', 'OUT_SALARY',
    'OUT_TAX', 'OUT_RENT', 'OUT_TRANSFER',
    'INTER_BANK'
  )),
  property_id uuid REFERENCES properties(id),
  loan_id uuid REFERENCES loans(id),
  expense_id uuid REFERENCES expenses(id),
  attachment_url text,
  note text,
  created_by_id uuid NOT NULL REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_tx_account_date ON bank_transactions (bank_account_id, transaction_date);
CREATE INDEX idx_bank_tx_type ON bank_transactions (type);

-- ============================================================
-- 18. CASH COLLECTIONS
-- ============================================================
CREATE TABLE cash_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  collection_date date NOT NULL,
  amount decimal(12,2) NOT NULL,
  collected_by_id uuid NOT NULL REFERENCES user_profiles(id),
  covers_date_from date NOT NULL,
  covers_date_to date NOT NULL,
  note text,
  attachment_url text,
  status text NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'RECEIVED', 'ACCOUNTED')),
  confirmed_by_id uuid REFERENCES user_profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_collections_property ON cash_collections (property_id, collection_date);

-- ============================================================
-- 19. MONEY RECEIVED (CO → Property)
-- ============================================================
CREATE TABLE money_received (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  amount decimal(12,2) NOT NULL,
  sent_date date NOT NULL,
  sent_by_id uuid NOT NULL REFERENCES user_profiles(id),
  purpose text NOT NULL CHECK (purpose IN (
    'OPERATIONAL', 'SALARIES', 'CASH_SUPPLY', 'SPECIFIC_GOAL', 'ADVANCE'
  )),
  purpose_description text,
  source_type text NOT NULL CHECK (source_type IN (
    'BANK_ACCOUNT', 'CO_CASH', 'OTHER_PROPERTY', 'OTHER'
  )),
  source_bank_account_id uuid REFERENCES bank_accounts(id),
  source_property_id uuid REFERENCES properties(id),
  delivery_method text NOT NULL CHECK (delivery_method IN (
    'IN_PERSON', 'COURIER', 'BANK_TRANSFER'
  )),
  delivered_by text,
  attachment_url text,
  status text NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'RECEIVED', 'ACCOUNTED')),
  received_by_id uuid REFERENCES user_profiles(id),
  received_at timestamptz,
  received_in_cash text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_money_received_property ON money_received (property_id, sent_date);
CREATE INDEX idx_money_received_advance ON money_received (status, purpose)
  WHERE purpose = 'ADVANCE' AND status != 'ACCOUNTED';

-- ============================================================
-- 20. WITHDRAWALS
-- ============================================================
CREATE TABLE withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  cash_register text NOT NULL,
  withdrawal_date timestamptz NOT NULL DEFAULT now(),
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  withdrawn_by text NOT NULL,
  authorized_by_id uuid NOT NULL REFERENCES user_profiles(id),
  purpose text NOT NULL CHECK (purpose IN (
    'PAY_EXP', 'PAY_SAL', 'ADV_EMP', 'ADV_OPS',
    'BANK_IN', 'CASH_TRANS', 'CO_COLLECT', 'OTHER'
  )),
  description text,
  expense_id uuid REFERENCES expenses(id),
  employee_id uuid REFERENCES user_profiles(id),
  target_cash text,
  bank_account_id uuid REFERENCES bank_accounts(id),
  attachment_url text,
  status text NOT NULL DEFAULT 'RECORDED' CHECK (status IN (
    'RECORDED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
    'ACCOUNTED', 'UNACCOUNTED_ADVANCE'
  )),
  accounted_date date,
  accounted_amount decimal(12,2),
  returned_amount decimal(12,2) GENERATED ALWAYS AS (
    CASE WHEN accounted_amount IS NOT NULL THEN amount - accounted_amount ELSE NULL END
  ) STORED,
  co_approved_by_id uuid REFERENCES user_profiles(id),
  note text,
  is_void boolean NOT NULL DEFAULT false,
  void_reason text,
  void_by_id uuid REFERENCES user_profiles(id),
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_withdrawals_property_date ON withdrawals (property_id, withdrawal_date);
CREATE INDEX idx_withdrawals_unaccounted ON withdrawals (status, withdrawal_date)
  WHERE status = 'UNACCOUNTED_ADVANCE';
CREATE INDEX idx_withdrawals_pending ON withdrawals (status)
  WHERE status = 'PENDING_APPROVAL';

-- ============================================================
-- 21. WITHDRAWAL THRESHOLDS (configurable per property)
-- ============================================================
CREATE TABLE withdrawal_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('DEPT_HEAD', 'MANAGER')),
  auto_approve_limit decimal(12,2) NOT NULL,
  co_approval_limit decimal(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, role)
);

-- ============================================================
-- 22. IN-TRANSIT (money in movement)
-- ============================================================
CREATE TABLE in_transits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carried_by_id uuid NOT NULL REFERENCES user_profiles(id),
  start_date_time timestamptz NOT NULL DEFAULT now(),
  total_amount decimal(14,2) NOT NULL CHECK (total_amount > 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency IN ('BGN', 'EUR', 'USD')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN (
    'OPEN', 'PARTIALLY_CLOSED', 'CLOSED'
  )),
  remaining_amount decimal(14,2) NOT NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rule #8: only one open in-transit per person
CREATE UNIQUE INDEX idx_in_transit_one_open_per_person
  ON in_transits (carried_by_id) WHERE status IN ('OPEN', 'PARTIALLY_CLOSED');

-- ============================================================
-- 23. IN-TRANSIT SOURCES
-- ============================================================
CREATE TABLE in_transit_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  in_transit_id uuid NOT NULL REFERENCES in_transits(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN (
    'BANK_ACCOUNT', 'PROPERTY_CASH', 'CO_CASH'
  )),
  source_id uuid NOT NULL,
  amount decimal(14,2) NOT NULL CHECK (amount > 0),
  withdrawal_id uuid REFERENCES withdrawals(id)
);

-- ============================================================
-- 24. TRANSACTION CHAINS
-- ============================================================
CREATE TABLE transaction_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  chain_date date NOT NULL,
  initiated_by_id uuid NOT NULL REFERENCES user_profiles(id),
  description text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  in_transit_id uuid REFERENCES in_transits(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 25. TRANSACTION CHAIN STEPS
-- ============================================================
CREATE TABLE transaction_chain_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES transaction_chains(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  module_type text NOT NULL CHECK (module_type IN (
    'BankTransaction', 'Withdrawal', 'Expense', 'CashCollection',
    'MoneyReceived', 'IncomeEntry'
  )),
  module_id uuid NOT NULL,
  description text,
  UNIQUE (chain_id, step_order),
  UNIQUE (module_type, module_id)
);

CREATE INDEX idx_chain_steps_module ON transaction_chain_steps (module_type, module_id);

-- ============================================================
-- 26. INCOME ENTRIES
-- ============================================================
CREATE TABLE income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL,
  property_id uuid NOT NULL REFERENCES properties(id),
  type text NOT NULL CHECK (type IN (
    'INC_BANK', 'INC_CASH', 'INC_ADV', 'INC_DEP', 'INC_OTHER',
    'CF_CREDIT', 'CF_TRANSFER'
  )),
  amount decimal(14,2) NOT NULL,
  bank_account_id uuid REFERENCES bank_accounts(id),
  payment_method text NOT NULL CHECK (payment_method IN ('BANK', 'CASH')),
  payer text NOT NULL,
  description text,
  period_from date,
  period_to date,
  loan_id uuid REFERENCES loans(id),
  attachment_url text,
  income_category text CHECK (income_category IN (
    'ACCOMMODATION', 'FB', 'SPA', 'FEES', 'COMMISSIONS', 'OTHER'
  )),
  is_advance_realized boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ENTERED' CHECK (status IN (
    'ENTERED', 'CONFIRMED', 'ADVANCE', 'REALIZED'
  )),
  created_by_id uuid NOT NULL REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_income_category CHECK (
    type NOT IN ('INC_BANK','INC_CASH','INC_ADV','INC_DEP','INC_OTHER')
    OR income_category IS NOT NULL
  ),
  CONSTRAINT chk_credit_loan CHECK (
    type != 'CF_CREDIT' OR loan_id IS NOT NULL
  )
);

CREATE INDEX idx_income_entries_property_date ON income_entries (property_id, entry_date);
CREATE INDEX idx_income_entries_type ON income_entries (type);
CREATE INDEX idx_income_entries_pl ON income_entries (property_id, entry_date)
  WHERE type NOT IN ('CF_CREDIT', 'CF_TRANSFER');
CREATE INDEX idx_income_entries_advances ON income_entries (status)
  WHERE type = 'INC_ADV' AND status = 'ADVANCE';

-- ============================================================
-- 27. AUDIT LOG
-- ============================================================
-- changed_fields JSON schema:
--   CREATE:        { "field": { "old": null, "new": value } }
--   UPDATE:        { "field": { "old": previous, "new": current } }
--   STATUS_CHANGE: { "status": { "old": "DRAFT", "new": "SUBMITTED" } }
--   VOID:          { "void_reason": { "old": null, "new": "reason" } }
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'VOID')),
  changed_fields jsonb NOT NULL DEFAULT '{}',
  user_id uuid NOT NULL REFERENCES user_profiles(id),
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, created_at);
CREATE INDEX idx_audit_user ON audit_logs (user_id, created_at);

-- ============================================================
-- 28. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES user_profiles(id),
  type text NOT NULL CHECK (type IN (
    'REPORT_LATE', 'CONSOLIDATION_LATE', 'REPORT_HIGH_DIFF',
    'REPORT_RETURNED', 'EXPENSE_SUBMITTED', 'EXPENSE_OVERDUE',
    'WITHDRAWAL_APPROVAL', 'ADVANCE_REMINDER_7D', 'ADVANCE_REMINDER_14D',
    'IN_TRANSIT_24H', 'IN_TRANSIT_72H', 'REVOLVING_80PCT',
    'LOAN_PAYMENT_3D', 'MONEY_RECEIVED_UNCONFIRMED', 'CHAIN_UNCLOSED_48H'
  )),
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  entity_type text,
  entity_id uuid,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  email_sent boolean NOT NULL DEFAULT false,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications (recipient_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (recipient_id, created_at DESC)
  WHERE is_read = false;

-- ============================================================
-- UPDATED_AT TRIGGER (auto-update on all tables with updated_at)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_profiles', 'properties', 'departments',
    'daily_reports', 'property_consolidations',
    'expenses', 'cash_collections', 'money_received',
    'bank_accounts', 'loans', 'revolving_credits', 'co_cash',
    'withdrawals', 'in_transits', 'transaction_chains',
    'income_entries'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;
