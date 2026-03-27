# Phase 1: Database Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create all database migrations, TypeScript types, and Zod validation schemas for the hotel finance system (30 tables + 5 views + RLS policies).

**Architecture:** Single Supabase migration file containing all tables in dependency order. TypeScript types in `types/finance.ts` mirroring DB schema. Zod schemas in `lib/finance/schemas/` for runtime validation of API inputs. No frontend code in this phase.

**Tech Stack:** PostgreSQL (Supabase), TypeScript, Zod

---

## File Structure

```
supabase/migrations/
  20260327000000_create_finance_tables.sql       # All 30 tables + indexes
  20260327000001_create_finance_views.sql         # 5 calculated views
  20260327000002_create_finance_rls.sql           # RLS policies + helper functions

types/
  finance.ts                                      # All TypeScript interfaces/enums

lib/finance/
  schemas/
    property.ts                                   # Property, Department, FiscalDevice, POSTerminal
    daily-report.ts                               # DailyReport, DailyReportLine, POSEntry, ZReport
    consolidation.ts                              # PropertyConsolidation
    expense.ts                                    # Expense
    cash-flow.ts                                  # CashCollection, MoneyReceived
    banking.ts                                    # BankAccount, BankTransaction, Loan, RevolvingCredit
    withdrawal.ts                                 # Withdrawal
    in-transit.ts                                 # InTransit, TransactionChain
    income.ts                                     # IncomeEntry
    index.ts                                      # Re-exports all schemas
```

---

### Task 1: Install Zod dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zod**

```bash
npm install zod
```

- [ ] **Step 2: Verify installation**

Run: `node -e "require('zod')"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zod dependency for runtime validation"
```

---

### Task 2: Core tables migration — Users, Properties, Departments

**Files:**
- Create: `supabase/migrations/20260327000000_create_finance_tables.sql`

- [ ] **Step 1: Create the migration file with core tables**

Write to `supabase/migrations/20260327000000_create_finance_tables.sql`:

```sql
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
```

- [ ] **Step 2: Verify SQL syntax**

Run: `cat supabase/migrations/20260327000000_create_finance_tables.sql | head -5`
Expected: First 5 lines of the migration file

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260327000000_create_finance_tables.sql
git commit -m "feat: add finance tables migration (30 tables)"
```

---

### Task 3: Views migration

**Files:**
- Create: `supabase/migrations/20260327000001_create_finance_views.sql`

- [ ] **Step 1: Create the views migration**

Write to `supabase/migrations/20260327000001_create_finance_views.sql`:

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260327000001_create_finance_views.sql
git commit -m "feat: add finance calculated views (5 views)"
```

---

### Task 4: RLS policies migration

**Files:**
- Create: `supabase/migrations/20260327000002_create_finance_rls.sql`

- [ ] **Step 1: Create the RLS migration**

Write to `supabase/migrations/20260327000002_create_finance_rls.sql`:

