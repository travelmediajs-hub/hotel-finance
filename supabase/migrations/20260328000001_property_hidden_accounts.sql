-- Property-specific account visibility
-- If a row exists, the account is hidden for that property.
-- Default behavior: all active accounts are visible for all properties.

CREATE TABLE property_hidden_accounts (
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES usali_accounts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, account_id)
);

ALTER TABLE property_hidden_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pha_select" ON property_hidden_accounts
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD')
  );

CREATE POLICY "pha_admin" ON property_hidden_accounts
  FOR ALL TO authenticated USING (public.user_role() = 'ADMIN_CO')
  WITH CHECK (public.user_role() = 'ADMIN_CO');

-- Make department_id optional on expenses (USALI account provides department classification)
ALTER TABLE expenses ALTER COLUMN department_id DROP NOT NULL;
