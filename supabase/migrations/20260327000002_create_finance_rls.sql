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