```sql
-- Hotel Finance System — Row-Level Security Policies

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.has_property_access(prop_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_property_access
    WHERE user_id = auth.uid() AND property_id = prop_id
  ) OR auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.has_department_access(dept_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_department_access
    WHERE user_id = auth.uid() AND department_id = dept_id
  )
  OR auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
  OR (auth.user_role() = 'MANAGER' AND EXISTS (
    SELECT 1 FROM departments d
    JOIN user_property_access upa ON upa.property_id = d.property_id
    WHERE d.id = dept_id AND upa.user_id = auth.uid()
  ))
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE z_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_consolidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE revolving_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER PROFILES: users see own profile, CO sees all
-- ============================================================
CREATE POLICY user_profiles_select ON user_profiles FOR SELECT
  USING (id = auth.uid() OR auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));
CREATE POLICY user_profiles_update ON user_profiles FOR UPDATE
  USING (id = auth.uid() OR auth.user_role() = 'ADMIN_CO');

-- ============================================================
-- PROPERTIES: scoped by user_property_access, CO sees all
-- ============================================================
CREATE POLICY properties_select ON properties FOR SELECT
  USING (auth.has_property_access(id));
CREATE POLICY properties_insert ON properties FOR INSERT
  WITH CHECK (auth.user_role() = 'ADMIN_CO');
CREATE POLICY properties_update ON properties FOR UPDATE
  USING (auth.user_role() = 'ADMIN_CO');

-- ============================================================
-- DEPARTMENTS: scoped by property access
-- ============================================================
CREATE POLICY departments_select ON departments FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY departments_insert ON departments FOR INSERT
  WITH CHECK (auth.user_role() = 'ADMIN_CO');
CREATE POLICY departments_update ON departments FOR UPDATE
  USING (auth.user_role() = 'ADMIN_CO');

-- ============================================================
-- FISCAL DEVICES & POS TERMINALS: follow property access
-- ============================================================
CREATE POLICY fiscal_devices_select ON fiscal_devices FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY fiscal_devices_manage ON fiscal_devices FOR ALL
  USING (auth.user_role() = 'ADMIN_CO');

CREATE POLICY pos_terminals_select ON pos_terminals FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY pos_terminals_manage ON pos_terminals FOR ALL
  USING (auth.user_role() = 'ADMIN_CO');

-- ============================================================
-- DAILY REPORTS: dept heads create, managers/CO see by property
-- ============================================================
CREATE POLICY daily_reports_select ON daily_reports FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY daily_reports_insert ON daily_reports FOR INSERT
  WITH CHECK (auth.has_department_access(department_id) AND auth.user_role() = 'DEPT_HEAD');
CREATE POLICY daily_reports_update ON daily_reports FOR UPDATE
  USING (auth.has_property_access(property_id));

-- Detail tables follow parent daily_report access
CREATE POLICY daily_report_lines_all ON daily_report_lines FOR ALL
  USING (EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_id AND auth.has_property_access(dr.property_id)
  ));

CREATE POLICY pos_entries_all ON pos_entries FOR ALL
  USING (EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_id AND auth.has_property_access(dr.property_id)
  ));

CREATE POLICY z_reports_all ON z_reports FOR ALL
  USING (EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_id AND auth.has_property_access(dr.property_id)
  ));

-- ============================================================
-- CONSOLIDATIONS: managers see own property, CO sees all
-- ============================================================
CREATE POLICY consolidations_select ON property_consolidations FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY consolidations_manage ON property_consolidations FOR ALL
  USING (auth.has_property_access(property_id)
    AND auth.user_role() IN ('MANAGER', 'ADMIN_CO', 'FINANCE_CO'));

-- ============================================================
-- EXPENSES: managers create for own property, CO manages
-- ============================================================
CREATE POLICY expenses_select ON expenses FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY expenses_insert ON expenses FOR INSERT
  WITH CHECK (auth.has_property_access(property_id) AND auth.user_role() = 'MANAGER');
CREATE POLICY expenses_update ON expenses FOR UPDATE
  USING (auth.has_property_access(property_id));

-- ============================================================
-- CASH COLLECTIONS: CO creates, managers confirm
-- ============================================================
CREATE POLICY cash_collections_select ON cash_collections FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY cash_collections_insert ON cash_collections FOR INSERT
  WITH CHECK (auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));
CREATE POLICY cash_collections_update ON cash_collections FOR UPDATE
  USING (auth.has_property_access(property_id));

-- ============================================================
-- MONEY RECEIVED: CO creates, managers confirm
-- ============================================================
CREATE POLICY money_received_select ON money_received FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY money_received_insert ON money_received FOR INSERT
  WITH CHECK (auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));
CREATE POLICY money_received_update ON money_received FOR UPDATE
  USING (auth.has_property_access(property_id));

-- ============================================================
-- WITHDRAWALS: property staff creates, CO approves
-- ============================================================
CREATE POLICY withdrawals_select ON withdrawals FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY withdrawals_insert ON withdrawals FOR INSERT
  WITH CHECK (auth.has_property_access(property_id));
CREATE POLICY withdrawals_update ON withdrawals FOR UPDATE
  USING (auth.has_property_access(property_id));

-- ============================================================
-- BANK TABLES: CO only
-- ============================================================
CREATE POLICY bank_accounts_co ON bank_accounts FOR ALL
  USING (auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));
CREATE POLICY bank_transactions_co ON bank_transactions FOR ALL
  USING (auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));
CREATE POLICY loans_co ON loans FOR ALL
  USING (auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));
CREATE POLICY revolving_credits_co ON revolving_credits FOR ALL
  USING (auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));
CREATE POLICY income_entries_co ON income_entries FOR ALL
  USING (auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));

-- ============================================================
-- AUDIT LOGS: CO sees all, others see logs for their entities
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_co ON audit_logs FOR SELECT
  USING (auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (true); -- app inserts on behalf of users

-- ============================================================
-- NOTIFICATIONS: users see only their own
-- ============================================================
CREATE POLICY notifications_own ON notifications FOR SELECT
  USING (recipient_id = auth.uid());
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (recipient_id = auth.uid());
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260327000002_create_finance_rls.sql
git commit -m "feat: add finance RLS policies and helper functions"
```

---

### Task 5: TypeScript types

**Files:**
- Create: `types/finance.ts`

- [ ] **Step 1: Create all TypeScript enums and interfaces**

Write to `types/finance.ts`:

