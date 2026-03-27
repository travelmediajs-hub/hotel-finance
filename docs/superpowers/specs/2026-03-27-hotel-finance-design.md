# Hotel Finance System — Design Spec

**Date:** 2026-03-27
**Source:** zadanie_v6.0_za_claude_code.md (Версия 6.0 ФИНАЛНА)
**Status:** Approved

---

## 1. Context

Financial reporting and cash flow management system for a hotel chain (4+ hotels, 1 shop, central office). Integrates as a module into the existing Next.js + Supabase chat application — shared auth, shared Supabase instance, new `(finance)` route group.

### Three-tier hierarchy

```
LEVEL 1 — CENTRAL OFFICE (CO)    ← approves, sees everything, manages banks/loans
LEVEL 2 — PROPERTY (Hotel/Shop)  ← confirms departments, consolidates, sends to CO
LEVEL 3 — DEPARTMENT (HsK, F&B…) ← fills daily report
```

### Roles

| Role | Code | Level | Capabilities |
|------|------|-------|-------------|
| CO Admin | `ADMIN_CO` | 1 | Full config, approve all, manage banks |
| CO Finance | `FINANCE_CO` | 1 | Approve reports/expenses, enter income, manage banks |
| Property Manager | `MANAGER` | 2 | Confirm departments, consolidate, enter expenses |
| Department Head | `DEPT_HEAD` | 3 | Fill daily reports for own department |

---

## 2. Tech Stack (Approach A — Supabase-native)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 15 App Router + TypeScript | Existing stack, SSR, responsive |
| UI | shadcn/ui + Tailwind CSS | Existing stack, tables/forms |
| Database | PostgreSQL (Supabase) | RLS native, realtime for notifications |
| Auth | Supabase Auth + RLS | 2FA for CO, row-level security per spec |
| File storage | Supabase Storage | PDF/JPG/PNG up to 10MB, signed URLs |
| API | Next.js Route Handlers | Server-side validation, workflow transitions |
| Export | xlsx + @react-pdf/renderer | Excel and PDF export per spec |
| Notifications | Supabase Edge Functions + Resend | Email alerts, cron for deadline checks |
| Validation | Zod | Shared schemas client/server |

### Integration with existing app

- New route group: `app/(finance)/...`
- New API routes: `app/api/finance/...`
- Shared: `lib/supabase/`, `middleware.ts` (extended), `components/ui/`
- New: `types/finance.ts`, `components/finance/`

---

## 3. Database Schema

### 3.1 Core — Users, Properties, Departments

```sql
-- Extends Supabase auth.users with app-specific role data
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('HOTEL', 'APARTMENT_HOTEL', 'HOSTEL', 'SHOP', 'OTHER')),
  category text NOT NULL CHECK (category IN ('1_STAR','2_STAR','3_STAR','4_STAR','5_STAR','NONE')),
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

CREATE TABLE user_property_access (
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE fiscal_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  serial_number text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pos_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tid text NOT NULL,
  bank text NOT NULL,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now()
);

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
```

### 3.2 Daily Reports & Consolidation

```sql
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
CREATE INDEX idx_daily_reports_consolidation ON daily_reports (consolidation_id) WHERE consolidation_id IS NOT NULL;

CREATE TABLE daily_report_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id),
  cash_income decimal(12,2) NOT NULL DEFAULT 0 CHECK (cash_income >= 0),
  cash_return decimal(12,2) NOT NULL DEFAULT 0 CHECK (cash_return >= 0),
  cash_net decimal(12,2) NOT NULL GENERATED ALWAYS AS (cash_income - cash_return) STORED,
  UNIQUE (daily_report_id, department_id)
);

CREATE TABLE pos_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id uuid NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  pos_terminal_id uuid NOT NULL REFERENCES pos_terminals(id),
  amount decimal(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  return_amount decimal(12,2) NOT NULL DEFAULT 0 CHECK (return_amount >= 0),
  net_amount decimal(12,2) NOT NULL GENERATED ALWAYS AS (amount - return_amount) STORED,
  UNIQUE (daily_report_id, pos_terminal_id)
);

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
```

### 3.3 Expenses, CashCollection, MoneyReceived

```sql
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
CREATE INDEX idx_expenses_due_date ON expenses (due_date) WHERE status IN ('UNPAID', 'SENT_TO_CO');

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
  source_bank_account_id uuid,
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
```

### 3.4 Banking, Loans, CO Cash

