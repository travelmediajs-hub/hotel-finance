-- RBAC System: roles, permissions, role_permissions
-- Allows creating custom roles and editing permission matrix.

-- ============================================================
-- 1. ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  key          text PRIMARY KEY,
  label        text NOT NULL,
  description  text,
  is_system    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO roles (key, label, description, is_system) VALUES
  ('ADMIN_CO',   'Администратор ЦО', 'Пълни права, управление на потребители и роли', true),
  ('FINANCE_CO', 'Финанси ЦО',       'Всички финансови операции, без управление на потребители', true),
  ('MANAGER',    'Управител',        'Управление на собствен обект', true),
  ('DEPT_HEAD',  'Отдел',            'Въвеждане на данни за отдел', true)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. PERMISSIONS CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  key          text PRIMARY KEY,
  module       text NOT NULL,
  label        text NOT NULL,
  description  text,
  sort_order   integer NOT NULL DEFAULT 0
);

INSERT INTO permissions (key, module, label, sort_order) VALUES
  -- Expenses
  ('expenses.view',      'expenses', 'Преглед на разходи',         10),
  ('expenses.create',    'expenses', 'Създаване на разход',        11),
  ('expenses.edit',      'expenses', 'Редактиране на разход',      12),
  ('expenses.submit',    'expenses', 'Изпращане към ЦО',           13),
  ('expenses.approve',   'expenses', 'Одобряване на разход',       14),
  ('expenses.return',    'expenses', 'Връщане за корекция',        15),
  ('expenses.reject',    'expenses', 'Отхвърляне на разход',       16),
  ('expenses.pay',       'expenses', 'Плащане на разход',          17),
  ('expenses.delete',    'expenses', 'Изтриване на разход',        18),

  -- Daily reports
  ('daily_reports.view',    'daily_reports', 'Преглед на дневни отчети', 20),
  ('daily_reports.create',  'daily_reports', 'Създаване на отчет',        21),
  ('daily_reports.edit',    'daily_reports', 'Редактиране на отчет',      22),
  ('daily_reports.submit',  'daily_reports', 'Изпращане на отчет',        23),
  ('daily_reports.approve', 'daily_reports', 'Одобряване на отчет',       24),
  ('daily_reports.return',  'daily_reports', 'Връщане на отчет',          25),

  -- Income
  ('income.view',    'income', 'Преглед на приходи',        30),
  ('income.create',  'income', 'Създаване на приход',       31),
  ('income.edit',    'income', 'Редактиране на приход',     32),
  ('income.confirm', 'income', 'Потвърждаване на приход',   33),
  ('income.realize', 'income', 'Реализиране на аванс',      34),

  -- Cash register
  ('cash_register.view',     'cash_register', 'Преглед на каса',       40),
  ('cash_register.withdraw', 'cash_register', 'Теглене от каса',       41),
  ('cash_register.collect',  'cash_register', 'Събиране към ЦО',       42),
  ('cash_register.transfer', 'cash_register', 'Прехвърляне',           43),

  -- Banking / bank accounts
  ('banking.view',           'banking', 'Преглед на банкови сметки',    50),
  ('banking.manage',         'banking', 'Управление на банкови сметки', 51),
  ('bank_transactions.view', 'banking', 'Преглед на движения',          52),

  -- Consolidations
  ('consolidations.view',    'consolidations', 'Преглед на консолидации', 60),
  ('consolidations.create',  'consolidations', 'Създаване',                61),
  ('consolidations.approve', 'consolidations', 'Одобряване',               62),

  -- Suppliers / chart of accounts
  ('suppliers.view',           'suppliers', 'Преглед на доставчици',     70),
  ('suppliers.manage',         'suppliers', 'Управление на доставчици',  71),
  ('chart_of_accounts.view',   'usali',     'Преглед на сметкоплан',     72),
  ('chart_of_accounts.manage', 'usali',     'Управление на сметкоплан',  73),

  -- Reports
  ('reports.monthly.view', 'reports', 'Преглед на месечен отчет',   80),
  ('reports.usali.view',   'reports', 'Преглед на USALI отчет',     81),
  ('dashboard.view',       'reports', 'Преглед на дашборд',         82),

  -- Properties & departments
  ('properties.view',   'properties', 'Преглед на обекти',    90),
  ('properties.manage', 'properties', 'Управление на обекти', 91),
  ('departments.view',   'departments', 'Преглед на отдели',    92),
  ('departments.manage', 'departments', 'Управление на отдели', 93),

  -- Administration
  ('users.view',   'admin', 'Преглед на потребители',    100),
  ('users.manage', 'admin', 'Управление на потребители', 101),
  ('roles.view',   'admin', 'Преглед на роли',           102),
  ('roles.manage', 'admin', 'Управление на роли',        103)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 3. ROLE_PERMISSIONS MATRIX
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_key       text NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted        boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_key, permission_key)
);

-- Seed default grants
-- ADMIN_CO: everything
INSERT INTO role_permissions (role_key, permission_key, granted)
SELECT 'ADMIN_CO', key, true FROM permissions
ON CONFLICT DO NOTHING;

-- FINANCE_CO: everything except users.manage and roles.manage
INSERT INTO role_permissions (role_key, permission_key, granted)
SELECT 'FINANCE_CO', key,
  (key NOT IN ('users.manage', 'roles.manage'))
FROM permissions
ON CONFLICT DO NOTHING;

-- MANAGER
INSERT INTO role_permissions (role_key, permission_key, granted)
SELECT 'MANAGER', key, (key IN (
  'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.submit',
  'daily_reports.view', 'daily_reports.create', 'daily_reports.edit', 'daily_reports.submit',
  'cash_register.view',
  'income.view',
  'dashboard.view',
  'departments.view',
  'suppliers.view',
  'chart_of_accounts.view'
))
FROM permissions
ON CONFLICT DO NOTHING;

-- DEPT_HEAD
INSERT INTO role_permissions (role_key, permission_key, granted)
SELECT 'DEPT_HEAD', key, (key IN (
  'daily_reports.view', 'daily_reports.edit',
  'expenses.view',
  'cash_register.view'
))
FROM permissions
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. RELAX user_profiles.role CHECK — allow custom role keys via FK
-- ============================================================
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_fkey
  FOREIGN KEY (role) REFERENCES roles(key) ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;

-- ============================================================
-- 5. HELPER: check permission for current user
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_has_permission(perm_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM role_permissions rp
    JOIN user_profiles up ON up.role = rp.role_key
    WHERE up.id = auth.uid()
      AND rp.permission_key = perm_key
      AND rp.granted = true
  );
$$;

-- ============================================================
-- 6. RLS
-- ============================================================
ALTER TABLE roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions  ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read roles/permissions (needed for UI labels)
CREATE POLICY roles_read        ON roles            FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_read  ON permissions      FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_read           ON role_permissions FOR SELECT TO authenticated USING (true);

-- Only ADMIN_CO can write (further gated by app on roles.manage/users.manage)
CREATE POLICY roles_write ON roles
  FOR ALL TO authenticated
  USING (public.user_role() = 'ADMIN_CO')
  WITH CHECK (public.user_role() = 'ADMIN_CO');

CREATE POLICY rp_write ON role_permissions
  FOR ALL TO authenticated
  USING (public.user_role() = 'ADMIN_CO')
  WITH CHECK (public.user_role() = 'ADMIN_CO');

NOTIFY pgrst, 'reload schema';