```typescript
// types/finance.ts
// All types for the hotel finance system, mirroring the database schema.

// ============================================================
// ENUMS
// ============================================================

export type UserRole = 'ADMIN_CO' | 'FINANCE_CO' | 'MANAGER' | 'DEPT_HEAD'

export type PropertyType = 'HOTEL' | 'APARTMENT_HOTEL' | 'HOSTEL' | 'SHOP' | 'OTHER'
export type PropertyCategory = '1_STAR' | '2_STAR' | '3_STAR' | '4_STAR' | '5_STAR' | 'NONE'
export type ActiveStatus = 'ACTIVE' | 'INACTIVE'

export type DailyReportStatus =
  | 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'RETURNED'
  | 'SENT_TO_CO' | 'APPROVED' | 'CORRECTED'

export type ConsolidationStatus =
  | 'IN_PROGRESS' | 'SENT_TO_CO' | 'APPROVED' | 'RETURNED' | 'CORRECTED'

export type ExpenseCategory =
  | 'CONSUMABLES' | 'SALARIES' | 'FOOD_KITCHEN' | 'FUEL' | 'TAXES_FEES'
  | 'MAINTENANCE' | 'UTILITIES' | 'MARKETING' | 'INSURANCE' | 'ACCOUNTING' | 'OTHER'

export type DocumentType = 'INVOICE' | 'EXPENSE_ORDER' | 'RECEIPT' | 'NO_DOCUMENT'

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CARD' | 'OTHER'

export type ExpenseStatus =
  | 'DRAFT' | 'UNPAID' | 'SENT_TO_CO' | 'APPROVED'
  | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'REJECTED'

export type CashCollectionStatus = 'SENT' | 'RECEIVED' | 'ACCOUNTED'

export type MoneyReceivedPurpose =
  | 'OPERATIONAL' | 'SALARIES' | 'CASH_SUPPLY' | 'SPECIFIC_GOAL' | 'ADVANCE'

export type SourceType = 'BANK_ACCOUNT' | 'CO_CASH' | 'OTHER_PROPERTY' | 'OTHER'

export type DeliveryMethod = 'IN_PERSON' | 'COURIER' | 'BANK_TRANSFER'

export type MoneyReceivedStatus = 'SENT' | 'RECEIVED' | 'ACCOUNTED'

export type Currency = 'BGN' | 'EUR' | 'USD'

export type BankAccountType = 'CURRENT' | 'SAVINGS' | 'CREDIT' | 'DEPOSIT'

export type BankTransactionDirection = 'IN' | 'OUT'

export type BankTransactionType =
  | 'IN_HOTEL' | 'IN_POS' | 'IN_OTHER'
  | 'OUT_INVOICE' | 'OUT_CREDIT' | 'OUT_REVOLV' | 'OUT_SALARY'
  | 'OUT_TAX' | 'OUT_RENT' | 'OUT_TRANSFER'
  | 'INTER_BANK'

export type LoanStatus = 'ACTIVE' | 'CLOSED'

export type WithdrawalPurpose =
  | 'PAY_EXP' | 'PAY_SAL' | 'ADV_EMP' | 'ADV_OPS'
  | 'BANK_IN' | 'CASH_TRANS' | 'CO_COLLECT' | 'OTHER'

export type WithdrawalStatus =
  | 'RECORDED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  | 'ACCOUNTED' | 'UNACCOUNTED_ADVANCE'

export type InTransitStatus = 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED'

export type InTransitSourceType = 'BANK_ACCOUNT' | 'PROPERTY_CASH' | 'CO_CASH'

export type ChainModuleType =
  | 'BankTransaction' | 'Withdrawal' | 'Expense'
  | 'CashCollection' | 'MoneyReceived' | 'IncomeEntry'

export type ChainStatus = 'OPEN' | 'CLOSED'

export type IncomeEntryType =
  | 'INC_BANK' | 'INC_CASH' | 'INC_ADV' | 'INC_DEP' | 'INC_OTHER'
  | 'CF_CREDIT' | 'CF_TRANSFER'

export type IncomeCategory =
  | 'ACCOMMODATION' | 'FB' | 'SPA' | 'FEES' | 'COMMISSIONS' | 'OTHER'

export type IncomePaymentMethod = 'BANK' | 'CASH'

export type IncomeEntryStatus = 'ENTERED' | 'CONFIRMED' | 'ADVANCE' | 'REALIZED'

export type AuditAction = 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'VOID'

export type NotificationType =
  | 'REPORT_LATE' | 'CONSOLIDATION_LATE' | 'REPORT_HIGH_DIFF'
  | 'REPORT_RETURNED' | 'EXPENSE_SUBMITTED' | 'EXPENSE_OVERDUE'
  | 'WITHDRAWAL_APPROVAL' | 'ADVANCE_REMINDER_7D' | 'ADVANCE_REMINDER_14D'
  | 'IN_TRANSIT_24H' | 'IN_TRANSIT_72H' | 'REVOLVING_80PCT'
  | 'LOAN_PAYMENT_3D' | 'MONEY_RECEIVED_UNCONFIRMED' | 'CHAIN_UNCLOSED_48H'

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

// ============================================================
// INTERFACES
// ============================================================

export interface UserProfile {
  id: string
  full_name: string
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Property {
  id: string
  name: string
  type: PropertyType
  category: PropertyCategory
  city: string
  address: string
  phone: string | null
  email: string | null
  eik: string
  vat_number: string | null
  mol: string
  iban: string | null
  bank: string | null
  manager_id: string
  authorized_person_id: string | null
  status: ActiveStatus
  active_since: string
  created_at: string
  updated_at: string
  created_by: string
}

export interface FiscalDevice {
  id: string
  property_id: string
  serial_number: string
  location: string | null
  status: ActiveStatus
  created_at: string
}

export interface POSTerminal {
  id: string
  property_id: string
  tid: string
  bank: string
  location: string
  status: ActiveStatus
  created_at: string
}

export interface Department {
  id: string
  property_id: string
  name: string
  manager_id: string
  authorized_person_id: string | null
  fiscal_device_id: string | null
  status: ActiveStatus
  created_at: string
  updated_at: string
}

export interface DailyReport {
  id: string
  department_id: string
  property_id: string
  date: string
  created_by_id: string
  status: DailyReportStatus
  submitted_at: string | null
  confirmed_by_id: string | null
  confirmed_at: string | null
  approved_by_id: string | null
  approved_at: string | null
  co_comment: string | null
  manager_comment: string | null
  total_cash_net: number
  total_pos_net: number
  cash_diff: number
  pos_diff: number
  total_diff: number
  diff_explanation: string | null
  consolidation_id: string | null
  created_at: string
  updated_at: string
}

export interface DailyReportLine {
  id: string
  daily_report_id: string
  department_id: string
  cash_income: number
  cash_return: number
  cash_net: number // generated
}

export interface POSEntry {
  id: string
  daily_report_id: string
  pos_terminal_id: string
  amount: number
  return_amount: number
  net_amount: number // generated
}

export interface ZReport {
  id: string
  daily_report_id: string
  cash_amount: number
  pos_amount: number
  total_amount: number // generated
  attachment_url: string
  additional_files: string[]
  created_at: string
}

export interface PropertyConsolidation {
  id: string
  property_id: string
  date: string
  manager_id: string
  status: ConsolidationStatus
  sent_at: string | null
  manager_comment: string | null
  total_cash_net: number
  total_pos_net: number
  total_z_report: number
  total_diff: number
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  property_id: string
  department_id: string
  category: ExpenseCategory
  supplier: string
  supplier_eik: string | null
  document_type: DocumentType
  document_number: string | null
  issue_date: string
  due_date: string
  amount_net: number
  vat_amount: number
  total_amount: number // generated
  payment_method: PaymentMethod
  paid_at: string | null
  paid_from_cash: string | null
  status: ExpenseStatus
  paid_amount: number
  remaining_amount: number // generated
  attachment_url: string | null
  note: string | null
  created_by_id: string
  approved_by_id: string | null
  paid_by_id: string | null
  created_at: string
  updated_at: string
}

export interface CashCollection {
  id: string
  property_id: string
  collection_date: string
  amount: number
  collected_by_id: string
  covers_date_from: string
  covers_date_to: string
  note: string | null
  attachment_url: string | null
  status: CashCollectionStatus
  confirmed_by_id: string | null
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface MoneyReceived {
  id: string
  property_id: string
  amount: number
  sent_date: string
  sent_by_id: string
  purpose: MoneyReceivedPurpose
  purpose_description: string | null
  source_type: SourceType
  source_bank_account_id: string | null
  source_property_id: string | null
  delivery_method: DeliveryMethod
  delivered_by: string | null
  attachment_url: string | null
  status: MoneyReceivedStatus
  received_by_id: string | null
  received_at: string | null
  received_in_cash: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  name: string
  iban: string
  bank: string
  currency: Currency
  account_type: BankAccountType
  opening_balance: number
  opening_balance_date: string
  status: ActiveStatus
  note: string | null
  created_at: string
  updated_at: string
}

export interface BankTransaction {
  id: string
  bank_account_id: string
  transaction_date: string
  direction: BankTransactionDirection
  amount: number
  counterparty: string
  description: string | null
  type: BankTransactionType
  property_id: string | null
  loan_id: string | null
  expense_id: string | null
  attachment_url: string | null
  note: string | null
  created_by_id: string
  created_at: string
}

export interface Loan {
  id: string
  name: string
  bank: string
  principal_amount: number
  disbursed_amount: number
  interest_rate: number
  monthly_payment: number
  payment_day: number
  first_payment_date: string
  last_payment_date: string
  collateral: string | null
  bank_account_id: string
  status: LoanStatus
  created_at: string
  updated_at: string
}

export interface RevolvingCredit {
  id: string
  name: string
  bank: string
  credit_limit: number
  interest_rate: number
  commitment_fee: number | null
  open_date: string
  expiry_date: string | null
  bank_account_id: string
  status: LoanStatus
  created_at: string
  updated_at: string
}

export interface COCash {
  id: string
  name: string
  opening_balance: number
  opening_balance_date: string
  created_at: string
  updated_at: string
}

export interface Withdrawal {
  id: string
  property_id: string
  cash_register: string
  withdrawal_date: string
  amount: number
  withdrawn_by: string
  authorized_by_id: string
  purpose: WithdrawalPurpose
  description: string | null
  expense_id: string | null
  employee_id: string | null
  target_cash: string | null
  bank_account_id: string | null
  attachment_url: string | null
  status: WithdrawalStatus
  accounted_date: string | null
  accounted_amount: number | null
  returned_amount: number | null // generated
  co_approved_by_id: string | null
  note: string | null
  is_void: boolean
  void_reason: string | null
  void_by_id: string | null
  voided_at: string | null
  created_at: string
  updated_at: string
}

export interface WithdrawalThreshold {
  id: string
  property_id: string
  role: 'DEPT_HEAD' | 'MANAGER'
  auto_approve_limit: number
  co_approval_limit: number
  created_at: string
}

export interface InTransit {
  id: string
  carried_by_id: string
  start_date_time: string
  total_amount: number
  currency: Currency
  description: string
  status: InTransitStatus
  remaining_amount: number
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface InTransitSource {
  id: string
  in_transit_id: string
  source_type: InTransitSourceType
  source_id: string
  amount: number
  withdrawal_id: string | null
}

export interface TransactionChain {
  id: string
  name: string
  chain_date: string
  initiated_by_id: string
  description: string | null
  status: ChainStatus
  in_transit_id: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface TransactionChainStep {
  id: string
  chain_id: string
  step_order: number
  module_type: ChainModuleType
  module_id: string
  description: string | null
}

export interface IncomeEntry {
  id: string
  entry_date: string
  property_id: string
  type: IncomeEntryType
  amount: number
  bank_account_id: string | null
  payment_method: IncomePaymentMethod
  payer: string
  description: string | null
  period_from: string | null
  period_to: string | null
  loan_id: string | null
  attachment_url: string | null
  income_category: IncomeCategory | null
  is_advance_realized: boolean
  status: IncomeEntryStatus
  created_by_id: string
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: AuditAction
  changed_fields: Record<string, { old: unknown; new: unknown }>
  user_id: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface Notification {
  id: string
  recipient_id: string
  type: NotificationType
  priority: NotificationPriority
  entity_type: string | null
  entity_id: string | null
  title: string
  body: string | null
  is_read: boolean
  read_at: string | null
  email_sent: boolean
  email_sent_at: string | null
  created_at: string
}

// ============================================================
// VIEW TYPES
// ============================================================

export interface BankAccountBalance {
  id: string
  name: string
  iban: string
  currency: Currency
  status: ActiveStatus
  total_income: number
  total_expense: number
  current_balance: number
}

export interface RevolvingCreditBalance {
  id: string
  name: string
  credit_limit: number
  interest_rate: number
  used_amount: number
  available_limit: number
  estimated_monthly_interest: number
}

export interface LoanBalance {
  id: string
  name: string
  principal_amount: number
  monthly_payment: number
  payment_day: number
  last_payment_date: string
  status: LoanStatus
  paid_principal: number
  remaining_principal: number
  remaining_payments: number
  next_payment_date: string | null
  next_payment_amount: number | null
}

export interface COCashBalance {
  id: string
  name: string
  opening_balance: number
  current_balance: number
}

export interface NetCashPosition {
  total_bank_balance: number
  co_cash_balance: number
  property_cash_estimate: number
  unpaid_obligations: number
  loan_payments_30d: number
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit types/finance.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add types/finance.ts
git commit -m "feat: add TypeScript types for all finance entities and views"
```

