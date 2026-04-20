-- Register three new permission keys
INSERT INTO permissions (key, module, label, description, sort_order) VALUES
  ('opreport.view',             'opreport', 'Преглед на Операционен P&L',
   'Достъп до табовете Бюджет и Отчет', 300),
  ('opreport.edit_budget',      'opreport', 'Редакция на бюджет',
   'Въвеждане и запис на бюджетни стойности', 301),
  ('opreport.manage_template',  'opreport', 'Управление на шаблон',
   'Промяна на структурата на отчета (бъдещо)', 302)
ON CONFLICT (key) DO NOTHING;

-- Default grants: CO roles get view + edit; only ADMIN_CO manages template
INSERT INTO role_permissions (role_key, permission_key, granted) VALUES
  ('ADMIN_CO',   'opreport.view',            true),
  ('ADMIN_CO',   'opreport.edit_budget',     true),
  ('ADMIN_CO',   'opreport.manage_template', true),
  ('FINANCE_CO', 'opreport.view',            true),
  ('FINANCE_CO', 'opreport.edit_budget',     true),
  ('FINANCE_CO', 'opreport.manage_template', false),
  ('MANAGER',    'opreport.view',            false),
  ('MANAGER',    'opreport.edit_budget',     false),
  ('MANAGER',    'opreport.manage_template', false),
  ('DEPT_HEAD',  'opreport.view',            false),
  ('DEPT_HEAD',  'opreport.edit_budget',     false),
  ('DEPT_HEAD',  'opreport.manage_template', false)
ON CONFLICT (role_key, permission_key) DO NOTHING;
