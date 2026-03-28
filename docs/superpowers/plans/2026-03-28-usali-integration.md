# USALI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate USALI standards into the hotel finance system — chart of accounts, department templates, category migration, and three USALI reports.

**Architecture:** New migration adds `usali_department_templates`, `usali_accounts`, `usali_budgets`, and `property_statistics` tables with seed data. Existing `expenses` and `income_entries` gain `account_id` FK replacing old `category` enum. Three report API endpoints aggregate data by USALI structure. New UI pages for chart of accounts management and USALI reports.

**Tech Stack:** PostgreSQL/Supabase, Next.js 16 App Router, TypeScript, Zod, shadcn/ui

---

## File Structure

### New files
- `supabase/migrations/20260328000000_create_usali_tables.sql` — New tables, seed data, alter existing tables, migrate data, RLS
- `types/finance.ts` — Add new types, modify Expense/IncomeEntry, remove old category enums
- `lib/finance/schemas/usali.ts` — Zod schemas for account and budget CRUD
- `lib/finance/schemas/expense.ts` — Replace `category` with `account_id`
- `lib/finance/schemas/income.ts` — Replace `income_category` with `account_id`
- `app/api/finance/usali-templates/route.ts` — GET list templates
- `app/api/finance/usali-templates/[id]/route.ts` — PATCH toggle active
- `app/api/finance/usali-accounts/route.ts` — GET list + POST create
- `app/api/finance/usali-accounts/[id]/route.ts` — PATCH update
- `app/api/finance/usali-budgets/route.ts` — GET list + POST upsert
- `app/api/finance/usali-reports/departmental/route.ts` — Departmental Income Statement
- `app/api/finance/usali-reports/summary/route.ts` — Summary Operating Statement (GOP/NOI)
- `app/api/finance/usali-reports/revenue-analysis/route.ts` — Revenue Analysis KPIs
- `app/api/finance/property-statistics/route.ts` — GET + POST
- `app/(finance)/finance/chart-of-accounts/page.tsx` — Chart of accounts management page
- `components/finance/ChartOfAccountsTree.tsx` — Tree-view component for accounts
- `components/finance/AccountForm.tsx` — Form for creating/editing accounts
- `components/finance/DepartmentTemplates.tsx` — Template toggle management
- `app/(finance)/finance/usali-reports/page.tsx` — USALI reports page with 3 tabs
- `components/finance/UsaliDepartmentalReport.tsx` — Departmental Income Statement view
- `components/finance/UsaliSummaryReport.tsx` — GOP/NOI view
- `components/finance/UsaliRevenueAnalysis.tsx` — Revenue Analysis KPIs view

### Modified files
- `components/finance/FinanceSidebar.tsx` — Add USALI nav items
- `components/finance/ExpenseSpreadsheet.tsx` — Replace category with account picker
- `components/finance/IncomeSpreadsheet.tsx` — Replace category with account picker
- `app/(finance)/finance/expenses/page.tsx` — Fetch accounts for picker
- `app/(finance)/finance/income/page.tsx` — Fetch accounts for picker
- `app/api/finance/expenses/route.ts` — Update query/insert for account_id
- `app/api/finance/income/route.ts` — Update query/insert for account_id

---

### Task 1: Database Migration — New Tables + Seed Data

**Files:**
- Create: `supabase/migrations/20260328000000_create_usali_tables.sql`

This is the foundation. Creates all new tables, seeds department templates and chart of accounts, alters existing tables, migrates data, and adds RLS policies.

- [ ] **Step 1: Create the migration file with USALI tables and seed data**

```sql
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

-- Seed chart of accounts using CTEs for template IDs
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
  -- Level 1
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('1000', 'Приходи от стаи', 'REVENUE', 1, NULL, t_rooms, 1000) RETURNING id INTO p_1000;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('2000', 'Разходи стаи', 'EXPENSE', 1, NULL, t_rooms, 2000) RETURNING id INTO p_2000;
  -- Level 2
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('1100', 'Нощувки', 'REVENUE', 2, p_1000, t_rooms, 1100) RETURNING id INTO p_1100;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('1200', 'Допълнителни услуги', 'REVENUE', 2, p_1000, t_rooms, 1200) RETURNING id INTO p_1200;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('2100', 'Персонал стаи', 'EXPENSE', 2, p_2000, t_rooms, 2100) RETURNING id INTO p_2100;
  INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
    VALUES ('2200', 'Оперативни стаи', 'EXPENSE', 2, p_2000, t_rooms, 2200) RETURNING id INTO p_2200;
  -- Level 3
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

-- departments: link to USALI template
ALTER TABLE departments ADD COLUMN usali_template_id uuid REFERENCES usali_department_templates(id);

-- expenses: add account_id (nullable first for migration)
ALTER TABLE expenses ADD COLUMN account_id uuid REFERENCES usali_accounts(id);

-- income_entries: add account_id (nullable first for migration)
ALTER TABLE income_entries ADD COLUMN account_id uuid REFERENCES usali_accounts(id);

-- ============================================================
-- 6. MIGRATE EXISTING DATA
-- ============================================================

-- Map expense categories to account codes
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

-- Map income categories to account codes
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '1101') WHERE income_category = 'ACCOMMODATION';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '3101') WHERE income_category = 'FB';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '5101') WHERE income_category = 'SPA';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '7204') WHERE income_category = 'FEES';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '7522') WHERE income_category = 'COMMISSIONS';
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '1201') WHERE income_category = 'OTHER';
-- For CF_CREDIT/CF_TRANSFER types that have no income_category, default to 1101
UPDATE income_entries SET account_id = (SELECT id FROM usali_accounts WHERE code = '1101') WHERE account_id IS NULL;

-- ============================================================
-- 7. MAKE account_id NOT NULL, DROP old columns
-- ============================================================
ALTER TABLE expenses ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE income_entries ALTER COLUMN account_id SET NOT NULL;

-- Drop old category columns and their CHECK constraints
ALTER TABLE expenses DROP COLUMN category;
ALTER TABLE income_entries DROP COLUMN income_category;

-- Remove the CHECK constraint that required income_category for INC_* types
ALTER TABLE income_entries DROP CONSTRAINT IF EXISTS chk_income_category;

-- Add index for account_id lookups
CREATE INDEX idx_expenses_account ON expenses (account_id);
CREATE INDEX idx_income_entries_account ON income_entries (account_id);

-- ============================================================
-- 8. RLS POLICIES
-- ============================================================
ALTER TABLE usali_department_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE usali_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE usali_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_statistics ENABLE ROW LEVEL SECURITY;

-- Templates: all finance users can read, only ADMIN_CO can modify
CREATE POLICY "usali_templates_select" ON usali_department_templates
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD')
  );
CREATE POLICY "usali_templates_admin" ON usali_department_templates
  FOR ALL TO authenticated USING (public.user_role() = 'ADMIN_CO')
  WITH CHECK (public.user_role() = 'ADMIN_CO');

-- Accounts: all finance users can read, only ADMIN_CO can modify
CREATE POLICY "usali_accounts_select" ON usali_accounts
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('ADMIN_CO', 'FINANCE_CO', 'MANAGER', 'DEPT_HEAD')
  );
CREATE POLICY "usali_accounts_admin" ON usali_accounts
  FOR ALL TO authenticated USING (public.user_role() = 'ADMIN_CO')
  WITH CHECK (public.user_role() = 'ADMIN_CO');

-- Budgets: read by property access, modify by CO roles
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

-- Property statistics: read by property access, modify by CO
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
```

- [ ] **Step 2: Verify migration applies cleanly**