---

### Task 6: Zod schemas — Property & config entities

**Files:**
- Create: `lib/finance/schemas/property.ts`

- [ ] **Step 1: Create Zod schemas for property config**

Write to `lib/finance/schemas/property.ts`:

```typescript
import { z } from 'zod'

// ============================================================
// PROPERTY
// ============================================================
export const createPropertySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['HOTEL', 'APARTMENT_HOTEL', 'HOSTEL', 'SHOP', 'OTHER']),
  category: z.enum(['1_STAR', '2_STAR', '3_STAR', '4_STAR', '5_STAR', 'NONE']),
  city: z.string().min(1).max(100),
  address: z.string().min(1).max(300),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  eik: z.string().regex(/^\d{9}$/, 'ЕИК трябва да е 9 цифри'),
  vat_number: z.string().nullable().optional(),
  mol: z.string().min(1).max(200),
  iban: z.string().nullable().optional(),
  bank: z.string().nullable().optional(),
  manager_id: z.string().uuid(),
  authorized_person_id: z.string().uuid().nullable().optional(),
  active_since: z.string().date(),
})

export const updatePropertySchema = createPropertySchema.partial()

// ============================================================
// FISCAL DEVICE
// ============================================================
export const createFiscalDeviceSchema = z.object({
  property_id: z.string().uuid(),
  serial_number: z.string().min(1),
  location: z.string().nullable().optional(),
})

// ============================================================
// POS TERMINAL
// ============================================================
export const createPOSTerminalSchema = z.object({
  property_id: z.string().uuid(),
  tid: z.string().min(1),
  bank: z.string().min(1),
  location: z.string().min(1),
})

// ============================================================
// DEPARTMENT
// ============================================================
export const createDepartmentSchema = z.object({
  property_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  manager_id: z.string().uuid(),
  authorized_person_id: z.string().uuid().nullable().optional(),
  fiscal_device_id: z.string().uuid().nullable().optional(),
  pos_terminal_ids: z.array(z.string().uuid()).optional(),
})

export const updateDepartmentSchema = createDepartmentSchema.omit({ property_id: true }).partial()
```