```sql
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
  loan_id uuid,
  expense_id uuid REFERENCES expenses(id),
  attachment_url text,
  note text,
  created_by_id uuid NOT NULL REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_tx_account_date ON bank_transactions (bank_account_id, transaction_date);
CREATE INDEX idx_bank_tx_type ON bank_transactions (type);

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

CREATE TABLE co_cash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  opening_balance decimal(14,2) NOT NULL DEFAULT 0,
  opening_balance_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Deferred FKs
ALTER TABLE bank_transactions
  ADD CONSTRAINT fk_bank_tx_loan FOREIGN KEY (loan_id) REFERENCES loans(id);

ALTER TABLE money_received
  ADD CONSTRAINT fk_money_received_bank_account
  FOREIGN KEY (source_bank_account_id) REFERENCES bank_accounts(id);

-- Calculated balance views
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
  -- estimatedMonthlyInterest = usedAmount * rate / 12
  (COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'OUT' AND bt.type = 'OUT_REVOLV'), 0)
    - COALESCE(SUM(bt.amount) FILTER (WHERE bt.direction = 'IN' AND bt.type = 'OUT_REVOLV'), 0)
  ) * rc.interest_rate / 100.0 / 12.0 AS estimated_monthly_interest
FROM revolving_credits rc
LEFT JOIN bank_transactions bt ON bt.bank_account_id = rc.bank_account_id
GROUP BY rc.id;

CREATE VIEW loan_balances AS
SELECT
  l.id,
  l.name,
  l.principal_amount,
  l.monthly_payment,
  l.payment_day,
  l.last_payment_date,
  COALESCE(SUM(bt.amount) FILTER (WHERE bt.type = 'OUT_CREDIT'), 0) AS paid_principal,
  l.principal_amount
    - COALESCE(SUM(bt.amount) FILTER (WHERE bt.type = 'OUT_CREDIT'), 0) AS remaining_principal,
  -- remainingPayments = ceil(remaining / monthly)
  CASE WHEN l.monthly_payment > 0 THEN
    CEIL((l.principal_amount - COALESCE(SUM(bt.amount) FILTER (WHERE bt.type = 'OUT_CREDIT'), 0))
         / l.monthly_payment)::int
  ELSE 0 END AS remaining_payments,
  -- nextPaymentDate = next occurrence of payment_day
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

-- CO cash dynamic balance: opening + collections received - money sent out
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

-- Net cash position view (rule #15)
-- = Banks + CO Cash + Property Cash - Unpaid expenses - Loan payments (30 days)
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

### 3.5 Withdrawals, InTransit, TransactionChain

```sql
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

CREATE TABLE withdrawal_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('DEPT_HEAD', 'MANAGER')),
  auto_approve_limit decimal(12,2) NOT NULL,
  co_approval_limit decimal(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, role)
);

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

CREATE UNIQUE INDEX idx_in_transit_one_open_per_person
  ON in_transits (carried_by_id) WHERE status IN ('OPEN', 'PARTIALLY_CLOSED');

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
```

### 3.6 IncomeEntry, AuditLog, Notifications

```sql
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

-- audit_logs.changed_fields JSON schema:
-- For CREATE: { "field": { "old": null, "new": value } }
-- For UPDATE/STATUS_CHANGE: { "field": { "old": previous, "new": current } }
-- For VOID: { "void_reason": { "old": null, "new": "reason" } }
-- This satisfies spec rule #13 (userId, timestamp, oldValue, newValue)
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
```

### 3.7 Row-Level Security Policies

```sql
-- Enable RLS on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_report_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE z_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_consolidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- Helper function: get user role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check property access
CREATE OR REPLACE FUNCTION auth.has_property_access(prop_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_property_access
    WHERE user_id = auth.uid() AND property_id = prop_id
  ) OR auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check department access
-- MANAGER gets access only to departments within their assigned properties
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

-- Properties: CO sees all, others see only assigned
CREATE POLICY properties_select ON properties FOR SELECT
  USING (auth.has_property_access(id));

-- Departments: CO sees all, managers see own property, dept heads see own dept
CREATE POLICY departments_select ON departments FOR SELECT
  USING (auth.has_property_access(property_id));

-- Daily reports: dept heads see own dept, managers see own property, CO sees all
CREATE POLICY daily_reports_select ON daily_reports FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY daily_reports_insert ON daily_reports FOR INSERT
  WITH CHECK (auth.has_department_access(department_id) AND auth.user_role() = 'DEPT_HEAD');
