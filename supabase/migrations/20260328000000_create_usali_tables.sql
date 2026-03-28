-- USALI Integration Migration
-- Creates department templates, chart of accounts, budgets, property statistics
-- Migrates expenses.category and income_entries.income_category to account_id

-- ============================================================
-- 1. USALI DEPARTMENT TEMPLATES
-- ============================================================
CREATE TABLE usali_department_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('OPERATED', 'UNDISTRIBUTED', 'FIXED')),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO usali_department_templates (code, name, category, sort_order) VALUES
  ('ROOMS',           'Стаи',                   'OPERATED',       10),
  ('FB',              'Храна и напитки',         'OPERATED',       20),
  ('SPA',             'Спа и уелнес',            'OPERATED',       30),
  ('OTHER_OPERATED',  'Други оперативни',        'OPERATED',       40),
  ('AG',              'Администрация',           'UNDISTRIBUTED',  50),
  ('SALES_MARKETING', 'Маркетинг и продажби',    'UNDISTRIBUTED',  60),
  ('POMEC',           'Поддръжка',               'UNDISTRIBUTED',  70),
  ('UTILITIES',       'Комунални',               'UNDISTRIBUTED',  80),
  ('IT',              'ИТ и телекомуникации',     'UNDISTRIBUTED',  90),
  ('MGMT_FEES',       'Управленска такса',        'FIXED',         100),
  ('INSURANCE',       'Застраховки',             'FIXED',         110),
  ('TAXES',           'Данъци и такси',           'FIXED',         120);

-- ============================================================
-- 2. USALI ACCOUNTS (3-level chart of accounts)
-- ============================================================
CREATE TABLE usali_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('REVENUE', 'EXPENSE')),
  level int NOT NULL CHECK (level BETWEEN 1 AND 3),
  parent_id uuid REFERENCES usali_accounts(id),
  template_id uuid NOT NULL REFERENCES usali_department_templates(id),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_usali_accounts_template ON usali_accounts (template_id);
CREATE INDEX idx_usali_accounts_parent ON usali_accounts (parent_id);

-- Seed chart of accounts using DO block for parent references
DO $$
DECLARE
  t_rooms uuid;
  t_fb uuid;
  t_spa uuid;
  t_ag uuid;
  t_sm uuid;
  t_pomec uuid;
  t_util uuid;
  t_it uuid;
  t_mgmt uuid;
  t_ins uuid;
  t_tax uuid;
  -- Level 1 parent IDs
  p_1000 uuid; p_2000 uuid; p_3000 uuid; p_4000 uuid;
  p_5000 uuid; p_6000 uuid; p_7000 uuid; p_7500 uuid;
  p_8000 uuid; p_8500 uuid; p_8700 uuid;
  p_9000 uuid; p_9200 uuid; p_9400 uuid;
  -- Level 2 parent IDs
  p_1100 uuid; p_1200 uuid; p_2100 uuid; p_2200 uuid;
  p_3100 uuid; p_3200 uuid; p_3300 uuid; p_4100 uuid; p_4200 uuid; p_4300 uuid;
  p_5100 uuid; p_6100 uuid; p_6200 uuid;
  p_7100 uuid; p_7200 uuid; p_7510 uuid; p_7520 uuid;
  p_8100 uuid; p_8200 uuid; p_8510 uuid; p_8520 uuid; p_8530 uuid;
  p_8710 uuid; p_8720 uuid;
  p_9010 uuid; p_9210 uuid; p_9410 uuid;