- [ ] **Step 2: Commit**

```bash
mkdir -p lib/finance/schemas
git add lib/finance/schemas/property.ts
git commit -m "feat: add Zod schemas for property config entities"
```

---

### Task 7: Zod schemas — Daily reports

**Files:**
- Create: `lib/finance/schemas/daily-report.ts`

- [ ] **Step 1: Create Zod schemas for daily reports**

Write to `lib/finance/schemas/daily-report.ts`:

```typescript
import { z } from 'zod'

const nonNegativeDecimal = z.number().min(0)

// ============================================================
// DAILY REPORT LINE (cash income per department)
// ============================================================
export const dailyReportLineSchema = z.object({
  department_id: z.string().uuid(),
  cash_income: nonNegativeDecimal,
  cash_return: nonNegativeDecimal,
})

// ============================================================
// POS ENTRY
// ============================================================
export const posEntrySchema = z.object({
  pos_terminal_id: z.string().uuid(),
  amount: nonNegativeDecimal,
  return_amount: nonNegativeDecimal,
})

// ============================================================
// Z-REPORT
// ============================================================
export const zReportSchema = z.object({
  cash_amount: nonNegativeDecimal,
  pos_amount: nonNegativeDecimal,
  attachment_url: z.string().url(),
  additional_files: z.array(z.string().url()).optional(),
})

// ============================================================
// DAILY REPORT (full form submission)
// ============================================================
export const saveDailyReportSchema = z.object({
  department_id: z.string().uuid(),
  property_id: z.string().uuid(),
  date: z.string().date(),
  lines: z.array(dailyReportLineSchema).min(1),
  pos_entries: z.array(posEntrySchema),
  z_report: zReportSchema,
  diff_explanation: z.string().nullable().optional(),
})

// NOTE: Rule #3 (diff_explanation required when totalDiff != 0) is enforced
// in the API layer after computing totals, not here — the Zod schema does not
// have access to the calculated diff values. The API must call
// validateDiffExplanation() before transitioning to SUBMITTED status.

// ============================================================
// MANAGER ACTIONS
// ============================================================
export const confirmDailyReportSchema = z.object({
  report_id: z.string().uuid(),
  manager_comment: z.string().nullable().optional(),
})

export const returnDailyReportSchema = z.object({
  report_id: z.string().uuid(),
  manager_comment: z.string().min(1, 'Коментарът е задължителен при връщане'),
})

// ============================================================
// CO ACTIONS
// ============================================================
export const approveDailyReportSchema = z.object({
  report_id: z.string().uuid(),
  co_comment: z.string().nullable().optional(),
})

export const returnFromCOSchema = z.object({
  report_id: z.string().uuid(),
  co_comment: z.string().min(1, 'Коментарът е задължителен при връщане'),
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/finance/schemas/daily-report.ts
git commit -m "feat: add Zod schemas for daily reports"
```