CREATE POLICY daily_reports_update ON daily_reports FOR UPDATE
  USING (auth.has_property_access(property_id));

-- Daily report lines: follow parent report access
CREATE POLICY daily_report_lines_select ON daily_report_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_id AND auth.has_property_access(dr.property_id)
  ));

-- POS entries: follow parent report access
CREATE POLICY pos_entries_select ON pos_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_id AND auth.has_property_access(dr.property_id)
  ));

-- Z-reports: follow parent report access
CREATE POLICY z_reports_select ON z_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.id = daily_report_id AND auth.has_property_access(dr.property_id)
  ));

-- Consolidations: managers see own property, CO sees all
CREATE POLICY consolidations_select ON property_consolidations FOR SELECT
  USING (auth.has_property_access(property_id));

-- Expenses: managers see own property, CO sees all
CREATE POLICY expenses_select ON expenses FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY expenses_insert ON expenses FOR INSERT
  WITH CHECK (auth.has_property_access(property_id) AND auth.user_role() = 'MANAGER');

-- Cash collections: CO creates, manager confirms
CREATE POLICY cash_collections_select ON cash_collections FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY cash_collections_insert ON cash_collections FOR INSERT
  WITH CHECK (auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));

-- Money received: CO creates, manager confirms
CREATE POLICY money_received_select ON money_received FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY money_received_insert ON money_received FOR INSERT
  WITH CHECK (auth.user_role() IN ('ADMIN_CO', 'FINANCE_CO'));

-- Withdrawals: property staff creates, CO approves
CREATE POLICY withdrawals_select ON withdrawals FOR SELECT
  USING (auth.has_property_access(property_id));
CREATE POLICY withdrawals_insert ON withdrawals FOR INSERT
  WITH CHECK (auth.has_property_access(property_id));

-- Bank tables: CO only
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE revolving_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;

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

-- Notifications: users see only their own
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_own ON notifications FOR SELECT
  USING (recipient_id = auth.uid());
