-- =============================================================
-- Redesign daily reports: per-property instead of per-department
-- =============================================================

-- 1. Drop old child tables (no production data yet)
DROP TABLE IF EXISTS pos_entries CASCADE;
DROP TABLE IF EXISTS z_reports CASCADE;

-- 2. Restructure daily_report_lines
DROP TABLE IF EXISTS daily_report_lines CASCADE;

CREATE TABLE daily_report_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id),

  -- Cash
  cash_income DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (cash_income >= 0),
  cash_refund DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (cash_refund >= 0),
  cash_net DECIMAL(12,2) GENERATED ALWAYS AS (cash_income - cash_refund) STORED,

  -- POS
  pos_income DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (pos_income >= 0),
  pos_refund DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (pos_refund >= 0),
  pos_net DECIMAL(12,2) GENERATED ALWAYS AS (pos_income - pos_refund) STORED,

  -- Z-report (fiscal device control report)
  z_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  z_pos DECIMAL(12,2) NOT NULL DEFAULT 0,
  z_attachment_url TEXT,

  -- POS bank report
  pos_report_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Differences (auto-calculated)
  cash_diff DECIMAL(12,2) GENERATED ALWAYS AS (cash_income - cash_refund - z_cash) STORED,
  pos_diff DECIMAL(12,2) GENERATED ALWAYS AS (pos_income - pos_refund - pos_report_amount) STORED,
  total_diff DECIMAL(12,2) GENERATED ALWAYS AS (
    (cash_income - cash_refund - z_cash) + (pos_income - pos_refund - pos_report_amount)
  ) STORED,

  -- Who filled this line
  filled_by_id UUID REFERENCES user_profiles(id),

  UNIQUE (daily_report_id, department_id)
);

-- 3. Alter daily_reports
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_department_id_date_key;
ALTER TABLE daily_reports DROP COLUMN IF EXISTS department_id;
ALTER TABLE daily_reports DROP COLUMN IF EXISTS confirmed_by_id;
ALTER TABLE daily_reports DROP COLUMN IF EXISTS confirmed_at;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS general_attachment_url TEXT;

-- New unique constraint: one report per property per date
ALTER TABLE daily_reports ADD CONSTRAINT daily_reports_property_date_key UNIQUE (property_id, date);

-- Simplify status values
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_status_check;
ALTER TABLE daily_reports ADD CONSTRAINT daily_reports_status_check
  CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED'));

-- 4. RLS for daily_report_lines
ALTER TABLE daily_report_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_report_lines_select" ON daily_report_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = daily_report_lines.daily_report_id
    )
  );

CREATE POLICY "daily_report_lines_insert" ON daily_report_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = daily_report_lines.daily_report_id
        AND dr.status = 'DRAFT'
    )
  );

CREATE POLICY "daily_report_lines_update" ON daily_report_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = daily_report_lines.daily_report_id
        AND dr.status IN ('DRAFT', 'RETURNED')
    )
  );

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_daily_report_lines_report ON daily_report_lines(daily_report_id);