---

### Task 8: Zod schemas — Consolidation

**Files:**
- Create: `lib/finance/schemas/consolidation.ts`

- [ ] **Step 1: Create schema**

Write to `lib/finance/schemas/consolidation.ts`:

```typescript
import { z } from 'zod'

export const sendConsolidationSchema = z.object({
  property_id: z.string().uuid(),
  date: z.string().date(),
  manager_comment: z.string().nullable().optional(),
})

export const approveConsolidationSchema = z.object({
  consolidation_id: z.string().uuid(),
  co_comment: z.string().nullable().optional(),
})

export const returnConsolidationSchema = z.object({
  consolidation_id: z.string().uuid(),
  co_comment: z.string().min(1, 'Коментарът е задължителен при връщане'),
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/finance/schemas/consolidation.ts
git commit -m "feat: add Zod schemas for consolidation"
```

---

### Task 9: Zod schemas — Expense

**Files:**
- Create: `lib/finance/schemas/expense.ts`

- [ ] **Step 1: Create schema**

Write to `lib/finance/schemas/expense.ts`:

```typescript
import { z } from 'zod'

const expenseBaseSchema = z.object({
  property_id: z.string().uuid(),
  department_id: z.string().uuid(),
  category: z.enum([
    'CONSUMABLES', 'SALARIES', 'FOOD_KITCHEN', 'FUEL', 'TAXES_FEES',
    'MAINTENANCE', 'UTILITIES', 'MARKETING', 'INSURANCE', 'ACCOUNTING', 'OTHER',
  ]),
  supplier: z.string().min(1),
  supplier_eik: z.string().nullable().optional(),
  document_type: z.enum(['INVOICE', 'EXPENSE_ORDER', 'RECEIPT', 'NO_DOCUMENT']),
  document_number: z.string().nullable().optional(),
  issue_date: z.string().date(),
  due_date: z.string().date(),
  amount_net: z.number().positive(),
  vat_amount: z.number().min(0),
  payment_method: z.enum(['BANK_TRANSFER', 'CASH', 'CARD', 'OTHER']),
  attachment_url: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
})

export const createExpenseSchema = expenseBaseSchema.refine(
  (data) => data.document_type !== 'NO_DOCUMENT' || (data.note && data.note.length > 0),
  { message: 'Бележка е задължителна при липса на документ', path: ['note'] }
)

export const updateExpenseSchema = expenseBaseSchema.partial()

// Rule #5: attachment required before SENT_TO_CO (except EXPENSE_ORDER with note)
export const submitExpenseSchema = expenseBaseSchema.refine(
  (data) => {
    if (data.document_type === 'EXPENSE_ORDER' && data.note && data.note.length > 0) return true
    return data.attachment_url != null && data.attachment_url.length > 0
  },
  { message: 'Прикачен файл е задължителен при изпращане', path: ['attachment_url'] }
).refine(
  (data) => data.document_type !== 'NO_DOCUMENT' || (data.note && data.note.length > 0),
  { message: 'Бележка е задължителна при липса на документ', path: ['note'] }
)

export const payExpenseSchema = z.object({
  expense_id: z.string().uuid(),
  paid_amount: z.number().positive(),
  paid_at: z.string().date(),
  paid_from_cash: z.string().nullable().optional(),
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/finance/schemas/expense.ts
git commit -m "feat: add Zod schemas for expenses"
```

---

### Task 10: Zod schemas — Cash flow (CashCollection, MoneyReceived)

**Files:**
- Create: `lib/finance/schemas/cash-flow.ts`

- [ ] **Step 1: Create schema**

Write to `lib/finance/schemas/cash-flow.ts`:

```typescript
import { z } from 'zod'

// ============================================================
// CASH COLLECTION (CO collects from property)
// NOTE: collected_by_id is set server-side from auth.uid()
// ============================================================
export const createCashCollectionSchema = z.object({
  property_id: z.string().uuid(),
  collection_date: z.string().date(),
  amount: z.number().positive(),
  covers_date_from: z.string().date(),
  covers_date_to: z.string().date(),
  note: z.string().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
})

export const confirmCashCollectionSchema = z.object({
  collection_id: z.string().uuid(),
})

// ============================================================
// MONEY RECEIVED (CO sends to property)
// ============================================================
export const createMoneyReceivedSchema = z.object({
  property_id: z.string().uuid(),
  amount: z.number().positive(),
  sent_date: z.string().date(),
  purpose: z.enum(['OPERATIONAL', 'SALARIES', 'CASH_SUPPLY', 'SPECIFIC_GOAL', 'ADVANCE']),
  purpose_description: z.string().nullable().optional(),
  source_type: z.enum(['BANK_ACCOUNT', 'CO_CASH', 'OTHER_PROPERTY', 'OTHER']),
  source_bank_account_id: z.string().uuid().nullable().optional(),
  source_property_id: z.string().uuid().nullable().optional(),
  delivery_method: z.enum(['IN_PERSON', 'COURIER', 'BANK_TRANSFER']),
  delivered_by: z.string().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
}).refine(
  (data) => !['SPECIFIC_GOAL', 'ADVANCE'].includes(data.purpose) ||
    (data.purpose_description && data.purpose_description.length > 0),
  { message: 'Описание е задължително за конкретна цел/аванс', path: ['purpose_description'] }
).refine(
  (data) => data.source_type !== 'BANK_ACCOUNT' || data.source_bank_account_id != null,
  { message: 'Банкова сметка е задължителна при source_type BANK_ACCOUNT', path: ['source_bank_account_id'] }
).refine(
  (data) => data.source_type !== 'OTHER_PROPERTY' || data.source_property_id != null,
  { message: 'Обект е задължителен при source_type OTHER_PROPERTY', path: ['source_property_id'] }
)

export const confirmMoneyReceivedSchema = z.object({
  id: z.string().uuid(),
  received_in_cash: z.string().min(1),
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/finance/schemas/cash-flow.ts
git commit -m "feat: add Zod schemas for cash collections and money received"
```