Run: `npx supabase db reset` (or apply migration via Supabase dashboard)
Expected: No errors, all tables created, seed data inserted, existing data migrated.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260328000000_create_usali_tables.sql
git commit -m "feat: add USALI tables, seed chart of accounts, migrate categories"
```

---

### Task 2: TypeScript Types and Zod Schemas

**Files:**
- Modify: `types/finance.ts`
- Modify: `lib/finance/schemas/expense.ts`
- Modify: `lib/finance/schemas/income.ts`
- Create: `lib/finance/schemas/usali.ts`

- [ ] **Step 1: Update types/finance.ts — Add new types**

Add after the existing enum section (after line ~97):

```typescript
// USALI types
export type UsaliDepartmentCategory = 'OPERATED' | 'UNDISTRIBUTED' | 'FIXED'
export type UsaliAccountType = 'REVENUE' | 'EXPENSE'
```

Add after the existing interfaces section (before View Types around line ~513):

```typescript
export interface UsaliDepartmentTemplate {
  id: string
  code: string
  name: string
  category: UsaliDepartmentCategory
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UsaliAccount {
  id: string
  code: string
  name: string
  account_type: UsaliAccountType
  level: number
  parent_id: string | null
  template_id: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface UsaliBudget {
  id: string
  property_id: string
  account_id: string
  year: number
  month: number
  amount: number
  created_at: string
  updated_at: string
}

export interface PropertyStatistics {
  id: string
  property_id: string
  date: string
  rooms_available: number
  rooms_sold: number
  guests: number
  created_at: string
}
```

- [ ] **Step 2: Update types/finance.ts — Modify existing types**

Remove the `ExpenseCategory` type definition entirely:
```typescript
// DELETE this:
export type ExpenseCategory =
  | 'CONSUMABLES' | 'SALARIES' | 'FOOD_KITCHEN' | 'FUEL' | 'TAXES_FEES'
  | 'MAINTENANCE' | 'UTILITIES' | 'MARKETING' | 'INSURANCE' | 'ACCOUNTING' | 'OTHER'
```

Remove the `IncomeCategory` type definition entirely:
```typescript
// DELETE this:
export type IncomeCategory =
  | 'ACCOMMODATION' | 'FB' | 'SPA' | 'FEES' | 'COMMISSIONS' | 'OTHER'
```

In the `Expense` interface, replace `category: ExpenseCategory` with `account_id: string`:
```typescript
export interface Expense {
  id: string
  property_id: string
  department_id: string
  account_id: string          // was: category: ExpenseCategory
  supplier: string
  // ... rest stays the same
}
```

In the `IncomeEntry` interface, replace `income_category: IncomeCategory | null` with `account_id: string`:
```typescript
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
  account_id: string           // was: income_category: IncomeCategory | null
  is_advance_realized: boolean
  status: IncomeEntryStatus
  created_by_id: string
  created_at: string
  updated_at: string
}
```

In the `Department` interface, add `usali_template_id`:
```typescript
export interface Department {
  id: string
  property_id: string
  name: string
  manager_id: string
  authorized_person_id: string | null
  fiscal_device_id: string | null
  usali_template_id: string | null   // NEW
  status: ActiveStatus
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Update lib/finance/schemas/expense.ts — Replace category with account_id**

Replace the full file content:

```typescript
import { z } from 'zod'

const expenseBaseSchema = z.object({
  property_id: z.string().uuid(),
  department_id: z.string().uuid(),
  account_id: z.string().uuid(),
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

- [ ] **Step 4: Update lib/finance/schemas/income.ts — Replace income_category with account_id**

Replace the full file content:

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
  account_id: z.string().uuid(),
}).refine(
  (data) => data.type !== 'CF_CREDIT' || data.loan_id != null,
  { message: 'Кредит е задължителен при CF_CREDIT', path: ['loan_id'] }
)

export const realizeAdvanceSchema = z.object({
  income_entry_id: z.string().uuid(),
})
```

- [ ] **Step 5: Create lib/finance/schemas/usali.ts**

```typescript
import { z } from 'zod'

export const createUsaliAccountSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(200),
  account_type: z.enum(['REVENUE', 'EXPENSE']),
  level: z.number().int().min(1).max(3),
  parent_id: z.string().uuid().nullable(),
  template_id: z.string().uuid(),
  sort_order: z.number().int().default(0),
})

export const updateUsaliAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
})

export const upsertBudgetSchema = z.object({
  property_id: z.string().uuid(),
  account_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z.number().min(0),
})

export const createPropertyStatisticsSchema = z.object({
  property_id: z.string().uuid(),
  date: z.string().date(),
  rooms_available: z.number().int().min(0),
  rooms_sold: z.number().int().min(0),
  guests: z.number().int().min(0),
})
```

- [ ] **Step 6: Update lib/finance/schemas/index.ts to export new schemas**

Add to the existing exports:

```typescript
export { createUsaliAccountSchema, updateUsaliAccountSchema, upsertBudgetSchema, createPropertyStatisticsSchema } from './usali'
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: Build may show errors in components that reference `ExpenseCategory` or `IncomeCategory` — these are fixed in later tasks. At minimum, verify the schema files compile correctly.

- [ ] **Step 8: Commit**

```bash
git add types/finance.ts lib/finance/schemas/expense.ts lib/finance/schemas/income.ts lib/finance/schemas/usali.ts lib/finance/schemas/index.ts
git commit -m "feat: update types and schemas for USALI accounts"
```

---

### Task 3: USALI API Routes — Templates & Accounts

**Files:**
- Create: `app/api/finance/usali-templates/route.ts`
- Create: `app/api/finance/usali-templates/[id]/route.ts`
- Create: `app/api/finance/usali-accounts/route.ts`
- Create: `app/api/finance/usali-accounts/[id]/route.ts`

- [ ] **Step 1: Create usali-templates GET route**

Create `app/api/finance/usali-templates/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export async function GET() {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usali_department_templates')
    .select('*')
    .order('sort_order')

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Create usali-templates PATCH route**

Create `app/api/finance/usali-templates/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (user.realRole !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { is_active } = body

  if (typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'validation_error' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usali_department_templates')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 3: Create usali-accounts GET + POST route**

Create `app/api/finance/usali-accounts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { createUsaliAccountSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const templateId = searchParams.get('template_id')
  const accountType = searchParams.get('account_type')
  const level = searchParams.get('level')
  const activeOnly = searchParams.get('active_only') !== 'false'

  let query = supabase
    .from('usali_accounts')
    .select('*, usali_department_templates(code, name, category)')
    .order('sort_order')

  if (activeOnly) {
    query = query.eq('is_active', true)
  }
  if (templateId) {
    query = query.eq('template_id', templateId)
  }
  if (accountType) {
    query = query.eq('account_type', accountType)
  }
  if (level) {
    query = query.eq('level', parseInt(level))
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (user.realRole !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createUsaliAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usali_accounts')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Код на сметката вече съществува' }, { status: 409 })
    }
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Create usali-accounts PATCH route**

Create `app/api/finance/usali-accounts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { updateUsaliAccountSchema } from '@/lib/finance/schemas'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (user.realRole !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const parsed = updateUsaliAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usali_accounts')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/finance/usali-templates/ app/api/finance/usali-accounts/
git commit -m "feat: add USALI templates and accounts API routes"
```

---

### Task 4: USALI API Routes — Budgets & Property Statistics

**Files:**
- Create: `app/api/finance/usali-budgets/route.ts`
- Create: `app/api/finance/property-statistics/route.ts`

- [ ] **Step 1: Create usali-budgets GET + POST route**

Create `app/api/finance/usali-budgets/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { upsertBudgetSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const propertyId = searchParams.get('property_id')
  const year = searchParams.get('year')

  if (!propertyId || !year) {
    return NextResponse.json({ error: 'property_id and year are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('usali_budgets')
    .select('*, usali_accounts(code, name)')
    .eq('property_id', propertyId)
    .eq('year', parseInt(year))
    .order('month')

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = upsertBudgetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usali_budgets')
    .upsert(parsed.data, {
      onConflict: 'property_id,account_id,year,month',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Create property-statistics GET + POST route**

Create `app/api/finance/property-statistics/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createPropertyStatisticsSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = request.nextUrl
  const propertyId = searchParams.get('property_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  if (!propertyId) {
    return NextResponse.json({ error: 'property_id is required' }, { status: 400 })
  }

  let query = supabase
    .from('property_statistics')
    .select('*')
    .eq('property_id', propertyId)
    .order('date', { ascending: false })

  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createPropertyStatisticsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('property_statistics')
    .upsert(parsed.data, {
      onConflict: 'property_id,date',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/finance/usali-budgets/ app/api/finance/property-statistics/
git commit -m "feat: add USALI budgets and property statistics API routes"
```

---

### Task 5: Update Expense & Income API Routes

**Files:**
- Modify: `app/api/finance/expenses/route.ts`
- Modify: `app/api/finance/income/route.ts`

- [ ] **Step 1: Update expenses route — replace category filter with account_id**

In `app/api/finance/expenses/route.ts`:

Replace the GET handler's `category` filter (lines 17-18 and 33-35):

Change:
```typescript
  const category = searchParams.get('category')
```
to:
```typescript
  const accountId = searchParams.get('account_id')
```

Change:
```typescript
  if (category) {
    query = query.eq('category', category)
  }
```
to:
```typescript
  if (accountId) {
    query = query.eq('account_id', accountId)
  }
```

Also update the select to join account info (line 23):
Change:
```typescript
    .select('*, departments(name), properties(name)')
```
to:
```typescript
    .select('*, departments(name), properties(name), usali_accounts(code, name)')
```

- [ ] **Step 2: Update income route — replace income_category filter with account_id**

In `app/api/finance/income/route.ts`:

Replace the GET handler's `incomeCategory` filter (line 18 and 48-50):

Change:
```typescript
  const incomeCategory = searchParams.get('income_category')
```
to:
```typescript
  const accountId = searchParams.get('account_id')
```

Change:
```typescript
  if (incomeCategory) {
    query = query.eq('income_category', incomeCategory)
  }
```
to:
```typescript
  if (accountId) {
    query = query.eq('account_id', accountId)
  }
```

Also update the select to join account info (line 22):
Change:
```typescript
    .select('*, properties(name)')
```
to:
```typescript
    .select('*, properties(name), usali_accounts(code, name)')
```

- [ ] **Step 3: Commit**

```bash
git add app/api/finance/expenses/route.ts app/api/finance/income/route.ts
git commit -m "feat: update expense/income API routes for USALI account_id"
```

---

### Task 6: USALI Reports API — Departmental Income Statement

**Files:**
- Create: `app/api/finance/usali-reports/departmental/route.ts`

- [ ] **Step 1: Create departmental report API**

Create `app/api/finance/usali-reports/departmental/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const propertyId = searchParams.get('property_id')
  const year = parseInt(searchParams.get('year') ?? '')
  const month = parseInt(searchParams.get('month') ?? '')

  if (!propertyId || !year || !month) {
    return NextResponse.json({ error: 'property_id, year, month required' }, { status: 400 })
  }

  const supabase = await createClient()
  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const dateTo = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  // Fetch all OPERATED templates
  const { data: templates } = await supabase
    .from('usali_department_templates')
    .select('*')
    .eq('category', 'OPERATED')
    .eq('is_active', true)
    .order('sort_order')

  // Fetch all accounts for OPERATED templates
  const { data: accounts } = await supabase
    .from('usali_accounts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  // Fetch revenue (income_entries) for the property/period
  const { data: incomeRows } = await supabase
    .from('income_entries')
    .select('account_id, amount')
    .eq('property_id', propertyId)
    .gte('entry_date', dateFrom)
    .lt('entry_date', dateTo)

  // Fetch expenses for the property/period
  const { data: expenseRows } = await supabase
    .from('expenses')
    .select('account_id, amount_net, vat_amount')
    .eq('property_id', propertyId)
    .gte('issue_date', dateFrom)
    .lt('issue_date', dateTo)
    .neq('status', 'REJECTED')

  // Fetch budgets for the period
  const { data: budgets } = await supabase
    .from('usali_budgets')
    .select('account_id, amount')
    .eq('property_id', propertyId)
    .eq('year', year)
    .eq('month', month)

  // Build lookup maps
  const accountMap = new Map((accounts ?? []).map(a => [a.id, a]))
  const budgetMap = new Map((budgets ?? []).map(b => [b.account_id, b.amount]))

  // Aggregate revenue by account
  const revByAccount = new Map<string, number>()
  for (const row of incomeRows ?? []) {
    revByAccount.set(row.account_id, (revByAccount.get(row.account_id) ?? 0) + Number(row.amount))
  }

  // Aggregate expenses by account
  const expByAccount = new Map<string, number>()
  for (const row of expenseRows ?? []) {
    const total = Number(row.amount_net) + Number(row.vat_amount)
    expByAccount.set(row.account_id, (expByAccount.get(row.account_id) ?? 0) + total)
  }

  // Helper: get level 2 accounts under a template, with level 3 amounts aggregated
  function getGroupedAmounts(templateId: string, type: 'REVENUE' | 'EXPENSE') {
    const amountMap = type === 'REVENUE' ? revByAccount : expByAccount
    const level2 = (accounts ?? []).filter(a => a.template_id === templateId && a.level === 2 && a.account_type === type)
    const groups = level2.map(l2 => {
      const children = (accounts ?? []).filter(a => a.parent_id === l2.id && a.level === 3)
      let amount = 0
      let budget = 0
      for (const child of children) {
        amount += amountMap.get(child.id) ?? 0
        budget += budgetMap.get(child.id) ?? 0
      }
      return { account: { code: l2.code, name: l2.name }, amount, budget }
    })
    const total = groups.reduce((s, g) => s + g.amount, 0)
    const totalBudget = groups.reduce((s, g) => s + g.budget, 0)
    return { groups, total, totalBudget }
  }

  // Build departmental report
  const departments = (templates ?? []).map(t => {
    const revenue = getGroupedAmounts(t.id, 'REVENUE')
    const expenses = getGroupedAmounts(t.id, 'EXPENSE')
    const profit = revenue.total - expenses.total
    const profitBudget = revenue.totalBudget - expenses.totalBudget
    const margin = revenue.total > 0 ? (profit / revenue.total) * 100 : 0

    return {
      template: { code: t.code, name: t.name },
      revenue,
      expenses,
      profit,
      profitBudget,
      margin,
    }
  })

  // Fetch property name
  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', propertyId)
    .single()

  return NextResponse.json({
    property: property ?? { id: propertyId, name: '' },
    period: { year, month },
    departments,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/finance/usali-reports/departmental/
git commit -m "feat: add USALI departmental income statement API"
```

---

### Task 7: USALI Reports API — Summary & Revenue Analysis

**Files:**
- Create: `app/api/finance/usali-reports/summary/route.ts`
- Create: `app/api/finance/usali-reports/revenue-analysis/route.ts`

- [ ] **Step 1: Create summary operating statement API**

Create `app/api/finance/usali-reports/summary/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const propertyId = searchParams.get('property_id')
  const year = parseInt(searchParams.get('year') ?? '')
  const month = parseInt(searchParams.get('month') ?? '')

  if (!propertyId || !year || !month) {
    return NextResponse.json({ error: 'property_id, year, month required' }, { status: 400 })
  }

  const supabase = await createClient()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`
  const yearStart = `${year}-01-01`

  // Fetch active templates
  const { data: templates } = await supabase
    .from('usali_department_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  // Fetch all active accounts
  const { data: accounts } = await supabase
    .from('usali_accounts')
    .select('*')
    .eq('is_active', true)
    .eq('level', 3)

  // Helper: aggregate amounts for a date range
  async function getAmounts(dateFrom: string, dateTo: string) {
    const [{ data: income }, { data: expenses }] = await Promise.all([
      supabase
        .from('income_entries')
        .select('account_id, amount')
        .eq('property_id', propertyId!)
        .gte('entry_date', dateFrom)
        .lt('entry_date', dateTo),
      supabase
        .from('expenses')
        .select('account_id, amount_net, vat_amount')
        .eq('property_id', propertyId!)
        .gte('issue_date', dateFrom)
        .lt('issue_date', dateTo)
        .neq('status', 'REJECTED'),
    ])

    const rev = new Map<string, number>()
    for (const r of income ?? []) {
      rev.set(r.account_id, (rev.get(r.account_id) ?? 0) + Number(r.amount))
    }
    const exp = new Map<string, number>()
    for (const e of expenses ?? []) {
      const total = Number(e.amount_net) + Number(e.vat_amount)
      exp.set(e.account_id, (exp.get(e.account_id) ?? 0) + total)
    }
    return { rev, exp }
  }

  const current = await getAmounts(monthStart, monthEnd)
  const ytd = await getAmounts(yearStart, monthEnd)

  // Helper: sum by template + type
  function sumForTemplate(templateId: string, type: 'REVENUE' | 'EXPENSE', amounts: { rev: Map<string, number>; exp: Map<string, number> }) {
    const map = type === 'REVENUE' ? amounts.rev : amounts.exp
    let total = 0
    for (const acc of accounts ?? []) {
      if (acc.template_id === templateId && acc.account_type === type) {
        total += map.get(acc.id) ?? 0
      }
    }
    return total
  }

  const operated = (templates ?? []).filter(t => t.category === 'OPERATED')
  const undistributed = (templates ?? []).filter(t => t.category === 'UNDISTRIBUTED')
  const fixed = (templates ?? []).filter(t => t.category === 'FIXED')

  // Operated departments: Revenue - Expenses = Profit
  const operatedDepartments = operated.map(t => ({
    template: { code: t.code, name: t.name },
    profit: sumForTemplate(t.id, 'REVENUE', current) - sumForTemplate(t.id, 'EXPENSE', current),
    profitYtd: sumForTemplate(t.id, 'REVENUE', ytd) - sumForTemplate(t.id, 'EXPENSE', ytd),
  }))

  const totalDeptProfit = operatedDepartments.reduce((s, d) => s + d.profit, 0)
  const totalDeptProfitYtd = operatedDepartments.reduce((s, d) => s + d.profitYtd, 0)

  // Undistributed expenses
  const undistributedItems = undistributed.map(t => ({
    template: { code: t.code, name: t.name },
    amount: sumForTemplate(t.id, 'EXPENSE', current),
    amountYtd: sumForTemplate(t.id, 'EXPENSE', ytd),
  }))

  const totalUndist = undistributedItems.reduce((s, d) => s + d.amount, 0)
  const totalUndistYtd = undistributedItems.reduce((s, d) => s + d.amountYtd, 0)

  const gop = totalDeptProfit - totalUndist
  const gopYtd = totalDeptProfitYtd - totalUndistYtd

  // Fixed charges
  const fixedCharges = fixed.map(t => ({
    template: { code: t.code, name: t.name },
    amount: sumForTemplate(t.id, 'EXPENSE', current),
    amountYtd: sumForTemplate(t.id, 'EXPENSE', ytd),
  }))

  const totalFixed = fixedCharges.reduce((s, d) => s + d.amount, 0)
  const totalFixedYtd = fixedCharges.reduce((s, d) => s + d.amountYtd, 0)

  const noi = gop - totalFixed
  const noiYtd = gopYtd - totalFixedYtd

  // Total revenue for percentages
  let totalRev = 0
  let totalRevYtd = 0
  for (const t of operated) {
    totalRev += sumForTemplate(t.id, 'REVENUE', current)
    totalRevYtd += sumForTemplate(t.id, 'REVENUE', ytd)
  }

  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', propertyId)
    .single()

  return NextResponse.json({
    property: property ?? { id: propertyId, name: '' },
    period: { year, month },
    operatedDepartments,
    totalDepartmentalProfit: totalDeptProfit,
    totalDepartmentalProfitYtd: totalDeptProfitYtd,
    undistributed: undistributedItems,
    totalUndistributed: totalUndist,
    totalUndistributedYtd: totalUndistYtd,
    gop,
    gopYtd,
    gopPercent: totalRev > 0 ? (gop / totalRev) * 100 : 0,
    gopPercentYtd: totalRevYtd > 0 ? (gopYtd / totalRevYtd) * 100 : 0,
    fixedCharges,
    totalFixed,
    totalFixedYtd,
    noi,
    noiYtd,
    noiPercent: totalRev > 0 ? (noi / totalRev) * 100 : 0,
    noiPercentYtd: totalRevYtd > 0 ? (noiYtd / totalRevYtd) * 100 : 0,
  })
}
```

- [ ] **Step 2: Create revenue analysis API**

Create `app/api/finance/usali-reports/revenue-analysis/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

interface KpiSet {
  roomsAvailable: number
  roomsSold: number
  guests: number
  occupancyPercent: number
  adr: number
  revpar: number
  totalRevenuePerRoom: number
  roomRevenue: number
  totalRevenue: number
}

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const propertyId = searchParams.get('property_id')
  const year = parseInt(searchParams.get('year') ?? '')
  const month = parseInt(searchParams.get('month') ?? '')

  if (!propertyId || !year || !month) {
    return NextResponse.json({ error: 'property_id, year, month required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get ROOMS template ID
  const { data: roomsTemplate } = await supabase
    .from('usali_department_templates')
    .select('id')
    .eq('code', 'ROOMS')
    .single()

  // Get all level 3 REVENUE accounts under ROOMS
  const roomsTemplateId = roomsTemplate?.id
  const { data: roomAccounts } = await supabase
    .from('usali_accounts')
    .select('id')
    .eq('template_id', roomsTemplateId ?? '')
    .eq('account_type', 'REVENUE')
    .eq('level', 3)
    .eq('is_active', true)

  const roomAccountIds = (roomAccounts ?? []).map(a => a.id)

  async function computeKpis(y: number, m: number): Promise<KpiSet | null> {
    const dateFrom = `${y}-${String(m).padStart(2, '0')}-01`
    const dateTo = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`

    // Property statistics
    const { data: stats } = await supabase
      .from('property_statistics')
      .select('rooms_available, rooms_sold, guests')
      .eq('property_id', propertyId!)
      .gte('date', dateFrom)
      .lt('date', dateTo)

    const roomsAvailable = (stats ?? []).reduce((s, r) => s + r.rooms_available, 0)
    const roomsSold = (stats ?? []).reduce((s, r) => s + r.rooms_sold, 0)
    const guests = (stats ?? []).reduce((s, r) => s + r.guests, 0)

    if (roomsAvailable === 0) return null

    // Room revenue
    let roomRevQuery = supabase
      .from('income_entries')
      .select('amount')
      .eq('property_id', propertyId!)
      .gte('entry_date', dateFrom)
      .lt('entry_date', dateTo)

    if (roomAccountIds.length > 0) {
      roomRevQuery = roomRevQuery.in('account_id', roomAccountIds)
    }

    const { data: roomRevRows } = await roomRevQuery
    const roomRevenue = (roomRevRows ?? []).reduce((s, r) => s + Number(r.amount), 0)

    // Total revenue (all income)
    const { data: totalRevRows } = await supabase
      .from('income_entries')
      .select('amount')
      .eq('property_id', propertyId!)
      .gte('entry_date', dateFrom)
      .lt('entry_date', dateTo)

    const totalRevenue = (totalRevRows ?? []).reduce((s, r) => s + Number(r.amount), 0)

    return {
      roomsAvailable,
      roomsSold,
      guests,
      occupancyPercent: (roomsSold / roomsAvailable) * 100,
      adr: roomsSold > 0 ? roomRevenue / roomsSold : 0,
      revpar: roomRevenue / roomsAvailable,
      totalRevenuePerRoom: totalRevenue / roomsAvailable,
      roomRevenue,
      totalRevenue,
    }
  }

  const current = await computeKpis(year, month)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevMonthYear = month === 1 ? year - 1 : year
  const previousMonth = await computeKpis(prevMonthYear, prevMonth)
  const previousYear = await computeKpis(year - 1, month)

  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', propertyId)
    .single()

  return NextResponse.json({
    property: property ?? { id: propertyId, name: '' },
    period: { year, month },
    current,
    previousMonth,
    previousYear,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/finance/usali-reports/
git commit -m "feat: add USALI summary and revenue analysis API routes"
```

---

### Task 8: Update Expense & Income Spreadsheets for account_id

**Files:**
- Modify: `components/finance/ExpenseSpreadsheet.tsx`
- Modify: `components/finance/IncomeSpreadsheet.tsx`
- Modify: `app/(finance)/finance/expenses/page.tsx`
- Modify: `app/(finance)/finance/income/page.tsx`

This task replaces the old category dropdowns with USALI account pickers in both spreadsheet components. The account picker shows level 3 accounts grouped by level 1/2 with visual indent.

- [ ] **Step 1: Update ExpenseSpreadsheet.tsx**

Key changes:
1. Replace `ExpenseCategory` import and `categoryLabels` with accounts prop
2. Replace the category `<select>` with an account `<select>` showing indented hierarchy
3. Replace `category` in form state and submit with `account_id`

In the imports, remove `ExpenseCategory` from the type import. Add a new prop for accounts:

```typescript
// Replace the type import line:
import type { Expense, DocumentType, PaymentMethod, ExpenseStatus } from '@/types/finance'

// Update ExpenseWithJoins:
export type ExpenseWithJoins = Expense & {
  departments: { name: string }
  properties: { name: string }
  usali_accounts: { code: string; name: string } | null
}

// Add account type to Props:
interface Props {
  expenses: ExpenseWithJoins[]
  properties: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string; property_id: string }>
  accounts: Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>
  userRole: string
  defaultPropertyId?: string
}
```

Remove the `categoryLabels` object entirely.

In the component function signature, add `accounts` to destructured props.

In the form state, replace `category: '' as string` with `account_id: ''`.

In the new row rendering, replace the category `<select>` with:

```tsx
<select
  value={form.account_id}
  onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
  className="w-full bg-transparent text-xs border-0 focus:ring-1 focus:ring-primary px-1 py-0.5"
>
  <option value="">Сметка...</option>
  {accounts
    .filter(a => a.account_type === 'EXPENSE' && a.level === 3)
    .map(a => (
      <option key={a.id} value={a.id}>
        {a.code} {a.name}
      </option>
    ))}
</select>
```

In the existing rows display, replace `categoryLabels[row.category]` with:
```tsx
{row.usali_accounts ? `${row.usali_accounts.code} ${row.usali_accounts.name}` : '—'}
```

In the submit handler, replace `category` with `account_id` in the body:
```typescript
const body = {
  property_id: form.property_id || defaultPropertyId,
  department_id: form.department_id,
  account_id: form.account_id,
  supplier: form.supplier,
  // ... rest stays same
}
```

In the table header, replace "Категория" with "Сметка".

- [ ] **Step 2: Update IncomeSpreadsheet.tsx**

Similar changes:
1. Remove `IncomeCategory` import and `categoryLabels`
2. Add `accounts` prop
3. Replace `income_category` in form state with `account_id`
4. Replace the category `<select>` with account picker

```typescript
// Update type import:
import type {
  IncomeEntry,
  IncomeEntryType,
  IncomePaymentMethod,
  IncomeEntryStatus,
} from '@/types/finance'

// Update IncomeEntryWithJoins:
export type IncomeEntryWithJoins = IncomeEntry & {
  properties: { name: string }
  usali_accounts: { code: string; name: string } | null
}

// Update Props:
interface Props {
  entries: IncomeEntryWithJoins[]
  properties: Array<{ id: string; name: string }>
  bankAccounts: Array<{ id: string; name: string; iban: string }>
  loans: Array<{ id: string; bank: string; contract_number: string }>
  accounts: Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>
  canCreate: boolean
}
```

Remove `categoryLabels` object. In form state replace `income_category: ''` with `account_id: ''`.

Replace category select with:
```tsx
<select
  value={form.account_id}
  onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
  className="w-full bg-transparent text-xs border-0 focus:ring-1 focus:ring-primary px-1 py-0.5"
>
  <option value="">Сметка...</option>
  {accounts
    .filter(a => a.account_type === 'REVENUE' && a.level === 3)
    .map(a => (
      <option key={a.id} value={a.id}>
        {a.code} {a.name}
      </option>
    ))}
</select>
```

In submit handler replace `income_category` with `account_id`.

In existing rows display, replace `categoryLabels[row.income_category]` with:
```tsx
{row.usali_accounts ? `${row.usali_accounts.code} ${row.usali_accounts.name}` : '—'}
```

- [ ] **Step 3: Update expenses/page.tsx — Fetch accounts**

Add account fetch alongside existing queries. After the departments query, add:

```typescript
const { data: accounts } = await supabase
  .from('usali_accounts')
  .select('id, code, name, level, account_type, parent_id')
  .eq('is_active', true)
  .eq('account_type', 'EXPENSE')
  .order('sort_order')
```

Pass to component:
```tsx
<ExpenseSpreadsheet
  expenses={(expenses as ExpenseWithJoins[]) ?? []}
  properties={properties}
  departments={(departments ?? []) as Array<{ id: string; name: string; property_id: string }>}
  accounts={(accounts ?? []) as Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>}
  userRole={user.role}
  defaultPropertyId={defaultPropertyId}
/>
```

- [ ] **Step 4: Update income/page.tsx — Fetch accounts**

Add to the `Promise.all` array:

```typescript
supabase
  .from('usali_accounts')
  .select('id, code, name, level, account_type, parent_id')
  .eq('is_active', true)
  .eq('account_type', 'REVENUE')
  .order('sort_order'),
```

Destructure with:
```typescript
const [
  { data: entries },
  { data: properties },
  { data: bankAccounts },
  { data: loans },
  { data: accounts },
] = await Promise.all([...])
```

Pass to component:
```tsx
<IncomeSpreadsheet
  entries={(entries as IncomeEntryWithJoins[]) ?? []}
  properties={properties ?? []}
  bankAccounts={bankAccounts ?? []}
  loans={loans ?? []}
  accounts={(accounts ?? []) as Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>}
  canCreate={isCO}
/>
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds. Any remaining references to `ExpenseCategory` or `IncomeCategory` in other files will need fixing (check for compilation errors).

- [ ] **Step 6: Commit**

```bash
git add components/finance/ExpenseSpreadsheet.tsx components/finance/IncomeSpreadsheet.tsx app/\(finance\)/finance/expenses/page.tsx app/\(finance\)/finance/income/page.tsx
git commit -m "feat: replace category dropdowns with USALI account pickers"
```

---

### Task 9: Chart of Accounts Management UI

**Files:**
- Create: `app/(finance)/finance/chart-of-accounts/page.tsx`
- Create: `components/finance/ChartOfAccountsTree.tsx`
- Create: `components/finance/AccountForm.tsx`
- Create: `components/finance/DepartmentTemplates.tsx`

- [ ] **Step 1: Create the chart of accounts page**

Create `app/(finance)/finance/chart-of-accounts/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { ChartOfAccountsTree } from '@/components/finance/ChartOfAccountsTree'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ChartOfAccountsPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  if (user.realRole !== 'ADMIN_CO') redirect('/finance')

  const supabase = await createClient()

  const [{ data: accounts }, { data: templates }] = await Promise.all([
    supabase
      .from('usali_accounts')
      .select('*, usali_department_templates(code, name, category)')
      .order('sort_order'),
    supabase
      .from('usali_department_templates')
      .select('*')
      .order('sort_order'),
  ])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Сметкоплан (USALI)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartOfAccountsTree
            accounts={accounts ?? []}
            templates={templates ?? []}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create ChartOfAccountsTree component**

Create `components/finance/ChartOfAccountsTree.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { AccountForm } from './AccountForm'
import { DepartmentTemplates } from './DepartmentTemplates'
import type { UsaliAccount, UsaliDepartmentTemplate } from '@/types/finance'

type AccountWithTemplate = UsaliAccount & {
  usali_department_templates: { code: string; name: string; category: string } | null
}

interface Props {
  accounts: AccountWithTemplate[]
  templates: UsaliDepartmentTemplate[]
}

export function ChartOfAccountsTree({ accounts: initialAccounts, templates: initialTemplates }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const level1 = initialAccounts.filter(a => a.level === 1)

  function toggle(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function children(parentId: string) {
    return initialAccounts.filter(a => a.parent_id === parentId)
  }

  async function toggleActive(id: string, currentActive: boolean) {
    await fetch(`/api/finance/usali-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentActive }),
    })
    router.refresh()
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Нова сметка
        </button>
        <button
          onClick={() => setShowTemplates(true)}
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
        >
          Департаменти
        </button>
      </div>

      {showTemplates && (
        <DepartmentTemplates
          templates={initialTemplates}
          onClose={() => { setShowTemplates(false); router.refresh() }}
        />
      )}

      {showForm && (
        <AccountForm
          templates={initialTemplates.filter(t => t.is_active)}
          accounts={initialAccounts}
          onClose={() => { setShowForm(false); router.refresh() }}
        />
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2 font-medium">Код</th>
              <th className="text-left px-3 py-2 font-medium">Наименование</th>
              <th className="text-left px-3 py-2 font-medium">Тип</th>
              <th className="text-left px-3 py-2 font-medium">Департамент</th>
              <th className="text-center px-3 py-2 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {level1.map(l1 => {
              const isCollapsed = collapsed.has(l1.id)
              const l2Items = children(l1.id)
              return (
                <>
                  <tr
                    key={l1.id}
                    className="border-b bg-muted/30 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggle(l1.id)}
                  >
                    <td className="px-3 py-1.5 font-medium">{isCollapsed ? '▸' : '▾'} {l1.code}</td>
                    <td className="px-3 py-1.5 font-medium">{l1.name}</td>
                    <td className="px-3 py-1.5">{l1.account_type === 'REVENUE' ? 'Приход' : 'Разход'}</td>
                    <td className="px-3 py-1.5">{l1.usali_department_templates?.name ?? '—'}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button onClick={e => { e.stopPropagation(); toggleActive(l1.id, l1.is_active) }}>
                        <Badge variant={l1.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {l1.is_active ? 'Активна' : 'Неактивна'}
                        </Badge>
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed && l2Items.map(l2 => {
                    const l3Items = children(l2.id)
                    return (
                      <>
                        <tr key={l2.id} className="border-b hover:bg-muted/20">
                          <td className="px-3 py-1.5 pl-8">{l2.code}</td>
                          <td className="px-3 py-1.5 pl-8 text-muted-foreground">{l2.name}</td>
                          <td className="px-3 py-1.5">{l2.account_type === 'REVENUE' ? 'Приход' : 'Разход'}</td>
                          <td className="px-3 py-1.5"></td>
                          <td className="px-3 py-1.5 text-center">
                            <button onClick={() => toggleActive(l2.id, l2.is_active)}>
                              <Badge variant={l2.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                {l2.is_active ? 'Активна' : 'Неактивна'}
                              </Badge>
                            </button>
                          </td>
                        </tr>
                        {l3Items.map(l3 => (
                          <tr key={l3.id} className="border-b hover:bg-muted/20">
                            <td className="px-3 py-1.5 pl-14">{l3.code}</td>
                            <td className="px-3 py-1.5 pl-14 text-muted-foreground">{l3.name}</td>
                            <td className="px-3 py-1.5">{l3.account_type === 'REVENUE' ? 'Приход' : 'Разход'}</td>
                            <td className="px-3 py-1.5"></td>
                            <td className="px-3 py-1.5 text-center">
                              <button onClick={() => toggleActive(l3.id, l3.is_active)}>
                                <Badge variant={l3.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                  {l3.is_active ? 'Активна' : 'Неактивна'}
                                </Badge>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </>
                    )
                  })}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create AccountForm component**

Create `components/finance/AccountForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { UsaliAccount, UsaliDepartmentTemplate } from '@/types/finance'

interface Props {
  templates: UsaliDepartmentTemplate[]
  accounts: UsaliAccount[]
  onClose: () => void
}

export function AccountForm({ templates, accounts, onClose }: Props) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    account_type: 'EXPENSE' as 'REVENUE' | 'EXPENSE',
    level: 3,
    parent_id: null as string | null,
    template_id: '',
    sort_order: 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const parentOptions = accounts.filter(a => {
    if (form.level === 1) return false
    if (form.level === 2) return a.level === 1
    if (form.level === 3) return a.level === 2
    return false
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await fetch('/api/finance/usali-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Грешка при запис')
        return
      }

      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-4 p-4 border rounded-md bg-card">
      <h3 className="text-sm font-medium mb-3">Нова сметка</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground">Код</label>
          <input
            type="text"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
            required
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Наименование</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
            required
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Тип</label>
          <select
            value={form.account_type}
            onChange={e => setForm(f => ({ ...f, account_type: e.target.value as 'REVENUE' | 'EXPENSE' }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
          >
            <option value="REVENUE">Приход</option>
            <option value="EXPENSE">Разход</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Ниво</label>
          <select
            value={form.level}
            onChange={e => setForm(f => ({ ...f, level: parseInt(e.target.value), parent_id: null }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
          >
            <option value={1}>1 — Група</option>
            <option value={2}>2 — Подгрупа</option>
            <option value={3}>3 — Сметка</option>
          </select>
        </div>
        {form.level > 1 && (
          <div>
            <label className="text-[10px] text-muted-foreground">Родител</label>
            <select
              value={form.parent_id ?? ''}
              onChange={e => setForm(f => ({ ...f, parent_id: e.target.value || null }))}
              className="w-full text-xs bg-background border rounded px-2 py-1.5"
              required
            >
              <option value="">Избери...</option>
              {parentOptions.map(a => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-[10px] text-muted-foreground">Департамент</label>
          <select
            value={form.template_id}
            onChange={e => setForm(f => ({ ...f, template_id: e.target.value }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
            required
          >
            <option value="">Избери...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Сортиране</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
          />
        </div>

        {error && <p className="col-span-2 text-xs text-destructive">{error}</p>}

        <div className="col-span-2 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md"
          >
            Отказ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Запис...' : 'Запази'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Create DepartmentTemplates component**

Create `components/finance/DepartmentTemplates.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { UsaliDepartmentTemplate } from '@/types/finance'

interface Props {
  templates: UsaliDepartmentTemplate[]
  onClose: () => void
}

const categoryLabels: Record<string, string> = {
  OPERATED: 'Оперативен',
  UNDISTRIBUTED: 'Неразпределен',
  FIXED: 'Фиксиран',
}

export function DepartmentTemplates({ templates, onClose }: Props) {
  const [items, setItems] = useState(templates)
  const [saving, setSaving] = useState<string | null>(null)

  async function toggle(id: string, currentActive: boolean) {
    setSaving(id)
    try {
      const res = await fetch(`/api/finance/usali-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      })
      if (res.ok) {
        setItems(prev => prev.map(t => t.id === id ? { ...t, is_active: !currentActive } : t))
      }
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="mb-4 p-4 border rounded-md bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">USALI Департаменти</h3>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md"
        >
          Затвори
        </button>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="text-left px-3 py-2 font-medium">Код</th>
            <th className="text-left px-3 py-2 font-medium">Наименование</th>
            <th className="text-left px-3 py-2 font-medium">Категория</th>
            <th className="text-center px-3 py-2 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody>
          {items.map(t => (
            <tr key={t.id} className="border-b hover:bg-muted/20">
              <td className="px-3 py-1.5">{t.code}</td>
              <td className="px-3 py-1.5">{t.name}</td>
              <td className="px-3 py-1.5">{categoryLabels[t.category] ?? t.category}</td>
              <td className="px-3 py-1.5 text-center">
                <button
                  onClick={() => toggle(t.id, t.is_active)}
                  disabled={saving === t.id}
                >
                  <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-[10px]">
                    {t.is_active ? 'Активен' : 'Неактивен'}
                  </Badge>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/\(finance\)/finance/chart-of-accounts/ components/finance/ChartOfAccountsTree.tsx components/finance/AccountForm.tsx components/finance/DepartmentTemplates.tsx
git commit -m "feat: add chart of accounts management UI"
```

---

### Task 10: USALI Reports UI

**Files:**
- Create: `app/(finance)/finance/usali-reports/page.tsx`
- Create: `components/finance/UsaliDepartmentalReport.tsx`
- Create: `components/finance/UsaliSummaryReport.tsx`
- Create: `components/finance/UsaliRevenueAnalysis.tsx`

- [ ] **Step 1: Create the USALI reports page**

Create `app/(finance)/finance/usali-reports/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { UsaliDepartmentalReport } from '@/components/finance/UsaliDepartmentalReport'
import { UsaliSummaryReport } from '@/components/finance/UsaliSummaryReport'
import { UsaliRevenueAnalysis } from '@/components/finance/UsaliRevenueAnalysis'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function UsaliReportsPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  if (!isCORole(user.role)) redirect('/finance')

  const supabase = await createClient()

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('status', 'ACTIVE')
    .order('name')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">USALI Отчети</CardTitle>
        </CardHeader>
        <CardContent>
          <UsaliReportsClient properties={properties ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}

// Inline client wrapper for tabs + filter state
function UsaliReportsClient({ properties }: { properties: Array<{ id: string; name: string }> }) {
  // This needs to be a client component — extract to separate file or use dynamic import
  // For simplicity, we'll make the page itself pass data and let each report component handle its own fetching
  return (
    <UsaliReportsClientInner properties={properties} />
  )
}

// Actually, since we need client interactivity, let's make the inner part a client import
import { UsaliReportsClientInner } from '@/components/finance/UsaliReportsClient'
```

Wait — server components can't import client components inline like this in the same file with mixed server/client code. Let me restructure.

Create `app/(finance)/finance/usali-reports/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { UsaliReportsClient } from '@/components/finance/UsaliReportsClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function UsaliReportsPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  if (!isCORole(user.role)) redirect('/finance')

  const supabase = await createClient()

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('status', 'ACTIVE')
    .order('name')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">USALI Отчети</CardTitle>
        </CardHeader>
        <CardContent>
          <UsaliReportsClient properties={properties ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create UsaliReportsClient (tab container)**

Create `components/finance/UsaliReportsClient.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { UsaliDepartmentalReport } from './UsaliDepartmentalReport'
import { UsaliSummaryReport } from './UsaliSummaryReport'
import { UsaliRevenueAnalysis } from './UsaliRevenueAnalysis'

interface Props {
  properties: Array<{ id: string; name: string }>
}

const tabs = [
  { key: 'departmental', label: 'Департаментален' },
  { key: 'summary', label: 'Обобщен (GOP/NOI)' },
  { key: 'revenue', label: 'Revenue Analysis' },
] as const

type TabKey = typeof tabs[number]['key']

export function UsaliReportsClient({ properties }: Props) {
  const now = new Date()
  const [tab, setTab] = useState<TabKey>('departmental')
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const months = [
    'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
    'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
  ]

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={propertyId}
          onChange={e => setPropertyId(e.target.value)}
          className="text-xs bg-background border rounded px-2 py-1.5"
        >
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={e => setMonth(parseInt(e.target.value))}
          className="text-xs bg-background border rounded px-2 py-1.5"
        >
          {months.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={e => setYear(parseInt(e.target.value))}
          className="text-xs bg-background border rounded px-2 py-1.5 w-20"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'departmental' && propertyId && (
        <UsaliDepartmentalReport propertyId={propertyId} year={year} month={month} />
      )}
      {tab === 'summary' && propertyId && (
        <UsaliSummaryReport propertyId={propertyId} year={year} month={month} />
      )}
      {tab === 'revenue' && propertyId && (
        <UsaliRevenueAnalysis propertyId={propertyId} year={year} month={month} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create UsaliDepartmentalReport component**

Create `components/finance/UsaliDepartmentalReport.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'

interface DeptData {
  template: { code: string; name: string }
  revenue: { groups: { account: { code: string; name: string }; amount: number; budget: number }[]; total: number; totalBudget: number }
  expenses: { groups: { account: { code: string; name: string }; amount: number; budget: number }[]; total: number; totalBudget: number }
  profit: number
  profitBudget: number
  margin: number
}

interface Report {
  property: { id: string; name: string }
  period: { year: number; month: number }
  departments: DeptData[]
}

interface Props {
  propertyId: string
  year: number
  month: number
}

function fmt(n: number) {
  return n.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function UsaliDepartmentalReport({ propertyId, year, month }: Props) {
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/finance/usali-reports/departmental?property_id=${propertyId}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [propertyId, year, month])

  if (loading) return <p className="text-xs text-muted-foreground py-4">Зареждане...</p>
  if (!data || data.departments.length === 0) return <p className="text-xs text-muted-foreground py-4">Няма данни.</p>

  return (
    <div className="space-y-6">
      {data.departments.map(dept => (
        <div key={dept.template.code} className="border rounded-md overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b">
            <h3 className="text-sm font-medium">{dept.template.name}</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-1.5 font-medium w-1/2"></th>
                <th className="text-right px-3 py-1.5 font-medium">Факт</th>
                <th className="text-right px-3 py-1.5 font-medium">Бюджет</th>
                <th className="text-right px-3 py-1.5 font-medium">Разлика</th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue */}
              <tr className="border-b bg-green-500/5">
                <td className="px-3 py-1 font-medium" colSpan={4}>ПРИХОДИ</td>
              </tr>
              {dept.revenue.groups.map(g => (
                <tr key={g.account.code} className="border-b">
                  <td className="px-3 py-1 pl-6">{g.account.name}</td>
                  <td className="px-3 py-1 text-right">{fmt(g.amount)}</td>
                  <td className="px-3 py-1 text-right text-muted-foreground">{g.budget > 0 ? fmt(g.budget) : '—'}</td>
                  <td className={`px-3 py-1 text-right ${g.amount - g.budget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {g.budget > 0 ? fmt(g.amount - g.budget) : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="px-3 py-1">ОБЩО ПРИХОДИ</td>
                <td className="px-3 py-1 text-right">{fmt(dept.revenue.total)}</td>
                <td className="px-3 py-1 text-right text-muted-foreground">{dept.revenue.totalBudget > 0 ? fmt(dept.revenue.totalBudget) : '—'}</td>
                <td className={`px-3 py-1 text-right ${dept.revenue.total - dept.revenue.totalBudget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {dept.revenue.totalBudget > 0 ? fmt(dept.revenue.total - dept.revenue.totalBudget) : '—'}
                </td>
              </tr>

              {/* Expenses */}
              <tr className="border-b bg-red-500/5">
                <td className="px-3 py-1 font-medium" colSpan={4}>РАЗХОДИ</td>
              </tr>
              {dept.expenses.groups.map(g => (
                <tr key={g.account.code} className="border-b">
                  <td className="px-3 py-1 pl-6">{g.account.name}</td>
                  <td className="px-3 py-1 text-right">{fmt(g.amount)}</td>
                  <td className="px-3 py-1 text-right text-muted-foreground">{g.budget > 0 ? fmt(g.budget) : '—'}</td>
                  <td className={`px-3 py-1 text-right ${g.amount - g.budget <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {g.budget > 0 ? fmt(g.amount - g.budget) : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="px-3 py-1">ОБЩО РАЗХОДИ</td>
                <td className="px-3 py-1 text-right">{fmt(dept.expenses.total)}</td>
                <td className="px-3 py-1 text-right text-muted-foreground">{dept.expenses.totalBudget > 0 ? fmt(dept.expenses.totalBudget) : '—'}</td>
                <td className={`px-3 py-1 text-right ${dept.expenses.total - dept.expenses.totalBudget <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {dept.expenses.totalBudget > 0 ? fmt(dept.expenses.total - dept.expenses.totalBudget) : '—'}
                </td>
              </tr>

              {/* Profit */}
              <tr className="bg-muted/50 font-medium">
                <td className="px-3 py-1.5">ДЕПАРТАМЕНТАЛНА ПЕЧАЛБА ({dept.margin.toFixed(1)}%)</td>
                <td className="px-3 py-1.5 text-right">{fmt(dept.profit)}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">{dept.profitBudget !== 0 ? fmt(dept.profitBudget) : '—'}</td>
                <td className={`px-3 py-1.5 text-right ${dept.profit - dept.profitBudget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {dept.profitBudget !== 0 ? fmt(dept.profit - dept.profitBudget) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create UsaliSummaryReport component**

Create `components/finance/UsaliSummaryReport.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'

interface SummaryData {
  property: { id: string; name: string }
  period: { year: number; month: number }
  operatedDepartments: { template: { code: string; name: string }; profit: number; profitYtd: number }[]
  totalDepartmentalProfit: number
  totalDepartmentalProfitYtd: number
  undistributed: { template: { code: string; name: string }; amount: number; amountYtd: number }[]
  totalUndistributed: number
  totalUndistributedYtd: number
  gop: number
  gopYtd: number
  gopPercent: number
  gopPercentYtd: number
  fixedCharges: { template: { code: string; name: string }; amount: number; amountYtd: number }[]
  totalFixed: number
  totalFixedYtd: number
  noi: number
  noiYtd: number
  noiPercent: number
  noiPercentYtd: number
}

interface Props {
  propertyId: string
  year: number
  month: number
}

function fmt(n: number) {
  return n.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function UsaliSummaryReport({ propertyId, year, month }: Props) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/finance/usali-reports/summary?property_id=${propertyId}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [propertyId, year, month])

  if (loading) return <p className="text-xs text-muted-foreground py-4">Зареждане...</p>
  if (!data) return <p className="text-xs text-muted-foreground py-4">Няма данни.</p>

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-3 py-2 font-medium w-1/2"></th>
            <th className="text-right px-3 py-2 font-medium">Текущ месец</th>
            <th className="text-right px-3 py-2 font-medium">YTD</th>
          </tr>
        </thead>
        <tbody>
          {/* Operated Departments */}
          <tr className="border-b bg-green-500/5">
            <td className="px-3 py-1 font-medium" colSpan={3}>ОПЕРАТИВНИ ДЕПАРТАМЕНТИ</td>
          </tr>
          {data.operatedDepartments.map(d => (
            <tr key={d.template.code} className="border-b">
              <td className="px-3 py-1 pl-6">{d.template.name} — Печалба</td>
              <td className="px-3 py-1 text-right">{fmt(d.profit)}</td>
              <td className="px-3 py-1 text-right">{fmt(d.profitYtd)}</td>
            </tr>
          ))}
          <tr className="border-b font-medium bg-muted/30">
            <td className="px-3 py-1.5">ОБЩА ДЕПАРТАМЕНТАЛНА ПЕЧАЛБА</td>
            <td className="px-3 py-1.5 text-right">{fmt(data.totalDepartmentalProfit)}</td>
            <td className="px-3 py-1.5 text-right">{fmt(data.totalDepartmentalProfitYtd)}</td>
          </tr>

          {/* Undistributed */}
          <tr className="border-b bg-yellow-500/5">
            <td className="px-3 py-1 font-medium" colSpan={3}>НЕРАЗПРЕДЕЛЕНИ РАЗХОДИ</td>
          </tr>
          {data.undistributed.map(d => (
            <tr key={d.template.code} className="border-b">
              <td className="px-3 py-1 pl-6">{d.template.name}</td>
              <td className="px-3 py-1 text-right text-red-400">({fmt(d.amount)})</td>
              <td className="px-3 py-1 text-right text-red-400">({fmt(d.amountYtd)})</td>
            </tr>
          ))}
          <tr className="border-b font-medium bg-muted/30">
            <td className="px-3 py-1.5">ОБЩО НЕРАЗПРЕДЕЛЕНИ</td>
            <td className="px-3 py-1.5 text-right text-red-400">({fmt(data.totalUndistributed)})</td>
            <td className="px-3 py-1.5 text-right text-red-400">({fmt(data.totalUndistributedYtd)})</td>
          </tr>

          {/* GOP */}
          <tr className="border-b font-medium bg-primary/10">
            <td className="px-3 py-2">GROSS OPERATING PROFIT (GOP) — {data.gopPercent.toFixed(1)}%</td>
            <td className="px-3 py-2 text-right">{fmt(data.gop)}</td>
            <td className="px-3 py-2 text-right">{fmt(data.gopYtd)}</td>
          </tr>

          {/* Fixed */}
          <tr className="border-b bg-red-500/5">
            <td className="px-3 py-1 font-medium" colSpan={3}>ФИКСИРАНИ РАЗХОДИ</td>
          </tr>
          {data.fixedCharges.map(d => (
            <tr key={d.template.code} className="border-b">
              <td className="px-3 py-1 pl-6">{d.template.name}</td>
              <td className="px-3 py-1 text-right text-red-400">({fmt(d.amount)})</td>
              <td className="px-3 py-1 text-right text-red-400">({fmt(d.amountYtd)})</td>
            </tr>
          ))}
          <tr className="border-b font-medium bg-muted/30">
            <td className="px-3 py-1.5">ОБЩО ФИКСИРАНИ</td>
            <td className="px-3 py-1.5 text-right text-red-400">({fmt(data.totalFixed)})</td>
            <td className="px-3 py-1.5 text-right text-red-400">({fmt(data.totalFixedYtd)})</td>
          </tr>

          {/* NOI */}
          <tr className="font-medium bg-primary/10">
            <td className="px-3 py-2">NET OPERATING INCOME (NOI) — {data.noiPercent.toFixed(1)}%</td>
            <td className="px-3 py-2 text-right">{fmt(data.noi)}</td>
            <td className="px-3 py-2 text-right">{fmt(data.noiYtd)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Create UsaliRevenueAnalysis component**

Create `components/finance/UsaliRevenueAnalysis.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'

interface KpiSet {
  roomsAvailable: number
  roomsSold: number
  guests: number
  occupancyPercent: number
  adr: number
  revpar: number
  totalRevenuePerRoom: number
  roomRevenue: number
  totalRevenue: number
}

interface RevenueData {
  property: { id: string; name: string }
  period: { year: number; month: number }
  current: KpiSet | null
  previousMonth: KpiSet | null
  previousYear: KpiSet | null
}

interface Props {
  propertyId: string
  year: number
  month: number
}

function fmt(n: number | undefined, decimals = 2) {
  if (n === undefined || n === null) return '—'
  return n.toLocaleString('bg-BG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function pct(n: number | undefined) {
  if (n === undefined || n === null) return '—'
  return n.toFixed(1) + '%'
}

export function UsaliRevenueAnalysis({ propertyId, year, month }: Props) {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/finance/usali-reports/revenue-analysis?property_id=${propertyId}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [propertyId, year, month])

  if (loading) return <p className="text-xs text-muted-foreground py-4">Зареждане...</p>
  if (!data) return <p className="text-xs text-muted-foreground py-4">Няма данни.</p>

  if (!data.current) {
    return (
      <div className="border rounded-md p-4">
        <p className="text-xs text-muted-foreground text-center">
          Няма данни за стаи (property_statistics). Данните ще се попълнят от PMS интеграцията.
        </p>
      </div>
    )
  }

  const rows: { label: string; current: string; prev: string; yoy: string }[] = [
    { label: 'Налични стаи', current: fmt(data.current.roomsAvailable, 0), prev: fmt(data.previousMonth?.roomsAvailable, 0), yoy: fmt(data.previousYear?.roomsAvailable, 0) },
    { label: 'Продадени стаи', current: fmt(data.current.roomsSold, 0), prev: fmt(data.previousMonth?.roomsSold, 0), yoy: fmt(data.previousYear?.roomsSold, 0) },
    { label: 'Гости', current: fmt(data.current.guests, 0), prev: fmt(data.previousMonth?.guests, 0), yoy: fmt(data.previousYear?.guests, 0) },
    { label: 'Заетост %', current: pct(data.current.occupancyPercent), prev: pct(data.previousMonth?.occupancyPercent), yoy: pct(data.previousYear?.occupancyPercent) },
    { label: 'ADR (лв.)', current: fmt(data.current.adr), prev: fmt(data.previousMonth?.adr), yoy: fmt(data.previousYear?.adr) },
    { label: 'RevPAR (лв.)', current: fmt(data.current.revpar), prev: fmt(data.previousMonth?.revpar), yoy: fmt(data.previousYear?.revpar) },
    { label: 'Общ приход/стая (лв.)', current: fmt(data.current.totalRevenuePerRoom), prev: fmt(data.previousMonth?.totalRevenuePerRoom), yoy: fmt(data.previousYear?.totalRevenuePerRoom) },
    { label: 'Приход стаи (лв.)', current: fmt(data.current.roomRevenue), prev: fmt(data.previousMonth?.roomRevenue), yoy: fmt(data.previousYear?.roomRevenue) },
    { label: 'Общ приход (лв.)', current: fmt(data.current.totalRevenue), prev: fmt(data.previousMonth?.totalRevenue), yoy: fmt(data.previousYear?.totalRevenue) },
  ]

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-3 py-2 font-medium w-1/3"></th>
            <th className="text-right px-3 py-2 font-medium">Текущ месец</th>
            <th className="text-right px-3 py-2 font-medium">Предх. месец</th>
            <th className="text-right px-3 py-2 font-medium">Същ. мес. мин. г.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-b hover:bg-muted/20">
              <td className="px-3 py-1.5 font-medium">{row.label}</td>
              <td className="px-3 py-1.5 text-right">{row.current}</td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">{row.prev}</td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">{row.yoy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/\(finance\)/finance/usali-reports/ components/finance/UsaliReportsClient.tsx components/finance/UsaliDepartmentalReport.tsx components/finance/UsaliSummaryReport.tsx components/finance/UsaliRevenueAnalysis.tsx
git commit -m "feat: add USALI reports UI with three tabs"
```

---

### Task 11: Sidebar Navigation + Final Cleanup

**Files:**
- Modify: `components/finance/FinanceSidebar.tsx`

- [ ] **Step 1: Add USALI nav items to sidebar**

In `components/finance/FinanceSidebar.tsx`, add the `BarChart3` import to the lucide-react import line:

```typescript
import {
  Building2, LayoutDashboard, FileText, FileCheck, Receipt, Wallet,
  Landmark, ArrowRightLeft, TrendingUp, MessageSquare,
  CalendarDays, Eye, Package, BarChart3, BookOpen,
} from 'lucide-react'
```

Add two new entries to the `navItems` array, before the `properties` entry:

```typescript
  { href: '/finance/chart-of-accounts', label: 'Сметкоплан', icon: BookOpen, roles: ['ADMIN_CO'] },
  { href: '/finance/usali-reports', label: 'USALI Отчети', icon: BarChart3, roles: ['ADMIN_CO', 'FINANCE_CO'] },
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add components/finance/FinanceSidebar.tsx
git commit -m "feat: add USALI navigation items to sidebar"
```

---

### Task 12: Fix Remaining References to Old Category Types

After the migration removes `ExpenseCategory` and `IncomeCategory`, any other files that import or reference them will break. This task finds and fixes all remaining references.

**Files:**
- Potentially: any files importing `ExpenseCategory` or `IncomeCategory` from `types/finance`
- The `expenses/[id]` detail page, `income/[id]` detail page, and any other components

- [ ] **Step 1: Search for all remaining references**

Run: `grep -r "ExpenseCategory\|IncomeCategory\|income_category\|categoryLabels" --include="*.ts" --include="*.tsx" app/ components/ lib/`

Fix each file found:
- Remove `ExpenseCategory` / `IncomeCategory` imports
- Replace `category` field references with `account_id`
- Replace `income_category` field references with `account_id`
- Replace `categoryLabels[...]` with account name from joined data

Common files that likely need updates:
- `app/api/finance/expenses/[id]/route.ts` — update select to join `usali_accounts`
- `app/api/finance/income/[id]/route.ts` — update select to join `usali_accounts`
- `app/(finance)/finance/expenses/new/page.tsx` — if it references `ExpenseCategory`
- `app/(finance)/finance/income/new/page.tsx` — if it references `IncomeCategory`

- [ ] **Step 2: Verify full build**

Run: `npm run build`
Expected: Clean build with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix: remove all remaining references to old category types"
```