BEGIN
  -- Get template IDs
  SELECT id INTO t_rooms FROM usali_department_templates WHERE code = 'ROOMS';
  SELECT id INTO t_fb FROM usali_department_templates WHERE code = 'FB';
  SELECT id INTO t_spa FROM usali_department_templates WHERE code = 'SPA';
  SELECT id INTO t_ag FROM usali_department_templates WHERE code = 'AG';
  SELECT id INTO t_sm FROM usali_department_templates WHERE code = 'SALES_MARKETING';
  SELECT id INTO t_pomec FROM usali_department_templates WHERE code = 'POMEC';
  SELECT id INTO t_util FROM usali_department_templates WHERE code = 'UTILITIES';
  SELECT id INTO t_it FROM usali_department_templates WHERE code = 'IT';
  SELECT id INTO t_mgmt FROM usali_department_templates WHERE code = 'MGMT_FEES';
  SELECT id INTO t_ins FROM usali_department_templates WHERE code = 'INSURANCE';
  SELECT id INTO t_tax FROM usali_department_templates WHERE code = 'TAXES';

  -- ========== ROOMS ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('1000', 'Приходи от стаи', 'REVENUE', 1, NULL, t_rooms, 1000) RETURNING id INTO p_1000;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('2000', 'Разходи стаи', 'EXPENSE', 1, NULL, t_rooms, 2000) RETURNING id INTO p_2000;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('1100', 'Нощувки', 'REVENUE', 2, p_1000, t_rooms, 1100) RETURNING id INTO p_1100;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('1200', 'Допълнителни услуги', 'REVENUE', 2, p_1000, t_rooms, 1200) RETURNING id INTO p_1200;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('2100', 'Персонал стаи', 'EXPENSE', 2, p_2000, t_rooms, 2100) RETURNING id INTO p_2100;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('2200', 'Оперативни стаи', 'EXPENSE', 2, p_2000, t_rooms, 2200) RETURNING id INTO p_2200;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('1101', 'Стаи', 'REVENUE', 3, p_1100, t_rooms, 1101),
    ('1102', 'Късно напускане / Ранно настаняване', 'REVENUE', 3, p_1100, t_rooms, 1102),
    ('1201', 'Мини-бар', 'REVENUE', 3, p_1200, t_rooms, 1201),
    ('1202', 'Пералня / Химическо чистене', 'REVENUE', 3, p_1200, t_rooms, 1202),
    ('2101', 'Заплати стаи', 'EXPENSE', 3, p_2100, t_rooms, 2101),
    ('2102', 'Осигуровки стаи', 'EXPENSE', 3, p_2100, t_rooms, 2102),
    ('2201', 'Консумативи стаи', 'EXPENSE', 3, p_2200, t_rooms, 2201),
    ('2202', 'Пералня', 'EXPENSE', 3, p_2200, t_rooms, 2202),
    ('2203', 'Декорация / Цветя', 'EXPENSE', 3, p_2200, t_rooms, 2203);

  -- ========== F&B ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('3000', 'Приходи F&B', 'REVENUE', 1, NULL, t_fb, 3000) RETURNING id INTO p_3000;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('4000', 'Разходи F&B', 'EXPENSE', 1, NULL, t_fb, 4000) RETURNING id INTO p_4000;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('3100', 'Ресторант', 'REVENUE', 2, p_3000, t_fb, 3100) RETURNING id INTO p_3100;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('3200', 'Бар', 'REVENUE', 2, p_3000, t_fb, 3200) RETURNING id INTO p_3200;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('3300', 'Банкети / Събития', 'REVENUE', 2, p_3000, t_fb, 3300) RETURNING id INTO p_3300;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('4100', 'Персонал F&B', 'EXPENSE', 2, p_4000, t_fb, 4100) RETURNING id INTO p_4100;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('4200', 'Себестойност F&B', 'EXPENSE', 2, p_4000, t_fb, 4200) RETURNING id INTO p_4200;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('4300', 'Оперативни F&B', 'EXPENSE', 2, p_4000, t_fb, 4300) RETURNING id INTO p_4300;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('3101', 'Храна', 'REVENUE', 3, p_3100, t_fb, 3101),
    ('3102', 'Напитки ресторант', 'REVENUE', 3, p_3100, t_fb, 3102),
    ('3201', 'Напитки бар', 'REVENUE', 3, p_3200, t_fb, 3201),
    ('3301', 'Банкети', 'REVENUE', 3, p_3300, t_fb, 3301),
    ('4101', 'Заплати F&B', 'EXPENSE', 3, p_4100, t_fb, 4101),
    ('4102', 'Осигуровки F&B', 'EXPENSE', 3, p_4100, t_fb, 4102),
    ('4201', 'Хранителни продукти', 'EXPENSE', 3, p_4200, t_fb, 4201),
    ('4202', 'Напитки (себестойност)', 'EXPENSE', 3, p_4200, t_fb, 4202),
    ('4301', 'Прибори / Посуда', 'EXPENSE', 3, p_4300, t_fb, 4301),
    ('4302', 'Декорация F&B', 'EXPENSE', 3, p_4300, t_fb, 4302);

  -- ========== SPA ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('5000', 'Приходи Spa', 'REVENUE', 1, NULL, t_spa, 5000) RETURNING id INTO p_5000;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('6000', 'Разходи Spa', 'EXPENSE', 1, NULL, t_spa, 6000) RETURNING id INTO p_6000;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('5100', 'Услуги Spa', 'REVENUE', 2, p_5000, t_spa, 5100) RETURNING id INTO p_5100;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('6100', 'Персонал Spa', 'EXPENSE', 2, p_6000, t_spa, 6100) RETURNING id INTO p_6100;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('6200', 'Оперативни Spa', 'EXPENSE', 2, p_6000, t_spa, 6200) RETURNING id INTO p_6200;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('5101', 'Процедури', 'REVENUE', 3, p_5100, t_spa, 5101),
    ('5102', 'Фитнес / Басейн', 'REVENUE', 3, p_5100, t_spa, 5102),
    ('6101', 'Заплати Spa', 'EXPENSE', 3, p_6100, t_spa, 6101),
    ('6102', 'Осигуровки Spa', 'EXPENSE', 3, p_6100, t_spa, 6102),
    ('6201', 'Козметика / Препарати', 'EXPENSE', 3, p_6200, t_spa, 6201),
    ('6202', 'Консумативи Spa', 'EXPENSE', 3, p_6200, t_spa, 6202);

  -- ========== A&G ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('7000', 'Разходи администрация', 'EXPENSE', 1, NULL, t_ag, 7000) RETURNING id INTO p_7000;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('7100', 'Персонал администрация', 'EXPENSE', 2, p_7000, t_ag, 7100) RETURNING id INTO p_7100;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('7200', 'Оперативни администрация', 'EXPENSE', 2, p_7000, t_ag, 7200) RETURNING id INTO p_7200;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('7101', 'Заплати администрация', 'EXPENSE', 3, p_7100, t_ag, 7101),
    ('7102', 'Осигуровки администрация', 'EXPENSE', 3, p_7100, t_ag, 7102),
    ('7201', 'Счетоводство', 'EXPENSE', 3, p_7200, t_ag, 7201),
    ('7202', 'Юридически услуги', 'EXPENSE', 3, p_7200, t_ag, 7202),
    ('7203', 'Офис консумативи', 'EXPENSE', 3, p_7200, t_ag, 7203),
    ('7204', 'Банкови такси', 'EXPENSE', 3, p_7200, t_ag, 7204);

  -- ========== SALES & MARKETING ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('7500', 'Разходи маркетинг', 'EXPENSE', 1, NULL, t_sm, 7500) RETURNING id INTO p_7500;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('7510', 'Персонал маркетинг', 'EXPENSE', 2, p_7500, t_sm, 7510) RETURNING id INTO p_7510;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('7520', 'Оперативни маркетинг', 'EXPENSE', 2, p_7500, t_sm, 7520) RETURNING id INTO p_7520;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('7511', 'Заплати маркетинг', 'EXPENSE', 3, p_7510, t_sm, 7511),
    ('7521', 'Реклама', 'EXPENSE', 3, p_7520, t_sm, 7521),
    ('7522', 'Комисионни OTA', 'EXPENSE', 3, p_7520, t_sm, 7522),
    ('7523', 'Представителни разходи', 'EXPENSE', 3, p_7520, t_sm, 7523);

  -- ========== POMEC ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('8000', 'Разходи поддръжка', 'EXPENSE', 1, NULL, t_pomec, 8000) RETURNING id INTO p_8000;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('8100', 'Персонал поддръжка', 'EXPENSE', 2, p_8000, t_pomec, 8100) RETURNING id INTO p_8100;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('8200', 'Оперативни поддръжка', 'EXPENSE', 2, p_8000, t_pomec, 8200) RETURNING id INTO p_8200;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('8101', 'Заплати поддръжка', 'EXPENSE', 3, p_8100, t_pomec, 8101),
    ('8201', 'Ремонти сграда', 'EXPENSE', 3, p_8200, t_pomec, 8201),
    ('8202', 'Ремонти оборудване', 'EXPENSE', 3, p_8200, t_pomec, 8202),
    ('8203', 'Резервни части', 'EXPENSE', 3, p_8200, t_pomec, 8203);

  -- ========== UTILITIES ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('8500', 'Разходи комунални', 'EXPENSE', 1, NULL, t_util, 8500) RETURNING id INTO p_8500;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('8510', 'Електричество', 'EXPENSE', 2, p_8500, t_util, 8510) RETURNING id INTO p_8510;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('8520', 'Вода', 'EXPENSE', 2, p_8500, t_util, 8520) RETURNING id INTO p_8520;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('8530', 'Отопление', 'EXPENSE', 2, p_8500, t_util, 8530) RETURNING id INTO p_8530;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('8511', 'Ел. енергия', 'EXPENSE', 3, p_8510, t_util, 8511),
    ('8521', 'ВиК', 'EXPENSE', 3, p_8520, t_util, 8521),
    ('8531', 'Газ / Гориво', 'EXPENSE', 3, p_8530, t_util, 8531);

  -- ========== IT ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('8700', 'Разходи ИТ', 'EXPENSE', 1, NULL, t_it, 8700) RETURNING id INTO p_8700;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('8710', 'Персонал ИТ', 'EXPENSE', 2, p_8700, t_it, 8710) RETURNING id INTO p_8710;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('8720', 'Оперативни ИТ', 'EXPENSE', 2, p_8700, t_it, 8720) RETURNING id INTO p_8720;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('8711', 'Заплати ИТ', 'EXPENSE', 3, p_8710, t_it, 8711),
    ('8721', 'Софтуер и лицензи', 'EXPENSE', 3, p_8720, t_it, 8721),
    ('8722', 'Хардуер', 'EXPENSE', 3, p_8720, t_it, 8722),
    ('8723', 'Телекомуникации', 'EXPENSE', 3, p_8720, t_it, 8723);

  -- ========== MANAGEMENT FEES ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('9000', 'Управленска такса', 'EXPENSE', 1, NULL, t_mgmt, 9000) RETURNING id INTO p_9000;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('9010', 'Управленска такса', 'EXPENSE', 2, p_9000, t_mgmt, 9010) RETURNING id INTO p_9010;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('9011', 'Управленска такса', 'EXPENSE', 3, p_9010, t_mgmt, 9011);

  -- ========== INSURANCE ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('9200', 'Застраховки', 'EXPENSE', 1, NULL, t_ins, 9200) RETURNING id INTO p_9200;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('9210', 'Имуществени застраховки', 'EXPENSE', 2, p_9200, t_ins, 9210) RETURNING id INTO p_9210;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('9211', 'Застраховка сгради', 'EXPENSE', 3, p_9210, t_ins, 9211),
    ('9212', 'Застраховка оборудване', 'EXPENSE', 3, p_9210, t_ins, 9212);

  -- ========== TAXES ==========
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('9400', 'Данъци и такси', 'EXPENSE', 1, NULL, t_tax, 9400) RETURNING id INTO p_9400;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('9410', 'Местни данъци', 'EXPENSE', 2, p_9400, t_tax, 9410) RETURNING id INTO p_9410;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order) VALUES
    ('9411', 'Данък сгради', 'EXPENSE', 3, p_9410, t_tax, 9411),
    ('9412', 'Такса смет', 'EXPENSE', 3, p_9410, t_tax, 9412),
    ('9413', 'Туристически данък', 'EXPENSE', 3, p_9410, t_tax, 9413);