---

### Task 11: Zod schemas — Banking

**Files:**
- Create: `lib/finance/schemas/banking.ts`

- [ ] **Step 1: Create schema**

Write to `lib/finance/schemas/banking.ts`:

```typescript
import { z } from 'zod'

// ============================================================
// BANK ACCOUNT
// ============================================================
export const createBankAccountSchema = z.object({
  name: z.string().min(1),
  iban: z.string().min(10).max(34),
  bank: z.string().min(1),
  currency: z.enum(['BGN', 'EUR', 'USD']),
  account_type: z.enum(['CURRENT', 'SAVINGS', 'CREDIT', 'DEPOSIT']),
  opening_balance: z.number(),
  opening_balance_date: z.string().date(),
  note: z.string().nullable().optional(),
})

// ============================================================
// BANK TRANSACTION
// ============================================================
export const createBankTransactionSchema = z.object({
  bank_account_id: z.string().uuid(),
  transaction_date: z.string().date(),
  direction: z.enum(['IN', 'OUT']),
  amount: z.number().positive(),
  counterparty: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.enum([
    'IN_HOTEL', 'IN_POS', 'IN_OTHER',
    'OUT_INVOICE', 'OUT_CREDIT', 'OUT_REVOLV', 'OUT_SALARY',
    'OUT_TAX', 'OUT_RENT', 'OUT_TRANSFER',
    'INTER_BANK',
  ]),
  property_id: z.string().uuid().nullable().optional(),
  loan_id: z.string().uuid().nullable().optional(),
  expense_id: z.string().uuid().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
})

// ============================================================
// LOAN
// ============================================================
export const createLoanSchema = z.object({
  name: z.string().min(1),
  bank: z.string().min(1),
  principal_amount: z.number().positive(),
  disbursed_amount: z.number().min(0).optional(),
  interest_rate: z.number().min(0).max(100),
  monthly_payment: z.number().positive(),
  payment_day: z.number().int().min(1).max(31),
  first_payment_date: z.string().date(),
  last_payment_date: z.string().date(),
  collateral: z.string().nullable().optional(),
  bank_account_id: z.string().uuid(),
})

// ============================================================
// REVOLVING CREDIT
// ============================================================
export const createRevolvingCreditSchema = z.object({
  name: z.string().min(1),
  bank: z.string().min(1),
  credit_limit: z.number().positive(),
  interest_rate: z.number().min(0).max(100),
  commitment_fee: z.number().min(0).nullable().optional(),
  open_date: z.string().date(),
  expiry_date: z.string().date().nullable().optional(),
  bank_account_id: z.string().uuid(),
})

// ============================================================
// CO CASH
// ============================================================
export const createCOCashSchema = z.object({
  name: z.string().min(1),
  opening_balance: z.number(),
  opening_balance_date: z.string().date(),
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/finance/schemas/banking.ts
git commit -m "feat: add Zod schemas for banking entities"
```

---

### Task 12: Zod schemas — Withdrawal

**Files:**
- Create: `lib/finance/schemas/withdrawal.ts`

- [ ] **Step 1: Create schema**

Write to `lib/finance/schemas/withdrawal.ts`:

```typescript
import { z } from 'zod'

export const createWithdrawalSchema = z.object({
  property_id: z.string().uuid(),
  cash_register: z.string().min(1),
  amount: z.number().positive(),
  withdrawn_by: z.string().min(1),
  purpose: z.enum([
    'PAY_EXP', 'PAY_SAL', 'ADV_EMP', 'ADV_OPS',
    'BANK_IN', 'CASH_TRANS', 'CO_COLLECT', 'OTHER',
  ]),
  description: z.string().nullable().optional(),
  expense_id: z.string().uuid().nullable().optional(),
  employee_id: z.string().uuid().nullable().optional(),
  target_cash: z.string().nullable().optional(),
  bank_account_id: z.string().uuid().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
}).refine(
  (data) => !['ADV_EMP', 'ADV_OPS', 'OTHER'].includes(data.purpose) ||
    (data.description && data.description.length > 0),
  { message: 'Описание е задължително за аванс/друго', path: ['description'] }
)

export const accountWithdrawalSchema = z.object({
  withdrawal_id: z.string().uuid(),
  accounted_amount: z.number().min(0),
  accounted_date: z.string().date(),
})

export const voidWithdrawalSchema = z.object({
  withdrawal_id: z.string().uuid(),
  void_reason: z.string().min(1, 'Причина за анулиране е задължителна'),
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/finance/schemas/withdrawal.ts
git commit -m "feat: add Zod schemas for withdrawals"
```

---

### Task 13: Zod schemas — InTransit & TransactionChain

