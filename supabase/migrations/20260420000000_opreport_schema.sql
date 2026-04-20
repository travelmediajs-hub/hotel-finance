-- opreport_rows: global fixed template
CREATE TABLE opreport_rows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_key         text NOT NULL UNIQUE,
  label_bg        text NOT NULL,
  section         text NOT NULL CHECK (section IN (
    'STATISTICS','REVENUE','FB_EXPENSES','STAFF',
    'UTILITIES','OTHER_EXPENSES','TOTALS'
  )),
  sort_order      int NOT NULL,
  row_type        text NOT NULL CHECK (row_type IN (
    'HEADER','STAT','REVENUE','EXPENSE','PAYROLL','RENT','DERIVED'
  )),
  formula         text,
  source          text,
  vat_applicable  boolean NOT NULL DEFAULT false,
  budgetable      boolean NOT NULL DEFAULT false,
  display_format  text NOT NULL DEFAULT 'NUMBER'
                  CHECK (display_format IN ('NUMBER','PERCENT','CURRENCY')),
  indent_level    int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_opreport_rows_section_sort ON opreport_rows (section, sort_order);

-- opreport_row_accounts: many-to-many row → usali_accounts
CREATE TABLE opreport_row_accounts (
  row_id      uuid NOT NULL REFERENCES opreport_rows(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES usali_accounts(id) ON DELETE RESTRICT,
  PRIMARY KEY (row_id, account_id)
);

CREATE INDEX idx_opreport_row_accounts_account ON opreport_row_accounts (account_id);

-- opreport_budgets: one amount per (property, year, month, row)
CREATE TABLE opreport_budgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  year         int NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  month        int NOT NULL CHECK (month BETWEEN 1 AND 12),
  row_id       uuid NOT NULL REFERENCES opreport_rows(id) ON DELETE RESTRICT,
  amount       decimal(14,2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, year, month, row_id)
);

CREATE INDEX idx_opreport_budgets_lookup ON opreport_budgets (property_id, year);

-- RLS
ALTER TABLE opreport_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE opreport_row_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opreport_budgets ENABLE ROW LEVEL SECURITY;

-- Template is readable by all authenticated; writable only via migration
CREATE POLICY "opreport_rows_read" ON opreport_rows
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "opreport_row_accounts_read" ON opreport_row_accounts
  FOR SELECT TO authenticated USING (true);

-- Budgets: auth users can read; writes controlled by app-layer permission check
CREATE POLICY "opreport_budgets_all" ON opreport_budgets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