```

---

## 4. Table Summary

| # | Table | Section | Type |
|---|-------|---------|------|
| 1 | `user_profiles` | 3.1 | Core |
| 2 | `properties` | 3.1 | Core |
| 3 | `user_property_access` | 3.1 | Junction (RLS) |
| 4 | `user_department_access` | 3.1 | Junction (RLS) |
| 5 | `fiscal_devices` | 3.1 | Config |
| 6 | `pos_terminals` | 3.1 | Config |
| 7 | `departments` | 3.1 | Config |
| 8 | `department_pos_terminals` | 3.1 | Junction (M:N) |
| 9 | `daily_reports` | 3.2 | Workflow |
| 10 | `daily_report_lines` | 3.2 | Detail |
| 11 | `pos_entries` | 3.2 | Detail |
| 12 | `z_reports` | 3.2 | Detail |
| 13 | `property_consolidations` | 3.2 | Workflow |
| 14 | `expenses` | 3.3 | Workflow |
| 15 | `cash_collections` | 3.3 | Workflow |
| 16 | `money_received` | 3.3 | Workflow |
| 17 | `bank_accounts` | 3.4 | Finance |
| 18 | `bank_transactions` | 3.4 | Finance |
| 19 | `loans` | 3.4 | Finance |
| 20 | `revolving_credits` | 3.4 | Finance |
| 21 | `co_cash` | 3.4 | Finance |
| 22 | `withdrawals` | 3.5 | Workflow |
| 23 | `withdrawal_thresholds` | 3.5 | Config |
| 24 | `in_transits` | 3.5 | Workflow |
| 25 | `in_transit_sources` | 3.5 | Detail |
| 26 | `transaction_chains` | 3.5 | Workflow |
| 27 | `transaction_chain_steps` | 3.5 | Detail |
| 28 | `income_entries` | 3.6 | Finance |
| 29 | `audit_logs` | 3.6 | System |
| 30 | `notifications` | 3.6 | System |
| V1 | `bank_account_balances` | 3.4 | View |
| V2 | `revolving_credit_balances` | 3.4 | View |
| V3 | `loan_balances` | 3.4 | View |
| V4 | `co_cash_balances` | 3.4 | View |
| V5 | `net_cash_position` | 3.4 | View |

### Spec entities deliberately omitted

| Spec Entity | Rationale |
|-------------|-----------|
| **Company** (#1) | Single-tenant system — company info stored as env vars / app config, not a DB entity. If multi-tenant needed later, add table then. |
| **CentralOffice** (#2) | CO users identified by role (`ADMIN_CO`, `FINANCE_CO`) in `user_profiles`. No separate config needed — CO address/contact lives in app config. |
| **MonthlyView** (#13) | Pure read-only aggregate — built as a dynamic query in the API layer joining `daily_reports`, `cash_collections`, and `pos_entries` by property + month. No materialized table needed. |

## 5. Business Rules Coverage

| # | Rule | Level | Mechanism |
|---|------|-------|-----------|
| 1 | One report per dept/date | DB | `UNIQUE (department_id, date)` |
| 2 | Z-report file required | DB | `attachment_url NOT NULL` |
| 3 | diffExplanation required when totalDiff != 0 | App | Zod validation before status transition to SUBMITTED |
| 4 | APPROVED report not editable | App | API route rejects updates when status IN (APPROVED, CORRECTED) |
| 5 | Expense requires attachment (except EXPENSE_ORDER with note) | App | Zod validation before status transition to SENT_TO_CO |
| 6 | Withdrawal above threshold needs pre-approval | App+DB | `withdrawal_thresholds` table + API validation |
| 7 | Withdrawals non-deletable | DB | `is_void` flag instead of DELETE; no DELETE policy |
| 8 | One open in-transit per person | DB | Partial unique index |
| 9 | CF_CREDIT/CF_TRANSFER ≠ P&L | DB | Partial index for P&L queries; `net_cash_position` view excludes them |
| 10 | Bank balance = opening + IN - OUT | DB | View `bank_account_balances` |
| 11 | Consolidation only when all CONFIRMED | App | API checks all active dept reports are CONFIRMED before allowing SENT_TO_CO |
| 12 | Row-level security | DB | RLS policies in section 3.7 using `user_property_access` + `user_department_access` |
| 13 | Every change audited | App | `audit_logs` table; app writes JSON `{ field: { old, new } }` on every mutation |
| 14 | INC_ADV stays ADVANCE until realized | App | Status CHECK allows ADVANCE/REALIZED; transition enforced in API |
| 15 | Net cash position formula | DB | `net_cash_position` view in section 3.4 |

## 6. Design Decisions

1. **Generated columns** for `cash_net`, `net_amount`, `total_amount`, `remaining_amount`, `returned_amount` — Postgres computes them, impossible to drift
2. **Views** for bank/loan/revolving balances — single source of truth is `bank_transactions`
3. **Partial indexes** for hot queries (unpaid expenses, unaccounted advances, pending approvals)
4. **Polymorphic FK** in `in_transit_sources` and `transaction_chain_steps` — constrained by CHECK on `module_type`/`source_type`
5. **Deferred FKs** for circular dependencies (loans ↔ bank_transactions, money_received → bank_accounts)
6. **`decimal(12,2)`** for property-level amounts, **`decimal(14,2)`** for bank/aggregate amounts
7. **Soft delete** for withdrawals (`is_void` + correction record), hard delete nowhere
8. **`in_transits.remaining_amount`** is app-maintained (not a generated column) because it depends on cross-table SUM of closed steps which PG generated columns cannot reference. App updates it transactionally when closing steps.
9. **Currency**: spec says "EUR only" but `bank_accounts` and `in_transits` allow BGN/EUR/USD for forward compatibility with real-world bank accounts that may hold other currencies. All financial calculations and reporting are in EUR.

## 7. Workflow Status Machines

| Module | Flow | Terminal |
|--------|------|----------|
| DailyReport | DRAFT → SUBMITTED → CONFIRMED/RETURNED → SENT_TO_CO → APPROVED/CORRECTED/RETURNED | APPROVED, CORRECTED |
| Expense | DRAFT → UNPAID → SENT_TO_CO → APPROVED → PARTIAL → PAID/REJECTED/OVERDUE | PAID, REJECTED |
| Withdrawal | RECORDED → PENDING_APPROVAL → APPROVED/REJECTED → ACCOUNTED/UNACCOUNTED_ADVANCE | ACCOUNTED |
| InTransit | OPEN → PARTIALLY_CLOSED → CLOSED | CLOSED |
| CashCollection | SENT → RECEIVED → ACCOUNTED | ACCOUNTED |
| MoneyReceived | SENT → RECEIVED → ACCOUNTED | ACCOUNTED |
| IncomeEntry | ENTERED → CONFIRMED (INC_ADV: ADVANCE → REALIZED) | CONFIRMED |
| TransactionChain | OPEN → CLOSED | CLOSED |