**Files:**
- Create: `lib/finance/schemas/in-transit.ts`

- [ ] **Step 1: Create schema**

Write to `lib/finance/schemas/in-transit.ts`:

```typescript
import { z } from 'zod'

// ============================================================
// IN-TRANSIT
// ============================================================
const inTransitSourceSchema = z.object({
  source_type: z.enum(['BANK_ACCOUNT', 'PROPERTY_CASH', 'CO_CASH']),
  source_id: z.string().uuid(),
  amount: z.number().positive(),
  withdrawal_id: z.string().uuid().nullable().optional(),
})

export const createInTransitSchema = z.object({
  total_amount: z.number().positive(),
  currency: z.enum(['BGN', 'EUR', 'USD']).optional(),
  description: z.string().min(1),
  sources: z.array(inTransitSourceSchema).min(1),
})

export const closeInTransitStepSchema = z.object({
  in_transit_id: z.string().uuid(),
  amount: z.number().positive(),
  destination_type: z.enum(['BANK_ACCOUNT', 'PROPERTY_CASH', 'CO_CASH']),
  destination_id: z.string().uuid(),
})

// ============================================================
// TRANSACTION CHAIN
// ============================================================
const chainStepSchema = z.object({
  step_order: z.number().int().positive(),
  module_type: z.enum([
    'BankTransaction', 'Withdrawal', 'Expense',
    'CashCollection', 'MoneyReceived', 'IncomeEntry',
  ]),
  module_id: z.string().uuid(),
  description: z.string().nullable().optional(),
})

export const createTransactionChainSchema = z.object({
  name: z.string().min(1),
  chain_date: z.string().date(),
  description: z.string().nullable().optional(),
  in_transit_id: z.string().uuid().nullable().optional(),
  steps: z.array(chainStepSchema).min(1),
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/finance/schemas/in-transit.ts
git commit -m "feat: add Zod schemas for in-transit and transaction chains"
```

---

### Task 14: Zod schemas — Income entry

**Files:**
- Create: `lib/finance/schemas/income.ts`

- [ ] **Step 1: Create schema**

Write to `lib/finance/schemas/income.ts`:

```typescript
import { z } from 'zod'

export const createIncomeEntrySchema = z.object({
  entry_date: z.string().date(),
  property_id: z.string().uuid(),
  type: z.enum([
    'INC_BANK', 'INC_CASH', 'INC_ADV', 'INC_DEP', 'INC_OTHER',
    'CF_CREDIT', 'CF_TRANSFER',
  ]),
  amount: z.number().positive(),
  bank_account_id: z.string().uuid().nullable().optional(),
  payment_method: z.enum(['BANK', 'CASH']),
  payer: z.string().min(1),
  description: z.string().nullable().optional(),
  period_from: z.string().date().nullable().optional(),
  period_to: z.string().date().nullable().optional(),
  loan_id: z.string().uuid().nullable().optional(),
  attachment_url: z.string().url().nullable().optional(),
  income_category: z.enum([
    'ACCOMMODATION', 'FB', 'SPA', 'FEES', 'COMMISSIONS', 'OTHER',
  ]).nullable().optional(),
}).refine(
  (data) => {
    const isIncome = data.type.startsWith('INC_')
    return !isIncome || data.income_category != null
  },
  { message: 'Категория е задължителна за приходни типове', path: ['income_category'] }
).refine(
  (data) => data.type !== 'CF_CREDIT' || data.loan_id != null,
  { message: 'Кредит е задължителен при CF_CREDIT', path: ['loan_id'] }
)

export const realizeAdvanceSchema = z.object({
  income_entry_id: z.string().uuid(),
})
```

- [ ] **Step 2: Commit**

```bash
git add lib/finance/schemas/income.ts
git commit -m "feat: add Zod schemas for income entries"
```

---

### Task 15: Schema index file

**Files:**
- Create: `lib/finance/schemas/index.ts`

- [ ] **Step 1: Create barrel export**

Write to `lib/finance/schemas/index.ts`:

```typescript
export * from './property'
export * from './daily-report'
export * from './consolidation'
export * from './expense'
export * from './cash-flow'
export * from './banking'
export * from './withdrawal'
export * from './in-transit'
export * from './income'
```

- [ ] **Step 2: Verify all imports resolve**

Run: `npx tsc --noEmit lib/finance/schemas/index.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/finance/schemas/index.ts
git commit -m "feat: add schema barrel export"
```

---

### Task 16: Final verification

- [ ] **Step 1: Run TypeScript check on entire project**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 3: Verify all files exist**

Run: `find supabase/migrations types lib/finance -type f | sort`
Expected output:
```
lib/finance/schemas/banking.ts
lib/finance/schemas/cash-flow.ts
lib/finance/schemas/consolidation.ts
lib/finance/schemas/daily-report.ts
lib/finance/schemas/expense.ts
lib/finance/schemas/in-transit.ts
lib/finance/schemas/income.ts
lib/finance/schemas/index.ts
lib/finance/schemas/property.ts
lib/finance/schemas/withdrawal.ts
supabase/migrations/20260311000000_create_chat_tables.sql
supabase/migrations/20260327000000_create_finance_tables.sql
supabase/migrations/20260327000001_create_finance_views.sql
supabase/migrations/20260327000002_create_finance_rls.sql
types/chat.ts
types/finance.ts
```

- [ ] **Step 4: Final commit if any uncommitted changes**

```bash
git status
# If any changes:
git add -A && git commit -m "chore: phase 1 complete — database foundation"
```