END $$;

-- ============================================================
-- 3. USALI BUDGETS
-- ============================================================
CREATE TABLE usali_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  account_id uuid NOT NULL REFERENCES usali_accounts(id),
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount decimal(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, account_id, year, month)
);

CREATE INDEX idx_usali_budgets_lookup ON usali_budgets (property_id, year, month);

-- ============================================================
-- 4. PROPERTY STATISTICS (for PMS / Revenue Analysis)
-- ============================================================
CREATE TABLE property_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id),
  date date NOT NULL,
  rooms_available int NOT NULL DEFAULT 0,
  rooms_sold int NOT NULL DEFAULT 0,
  guests int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id, date)
);

-- ============================================================
-- 5. ALTER EXISTING TABLES
-- ============================================================
ALTER TABLE departments ADD COLUMN usali_template_id uuid REFERENCES usali_department_templates(id);
ALTER TABLE expenses ADD COLUMN account_id uuid REFERENCES usali_accounts(id);
ALTER TABLE income_entries ADD COLUMN account_id uuid REFERENCES usali_accounts(id);

-- ============================================================
-- 6. MIGRATE EXISTING DATA
-- ============================================================
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '2201') WHERE category = 'CONSUMABLES';
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '2101') WHERE category = 'SALARIES';
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '4201') WHERE category = 'FOOD_KITCHEN';
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '8531') WHERE category = 'FUEL';
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '9411') WHERE category = 'TAXES_FEES';
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '8201') WHERE category = 'MAINTENANCE';
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '8511') WHERE category = 'UTILITIES';
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '7521') WHERE category = 'MARKETING';
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '9211') WHERE category = 'INSURANCE';
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '7201') WHERE category = 'ACCOUNTING';
UPDATE expenses SET account_id = (SELECT id FROM usali_accounts WHERE code = '7203') WHERE category = 'OTHER';

UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '1101') WHERE income_category = 'ACCOMMODATION';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '3101') WHERE income_category = 'FB';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '5101') WHERE income_category = 'SPA';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '7204') WHERE income_category = 'FEES';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '7522') WHERE income_category = 'COMMISSIONS';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '1201') WHERE income_category = 'OTHER';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '1101') WHERE account_id IS NULL;

-- ============================================================
-- 7. MAKE account_id NOT NULL, DROP old columns
-- ============================================================
ALTER TABLE expenses ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE income_entries ALTER COLUMN account_id SET NOT NULL;

ALTER TABLE expenses DROP COLUMN category;
ALTER TABLE income_entries DROP COLUMN income_category;
ALTER TABLE income_entries DROP CONSTRAINT IF EXISTS chk_income_category;

CREATE INDEX idx_expenses_account ON expenses (account_id);
CREATE INDEX idx_income_entries_account ON income_entries (account_id);

-- ============================================================
-- 8. RLS POLICIES
-- ============================================================
ALTER TABLE usali_department_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE usali_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE usali_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usali_templates_select" ON usali_department_templates
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD')
  );
CREATE POLICY "usali_templates_admin" ON usali_department_templates
  FOR ALL TO authenticated USING (public.user_role() = 'ADMIN_CO')
  WITH CHECK (public.user_role() = 'ADMIN_CO');

CREATE POLICY "usali_accounts_select" ON usali_accounts
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD')
  );
CREATE POLICY "usali_accounts_admin" ON usali_accounts
  FOR ALL TO authenticated USING (public.user_role() = 'ADMIN_CO')
  WITH CHECK (public.user_role() = 'ADMIN_CO');

CREATE POLICY "usali_budgets_select" ON usali_budgets
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
    OR public.has_property_access(property_id)
  );
CREATE POLICY "usali_budgets_modify" ON usali_budgets
  FOR ALL TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
  ) WITH CHECK (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
  );

CREATE POLICY "property_stats_select" ON property_statistics
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
    OR public.has_property_access(property_id)
  );
CREATE POLICY "property_stats_modify" ON property_statistics
  FOR ALL TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
  ) WITH CHECK (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO')
  );
