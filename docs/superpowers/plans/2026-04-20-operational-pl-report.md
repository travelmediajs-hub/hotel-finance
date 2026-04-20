# Operational P&L Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-app Operational P&L / Budget report that replaces the external Excel spreadsheet, with Plan vs Actual comparison, VAT toggle, and Excel + PDF export — living as a new tab in `/finance/usali-reports`.

**Architecture:** Global fixed row template (new tables `opreport_rows`, `opreport_row_accounts`, `opreport_budgets`) + seeded rows mapped to existing `usali_accounts`. New per-property fields on `properties` (rooms, beds, operating months, annual rent). Aggregation via a single TypeScript service (`lib/finance/opreport/compute.ts`) reused by the report view and export endpoints. UI built with Excel-like editable grid.

**Tech Stack:** Next.js 16 App Router, Supabase/Postgres with RLS, React 19, Tailwind v4, shadcn/ui, Zod, `xlsx` (SheetJS) for Excel export.

**Testing note:** Per the spec, this project has no test runner and one is not being added as part of this work. The formula evaluator (pure function, highest risk) is sanity-checked via a small Node script included in the task. All other verification is manual smoke testing with precise URLs / curl commands documented per task. Use `npm run lint` and `npm run build` as the baseline gates before commit.

---

## File Structure

**New migrations** (under `supabase/migrations/`):
- `20260420000000_opreport_schema.sql` — `opreport_rows`, `opreport_row_accounts`, `opreport_budgets` + RLS
- `20260420000001_properties_add_rent_beds.sql` — add columns to `properties`
- `20260420000002_opreport_permissions.sql` — new permissions + role grants
- `20260420000003_opreport_seed_template.sql` — insert 35 template rows + any missing `usali_accounts`
- `20260420000004_opreport_seed_mappings.sql` — insert `opreport_row_accounts`

**New types** (in existing file):
- `types/finance.ts` — append types for OpReport

**New Zod schemas:**
- `lib/finance/schemas/opreport.ts`
- `lib/finance/schemas/index.ts` — add export

**New library code** (`lib/finance/opreport/`):
- `formula.ts` — pure formula evaluator
- `periods.ts` — `workingDaysFor`, `daysInMonth`, etc.
- `template.ts` — fetch template rows + mappings
- `compute.ts` — fetch actuals, compute report matrix (used by view and export)
- `xlsx.ts` — build xlsx buffer from a matrix

**New API routes** (`app/api/finance/opreport/`):
- `template/route.ts` — GET
- `budget/route.ts` — GET + PUT
- `report/route.ts` — GET
- `export/xlsx/route.ts` — GET

**New UI:**
- `app/(finance)/finance/usali-reports/opreport/print/page.tsx` — print view
- `components/finance/OpReportTab.tsx` — container, owns controls + inner tab switch
- `components/finance/OpReportBudgetGrid.tsx` — editable grid
- `components/finance/OpReportView.tsx` — Plan / Actual / Variance view
- `components/finance/OpReportCell.tsx` — editable cell (extracted for focus)

**Modifications:**
- `components/finance/UsaliReportsClient.tsx` — add "Операционен P&L" tab
- `components/finance/PropertyForm.tsx` — add new fields (rooms_main, rooms_annex, total_beds, operating_months, annual_rent)
- `app/api/finance/properties/route.ts` + `[id]/route.ts` — accept new fields
- `lib/finance/schemas/property.ts` — add new fields to Zod schema
- `package.json` — add `xlsx`

---

## Task 1: Migration — opreport schema

**Files:**
- Create: `supabase/migrations/20260420000000_opreport_schema.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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
```

- [ ] **Step 2: Apply and verify**

Run (from project root, with Supabase CLI linked):
```bash
npx supabase db push
```
Or copy-paste the SQL into the Supabase SQL editor. Expected: three new tables created without error.

Verify with:
```sql
SELECT tablename FROM pg_tables WHERE tablename LIKE 'opreport%';
-- Expect: opreport_rows, opreport_row_accounts, opreport_budgets
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260420000000_opreport_schema.sql
git commit -m "feat(opreport): add schema for operational P&L tables"
```

---

## Task 2: Migration — properties columns

**Files:**
- Create: `supabase/migrations/20260420000001_properties_add_rent_beds.sql`

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE properties
  ADD COLUMN rooms_main       int NOT NULL DEFAULT 0,
  ADD COLUMN rooms_annex      int NOT NULL DEFAULT 0,
  ADD COLUMN total_beds       int NOT NULL DEFAULT 0,
  ADD COLUMN operating_months int[] NOT NULL DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}',
  ADD COLUMN annual_rent      decimal(12,2) NOT NULL DEFAULT 0;

-- Sanity constraints
ALTER TABLE properties
  ADD CONSTRAINT properties_operating_months_nonempty
    CHECK (array_length(operating_months, 1) >= 1),
  ADD CONSTRAINT properties_operating_months_range
    CHECK (operating_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::int[]),
  ADD CONSTRAINT properties_rooms_nonneg
    CHECK (rooms_main >= 0 AND rooms_annex >= 0 AND total_beds >= 0),
  ADD CONSTRAINT properties_annual_rent_nonneg
    CHECK (annual_rent >= 0);
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db push
```

Verify in psql:
```sql
\d properties
-- Expect rooms_main, rooms_annex, total_beds, operating_months, annual_rent columns
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260420000001_properties_add_rent_beds.sql
git commit -m "feat(properties): add rooms/beds/operating_months/annual_rent fields"
```

---

## Task 3: Migration — permissions

**Files:**
- Create: `supabase/migrations/20260420000002_opreport_permissions.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db push
```

Verify:
```sql
SELECT role_key, permission_key, granted
FROM role_permissions
WHERE permission_key LIKE 'opreport.%'
ORDER BY role_key, permission_key;
-- Expect 12 rows (4 roles × 3 permissions)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260420000002_opreport_permissions.sql
git commit -m "feat(opreport): add permissions and default role grants"
```

---

## Task 4: Migration — seed template rows

**Files:**
- Create: `supabase/migrations/20260420000003_opreport_seed_template.sql`

- [ ] **Step 1: Write the migration (also adds missing usali_accounts)**

```sql
-- 1) Add any usali_accounts needed by the template that may not exist yet.
-- These are idempotent inserts under the existing "EXPENSES" hierarchy.
-- Codes chosen in the 95xx range to avoid conflicts with the existing USALI seed.
INSERT INTO usali_accounts (code, name, account_type, level, parent_id, template_id, sort_order)
SELECT v.code, v.name, 'EXPENSE', 2, NULL, NULL, v.sort_order
FROM (VALUES
  ('9501', 'Heating (pellets)',           10),
  ('9502', 'Local tax per night',         11),
  ('9503', 'Laundry',                     12),
  ('9504', 'Software',                    13),
  ('9505', 'TV / Telephone / Internet',   14),
  ('9506', 'Extraordinary expenses',      15),
  ('9507', 'Overbooking expenses',        16),
  ('9508', 'Accounting expenses',         17),
  ('9509', 'Booking.com commission',      18),
  ('9510', 'Facebook ad',                 19),
  ('9520', 'Food and vegetables',         20),
  ('9521', 'Soft drinks and coffee',      21),
  ('9522', 'Hotel supplies',              22),
  ('9530', 'Electricity',                 30),
  ('9531', 'Water',                       31),
  ('9532', 'LPG',                         32),
  ('9540', 'Other expenses',              40)
) AS v(code, name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM usali_accounts a WHERE a.code = v.code
);

-- 2) Insert the operational P&L template rows (35 rows total).
-- Columns: row_key, label_bg, section, sort_order, row_type,
--          formula, source, vat_applicable, budgetable, display_format, indent_level
INSERT INTO opreport_rows
  (row_key, label_bg, section, sort_order, row_type, formula, source,
   vat_applicable, budgetable, display_format, indent_level)
VALUES
-- STATISTICS
('rooms_main',          'Брой стаи (основна сграда)',       'STATISTICS',  10, 'STAT',    NULL, 'property.rooms_main',                false, false, 'NUMBER',  0),
('rooms_annex',         'Брой стаи (анекс)',                'STATISTICS',  20, 'STAT',    NULL, 'property.rooms_annex',               false, false, 'NUMBER',  0),
('total_beds',          'Общ брой легла',                   'STATISTICS',  30, 'STAT',    NULL, 'property.total_beds',                false, false, 'NUMBER',  0),
('working_days',        'Работни дни',                      'STATISTICS',  40, 'STAT',    NULL, 'period.working_days',                false, false, 'NUMBER',  0),
('rooms_available',     'Налични стая-нощи',                'STATISTICS',  50, 'STAT',    NULL, 'property_statistics.rooms_available',false, false, 'NUMBER',  0),
('rooms_sold',          'Продадени стая-нощи',              'STATISTICS',  55, 'STAT',    NULL, 'property_statistics.rooms_sold',     false, false, 'NUMBER',  0),
('occupancy_rate',      'Средна заетост',                   'STATISTICS',  60, 'DERIVED', 'rooms_sold / rooms_available', NULL,         false, false, 'PERCENT', 0),
('booked_beds',         'Легло-нощувки',                    'STATISTICS',  70, 'STAT',    NULL, 'property_statistics.guests',         false, false, 'NUMBER',  0),
('avg_price_per_bed_hb','Средна цена на легло (HB)',        'STATISTICS',  80, 'DERIVED', 'accommodation_revenue / booked_beds', NULL, false, false, 'CURRENCY',0),
-- REVENUE
('accommodation_revenue','Приходи от настаняване',          'REVENUE',    110, 'REVENUE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
('fb_revenue',           'Приходи от бар и ресторант',      'REVENUE',    120, 'REVENUE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
('total_incomes',        'Общо приходи',                    'REVENUE',    190, 'DERIVED','accommodation_revenue + fb_revenue', NULL,    false, false, 'CURRENCY',0),
-- F&B EXPENSES
('fb_total',             'Храна и напитки (общо)',          'FB_EXPENSES',210, 'DERIVED','food_vegetables + soft_drinks_coffee + hotel_supplies', NULL, false, false, 'CURRENCY',0),
('fb_per_guest',         'F&B на гост',                     'FB_EXPENSES',215, 'DERIVED','fb_total / booked_beds', NULL,                false, false, 'CURRENCY',1),
('food_vegetables',      '1. Храна и зеленчуци',            'FB_EXPENSES',220, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',1),
('food_per_guest',       '1.1 На гост',                     'FB_EXPENSES',225, 'DERIVED','food_vegetables / booked_beds', NULL,         false, false, 'CURRENCY',2),
('soft_drinks_coffee',   '2. Безалкохолни и кафе',          'FB_EXPENSES',230, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',1),
('soft_drinks_per_guest','2.1 На гост',                     'FB_EXPENSES',235, 'DERIVED','soft_drinks_coffee / booked_beds', NULL,      false, false, 'CURRENCY',2),
('hotel_supplies',       '3. Хотелски консумативи',         'FB_EXPENSES',240, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',1),
('hotel_supplies_per_guest','3.1 На гост',                  'FB_EXPENSES',245, 'DERIVED','hotel_supplies / booked_beds', NULL,          false, false, 'CURRENCY',2),
-- STAFF
('net_salary',           'Нетни заплати',                    'STAFF',      310, 'PAYROLL', NULL, 'payroll.net_salary',                 false, true,  'CURRENCY',0),
('social_contributions', 'Осигуровки',                       'STAFF',      320, 'PAYROLL', NULL, 'payroll.contributions',              false, true,  'CURRENCY',0),
-- UTILITIES
('electricity',          'Електричество',                    'UTILITIES',  410, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
('heating_pellets',      'Отопление (пелети)',               'UTILITIES',  420, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
('water',                'Вода',                             'UTILITIES',  430, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
('lpg',                  'LPG',                              'UTILITIES',  440, 'EXPENSE', NULL, NULL,                                  true,  true,  'CURRENCY',0),
-- OTHER EXPENSES
('other_expenses',       'Други разходи',                    'OTHER_EXPENSES',510,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('local_tax_per_night',  'Туристическа такса',               'OTHER_EXPENSES',520,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('laundry',              'Пране',                            'OTHER_EXPENSES',530,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('software',             'Софтуер',                          'OTHER_EXPENSES',540,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('tv_tel_internet',      'ТВ, Телефон, Интернет',            'OTHER_EXPENSES',550,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('extraordinary',        'Извънредни разходи',               'OTHER_EXPENSES',560,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('overbooking',          'Овърбукинг разходи',               'OTHER_EXPENSES',570,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('accounting',           'Счетоводство',                     'OTHER_EXPENSES',580,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('booking_com_commission','Booking.com комисионна',          'OTHER_EXPENSES',590,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
('facebook_ads',         'Facebook реклама',                 'OTHER_EXPENSES',600,'EXPENSE',NULL,NULL,                                   true,  true,  'CURRENCY',0),
-- TOTALS
('rent',                 'Наем',                             'TOTALS',     710, 'RENT',    NULL, 'property.annual_rent',                false, false, 'CURRENCY',0),
('total_expenses',       'Общо разходи',                     'TOTALS',     720, 'DERIVED',
  'fb_total + net_salary + social_contributions + electricity + heating_pellets + water + lpg + other_expenses + local_tax_per_night + laundry + software + tv_tel_internet + extraordinary + overbooking + accounting + booking_com_commission + facebook_ads + rent',
  NULL, false, false, 'CURRENCY',0),
('profit',               'Печалба',                          'TOTALS',     730, 'DERIVED','total_incomes - total_expenses', NULL,        false, false, 'CURRENCY',0),
('net_profit_margin',    'Марж на нетна печалба',            'TOTALS',     740, 'DERIVED','profit / total_incomes', NULL,                false, false, 'PERCENT', 0),
('avg_price_per_night',  'Средна цена на нощувка',           'TOTALS',     750, 'DERIVED','accommodation_revenue / rooms_sold', NULL,    false, false, 'CURRENCY',0)
ON CONFLICT (row_key) DO NOTHING;
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db push
```

```sql
SELECT COUNT(*) FROM opreport_rows;
-- Expect 40 (9 stat + 3 revenue + 8 fb + 2 staff + 4 utilities + 10 other + 5 totals - adjust if mismatched)
SELECT section, COUNT(*) FROM opreport_rows GROUP BY section ORDER BY section;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260420000003_opreport_seed_template.sql
git commit -m "feat(opreport): seed operational P&L template rows"
```

---

## Task 5: Migration — seed row-to-account mappings

**Files:**
- Create: `supabase/migrations/20260420000004_opreport_seed_mappings.sql`

- [ ] **Step 1: Write the migration**

The mapping links each `EXPENSE` / `REVENUE` template row to one (or more) `usali_accounts` by `code`. After Task 4 every referenced `code` is guaranteed to exist. Failure to find any code is loud (RAISE NOTICE + COUNT check after).

```sql
-- Helper CTE: (row_key, account_code) pairs
WITH pairs(row_key, account_code) AS (
  VALUES
    -- Revenue
    ('accommodation_revenue', '1101'),
    ('fb_revenue',            '3101'),
    -- F&B expenses
    ('food_vegetables',       '9520'),
    ('soft_drinks_coffee',    '9521'),
    ('hotel_supplies',        '9522'),
    -- Utilities
    ('electricity',           '9530'),
    ('heating_pellets',       '9501'),
    ('water',                 '9531'),
    ('lpg',                   '9532'),
    -- Other expenses
    ('other_expenses',        '9540'),
    ('local_tax_per_night',   '9502'),
    ('laundry',               '9503'),
    ('software',              '9504'),
    ('tv_tel_internet',       '9505'),
    ('extraordinary',         '9506'),
    ('overbooking',           '9507'),
    ('accounting',            '9508'),
    ('booking_com_commission','9509'),
    ('facebook_ads',          '9510')
)
INSERT INTO opreport_row_accounts (row_id, account_id)
SELECT r.id, a.id
FROM pairs p
JOIN opreport_rows  r ON r.row_key = p.row_key
JOIN usali_accounts a ON a.code    = p.account_code
ON CONFLICT DO NOTHING;

-- Sanity: count expected mappings
DO $$
DECLARE
  mapped int;
BEGIN
  SELECT COUNT(*) INTO mapped FROM opreport_row_accounts;
  IF mapped < 19 THEN
    RAISE EXCEPTION 'Expected at least 19 row-account mappings, got %', mapped;
  END IF;
END $$;
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db push
```

```sql
SELECT r.row_key, a.code, a.name
FROM opreport_row_accounts m
JOIN opreport_rows  r ON r.id = m.row_id
JOIN usali_accounts a ON a.id = m.account_id
ORDER BY r.row_key;
-- Expect 19 rows
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260420000004_opreport_seed_mappings.sql
git commit -m "feat(opreport): seed template row to usali_accounts mappings"
```

---

## Task 6: TypeScript types

**Files:**
- Modify: `types/finance.ts` (append at end)

- [ ] **Step 1: Append types**

```typescript
// ============================================================
// OPERATIONAL P&L REPORT
// ============================================================

export type OpReportRowType =
  | 'HEADER' | 'STAT' | 'REVENUE' | 'EXPENSE'
  | 'PAYROLL' | 'RENT' | 'DERIVED'

export type OpReportSection =
  | 'STATISTICS' | 'REVENUE' | 'FB_EXPENSES' | 'STAFF'
  | 'UTILITIES' | 'OTHER_EXPENSES' | 'TOTALS'

export type OpReportDisplayFormat = 'NUMBER' | 'PERCENT' | 'CURRENCY'

export type OpReportVatMode = 'net' | 'gross'

export type OpReportViewMode = 'plan' | 'actual' | 'variance'

export interface OpReportRow {
  id: string
  row_key: string
  label_bg: string
  section: OpReportSection
  sort_order: number
  row_type: OpReportRowType
  formula: string | null
  source: string | null
  vat_applicable: boolean
  budgetable: boolean
  display_format: OpReportDisplayFormat
  indent_level: number
}

export interface OpReportRowWithAccounts extends OpReportRow {
  account_ids: string[]
}

export interface OpReportBudget {
  id: string
  property_id: string
  year: number
  month: number     // 1..12
  row_id: string
  amount: number
}

export interface OpReportCell {
  plan: number | null
  actual: number | null
  variance_pct: number | null
}

export interface OpReportMatrixRow {
  row_key: string
  label_bg: string
  section: OpReportSection
  row_type: OpReportRowType
  display_format: OpReportDisplayFormat
  indent_level: number
  cells: Record<number, OpReportCell>  // keyed by month 1..12
  ytd: OpReportCell
}

export interface OpReportMatrix {
  property_id: string
  year: number
  vat_mode: OpReportVatMode
  operating_months: number[]
  rows: OpReportMatrixRow[]
}
```

- [ ] **Step 2: Also extend Property type**

Find the existing `Property` interface in `types/finance.ts` and add the new fields (place alongside existing columns):

```typescript
// Inside interface Property { ... }
rooms_main: number
rooms_annex: number
total_beds: number
operating_months: number[]
annual_rent: number
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
```
Expected: no errors from new code. If errors surface in unrelated files they're pre-existing and not blocking.

```bash
git add types/finance.ts
git commit -m "feat(opreport): add TypeScript types"
```

---

## Task 7: Zod schemas

**Files:**
- Create: `lib/finance/schemas/opreport.ts`
- Modify: `lib/finance/schemas/index.ts`
- Modify: `lib/finance/schemas/property.ts` (add new fields to create/update schema)

- [ ] **Step 1: Create the schema file**

```typescript
// lib/finance/schemas/opreport.ts
import { z } from 'zod'

export const vatModeSchema = z.enum(['net', 'gross'])
export const viewModeSchema = z.enum(['plan', 'actual', 'variance'])

export const budgetCellSchema = z.object({
  property_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  row_key: z.string().min(1).max(64),
  amount: z.number().min(-1e10).max(1e10),
})

export const budgetBatchSchema = z.object({
  cells: z.array(budgetCellSchema).min(1).max(500),
})

export const reportQuerySchema = z.object({
  property_id: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  vat_mode: vatModeSchema.default('net'),
})

export const budgetQuerySchema = z.object({
  property_id: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
})

export const exportQuerySchema = reportQuerySchema.extend({
  view: viewModeSchema.default('variance'),
})

export type BudgetCell = z.infer<typeof budgetCellSchema>
export type BudgetBatch = z.infer<typeof budgetBatchSchema>
export type ReportQuery = z.infer<typeof reportQuerySchema>
export type BudgetQuery = z.infer<typeof budgetQuerySchema>
export type ExportQuery = z.infer<typeof exportQuerySchema>
```

- [ ] **Step 2: Export from index**

In `lib/finance/schemas/index.ts`, add:

```typescript
export * from './opreport'
```

- [ ] **Step 3: Extend property schema**

Open `lib/finance/schemas/property.ts`. Locate the object passed to `z.object(...)` used for create/update. Add these optional fields (using `z.coerce.number()` because FormData sends strings):

```typescript
rooms_main:       z.coerce.number().int().min(0).optional(),
rooms_annex:      z.coerce.number().int().min(0).optional(),
total_beds:       z.coerce.number().int().min(0).optional(),
annual_rent:      z.coerce.number().min(0).optional(),
operating_months: z.array(z.number().int().min(1).max(12))
                    .min(1)
                    .refine(arr => new Set(arr).size === arr.length, 'Дублирани месеци')
                    .optional(),
```

If there are separate `create` and `update` schemas, add these to both (optional for create since defaults cover it; required-when-present for update).

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
```

```bash
git add lib/finance/schemas/opreport.ts lib/finance/schemas/index.ts lib/finance/schemas/property.ts
git commit -m "feat(opreport): add Zod schemas for budget, report, and property fields"
```

---

## Task 8: Install xlsx package

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install xlsx@0.18.5
```

(Pinned version — SheetJS post-0.18.5 moved to a CDN distribution; 0.18.5 is the last npm-published version and is known stable.)

- [ ] **Step 2: Verify build still works**

```bash
npm run build
```
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add xlsx dependency for Excel export"
```

---

## Task 9: Formula evaluator (pure function)

**Files:**
- Create: `lib/finance/opreport/formula.ts`
- Create (temporary, deleted in Step 5): `lib/finance/opreport/formula.smoke.mjs` — sanity script

- [ ] **Step 1: Implement the evaluator**

```typescript
// lib/finance/opreport/formula.ts
//
// Tiny arithmetic expression evaluator for DERIVED rows.
// Grammar: expr = term (('+'|'-') term)*
//          term = factor (('*'|'/') factor)*
//          factor = '(' expr ')' | identifier | number
//
// Operand values come from `values`. Missing keys or null/undefined/NaN
// values propagate: any null operand => null result. Division by zero => null.

type Token =
  | { type: 'num'; value: number }
  | { type: 'id';  value: string }
  | { type: 'op';  value: '+' | '-' | '*' | '/' }
  | { type: 'lp' }
  | { type: 'rp' }

function tokenize(src: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue }
    if (ch === '(') { out.push({ type: 'lp' }); i++; continue }
    if (ch === ')') { out.push({ type: 'rp' }); i++; continue }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      out.push({ type: 'op', value: ch }); i++; continue
    }
    if (ch >= '0' && ch <= '9' || ch === '.') {
      let j = i
      while (j < src.length && (src[j] === '.' || (src[j] >= '0' && src[j] <= '9'))) j++
      out.push({ type: 'num', value: parseFloat(src.slice(i, j)) })
      i = j; continue
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++
      out.push({ type: 'id', value: src.slice(i, j) })
      i = j; continue
    }
    throw new Error(`Unexpected character '${ch}' at position ${i} in formula: ${src}`)
  }
  return out
}

export function evaluateFormula(
  formula: string,
  values: Record<string, number | null | undefined>,
): number | null {
  const tokens = tokenize(formula)
  let pos = 0

  const peek = () => tokens[pos]
  const eat = () => tokens[pos++]

  const parseExpr = (): number | null => {
    let left = parseTerm()
    while (peek()?.type === 'op' && (peek() as { value: string }).value === '+' || peek()?.type === 'op' && (peek() as { value: string }).value === '-') {
      const op = (eat() as { value: '+' | '-' }).value
      const right = parseTerm()
      if (left === null || right === null) left = null
      else left = op === '+' ? left + right : left - right
    }
    return left
  }

  const parseTerm = (): number | null => {
    let left = parseFactor()
    while (peek()?.type === 'op' && (peek() as { value: string }).value === '*' || peek()?.type === 'op' && (peek() as { value: string }).value === '/') {
      const op = (eat() as { value: '*' | '/' }).value
      const right = parseFactor()
      if (left === null || right === null) left = null
      else if (op === '*') left = left * right
      else {
        if (right === 0) left = null
        else left = left / right
      }
    }
    return left
  }

  const parseFactor = (): number | null => {
    const tok = peek()
    if (!tok) throw new Error(`Unexpected end of formula: ${formula}`)
    if (tok.type === 'lp') {
      eat()
      const v = parseExpr()
      const closing = eat()
      if (!closing || closing.type !== 'rp') throw new Error(`Missing ) in formula: ${formula}`)
      return v
    }
    if (tok.type === 'num') { eat(); return tok.value }
    if (tok.type === 'id')  {
      eat()
      const raw = values[tok.value]
      if (raw === null || raw === undefined || Number.isNaN(raw)) return null
      return raw
    }
    if (tok.type === 'op' && tok.value === '-') {
      eat()
      const v = parseFactor()
      return v === null ? null : -v
    }
    throw new Error(`Unexpected token '${JSON.stringify(tok)}' in formula: ${formula}`)
  }

  const result = parseExpr()
  if (pos !== tokens.length) throw new Error(`Unparsed trailing tokens in formula: ${formula}`)
  return result
}

/**
 * Topologically order rows by formula dependencies so evaluation respects data flow.
 * Non-DERIVED rows are independent; DERIVED rows must come after every key they reference.
 * Throws on circular dependencies.
 */
export function topologicalOrder(rows: Array<{ row_key: string; formula: string | null }>): string[] {
  const byKey = new Map(rows.map(r => [r.row_key, r]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const ordered: string[] = []

  const deps = (formula: string): string[] => {
    const ids = new Set<string>()
    for (const tok of tokenize(formula)) if (tok.type === 'id') ids.add(tok.value)
    return Array.from(ids)
  }

  const visit = (key: string) => {
    if (visited.has(key)) return
    if (visiting.has(key)) throw new Error(`Circular dependency involving ${key}`)
    visiting.add(key)
    const row = byKey.get(key)
    if (row?.formula) {
      for (const d of deps(row.formula)) {
        if (byKey.has(d)) visit(d)
      }
    }
    visiting.delete(key)
    visited.add(key)
    ordered.push(key)
  }

  for (const r of rows) visit(r.row_key)
  return ordered
}
```

- [ ] **Step 2: Write a sanity script (temporary)**

Create `lib/finance/opreport/formula.smoke.mjs`:

```javascript
// Sanity check for formula evaluator. Run with: node --experimental-strip-types lib/finance/opreport/formula.smoke.mjs
// (Not part of build; deleted after verification.)
import { evaluateFormula, topologicalOrder } from './formula.ts'

const assert = (actual, expected, label) => {
  const ok = actual === expected || (actual !== null && expected !== null && Math.abs(actual - expected) < 1e-9)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${actual}, expected ${expected}`)
  if (!ok) process.exitCode = 1
}

// Basic arithmetic
assert(evaluateFormula('1 + 2', {}), 3, 'add')
assert(evaluateFormula('10 - 3', {}), 7, 'sub')
assert(evaluateFormula('4 * 5', {}), 20, 'mul')
assert(evaluateFormula('20 / 4', {}), 5, 'div')
assert(evaluateFormula('(1 + 2) * 3', {}), 9, 'parens')
assert(evaluateFormula('2 + 3 * 4', {}), 14, 'precedence')

// Identifiers
assert(evaluateFormula('revenue - expenses', { revenue: 100, expenses: 40 }), 60, 'ids')

// Null propagation
assert(evaluateFormula('revenue / beds', { revenue: 100, beds: null }), null, 'null operand')
assert(evaluateFormula('a + b', { a: 5 }), null, 'missing key')

// Division by zero
assert(evaluateFormula('10 / 0', {}), null, 'div by zero')

// Unary minus
assert(evaluateFormula('-5 + 3', {}), -2, 'unary minus')

// Topological order
const rows = [
  { row_key: 'profit',  formula: 'income - expense' },
  { row_key: 'income',  formula: null },
  { row_key: 'expense', formula: null },
  { row_key: 'margin',  formula: 'profit / income' },
]
const order = topologicalOrder(rows)
const posOf = k => order.indexOf(k)
assert(posOf('profit') > posOf('income'), true, 'profit after income')
assert(posOf('margin') > posOf('profit'), true, 'margin after profit')

// Circular
try {
  topologicalOrder([
    { row_key: 'a', formula: 'b' },
    { row_key: 'b', formula: 'a' },
  ])
  console.log('FAIL circular detection')
  process.exitCode = 1
} catch {
  console.log('PASS circular detection')
}
```

- [ ] **Step 3: Run the sanity script**

```bash
node --experimental-strip-types lib/finance/opreport/formula.smoke.mjs
```

Expected: all lines start with `PASS` and no `FAIL`. If your Node version doesn't support `--experimental-strip-types` (Node < 22.6), use `npx tsx lib/finance/opreport/formula.smoke.mjs` (install tsx temporarily: `npm install -D tsx`).

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Delete the sanity script and commit**

```bash
rm lib/finance/opreport/formula.smoke.mjs
git add lib/finance/opreport/formula.ts
git commit -m "feat(opreport): add formula evaluator and dependency sort"
```

---

## Task 10: Period utilities

**Files:**
- Create: `lib/finance/opreport/periods.ts`

- [ ] **Step 1: Implement**

```typescript
// lib/finance/opreport/periods.ts

/** Days in a given month (1..12) of a given year, taking leap years into account. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Returns working days for the month given a property's operating_months.
 * 0 if the month isn't operational; full month length otherwise.
 * v1 does not support partial-month closures.
 */
export function workingDaysFor(
  year: number,
  month: number,
  operatingMonths: number[],
): number {
  return operatingMonths.includes(month) ? daysInMonth(year, month) : 0
}

/** ISO date boundaries for a given year+month (start inclusive, end exclusive). */
export function monthBounds(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const start = `${year}-${pad(month)}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const end = `${nextYear}-${pad(nextMonth)}-01`
  return { start, end }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/finance/opreport/periods.ts
git commit -m "feat(opreport): add period utilities (days, working days, month bounds)"
```

---

## Task 11: Template fetcher

**Files:**
- Create: `lib/finance/opreport/template.ts`

- [ ] **Step 1: Implement**

```typescript
// lib/finance/opreport/template.ts
import { createClient } from '@/lib/supabase/server'
import type { OpReportRow, OpReportRowWithAccounts } from '@/types/finance'

/**
 * Load the full operational P&L template (rows + account mappings).
 * Ordered by section then sort_order, matching UI display order.
 */
export async function loadOpReportTemplate(): Promise<OpReportRowWithAccounts[]> {
  const supabase = await createClient()

  const { data: rows, error: rowsErr } = await supabase
    .from('opreport_rows')
    .select('*')
    .order('section')
    .order('sort_order')

  if (rowsErr) throw new Error(`Failed to load opreport rows: ${rowsErr.message}`)

  const { data: mappings, error: mapErr } = await supabase
    .from('opreport_row_accounts')
    .select('row_id, account_id')

  if (mapErr) throw new Error(`Failed to load opreport mappings: ${mapErr.message}`)

  const accountsByRow = new Map<string, string[]>()
  for (const m of mappings ?? []) {
    const list = accountsByRow.get(m.row_id) ?? []
    list.push(m.account_id)
    accountsByRow.set(m.row_id, list)
  }

  return (rows as OpReportRow[]).map(r => ({
    ...r,
    account_ids: accountsByRow.get(r.id) ?? [],
  }))
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/finance/opreport/template.ts
git commit -m "feat(opreport): add template fetcher with account mappings"
```

---

## Task 12: Report computation service

**Files:**
- Create: `lib/finance/opreport/compute.ts`

- [ ] **Step 1: Implement**

```typescript
// lib/finance/opreport/compute.ts
import { createClient } from '@/lib/supabase/server'
import type {
  OpReportMatrix,
  OpReportMatrixRow,
  OpReportRowWithAccounts,
  OpReportVatMode,
  OpReportCell,
} from '@/types/finance'
import { loadOpReportTemplate } from './template'
import { evaluateFormula, topologicalOrder } from './formula'
import { workingDaysFor, monthBounds } from './periods'

type MonthlyMap = Record<string /* row_key */, Record<number /* month */, number>>

async function fetchProperty(propertyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('id, rooms_main, rooms_annex, total_beds, operating_months, annual_rent')
    .eq('id', propertyId)
    .single()
  if (error || !data) throw new Error(`Property not found: ${propertyId}`)
  return data as {
    id: string
    rooms_main: number
    rooms_annex: number
    total_beds: number
    operating_months: number[]
    annual_rent: number
  }
}

async function fetchBudgets(propertyId: string, year: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('opreport_budgets')
    .select('row_id, month, amount')
    .eq('property_id', propertyId)
    .eq('year', year)
  if (error) throw new Error(`Failed to load budgets: ${error.message}`)
  return data ?? []
}

async function fetchExpenseActuals(
  propertyId: string,
  year: number,
  vatMode: OpReportVatMode,
  accountIds: string[],
): Promise<Array<{ account_id: string; month: number; total: number }>> {
  if (accountIds.length === 0) return []
  const supabase = await createClient()
  const col = vatMode === 'gross' ? 'total_amount' : 'amount_net'
  const { start, end } = { start: `${year}-01-01`, end: `${year + 1}-01-01` }
  const { data, error } = await supabase
    .from('expenses')
    .select(`account_id, issue_date, ${col}`)
    .in('account_id', accountIds)
    .gte('issue_date', start)
    .lt('issue_date', end)
    .neq('status', 'REJECTED')
    .neq('status', 'RETURNED')
    .neq('status', 'DRAFT')
  if (error) throw new Error(`Failed to load expenses: ${error.message}`)

  const bucket = new Map<string, number>()
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const month = new Date(row.issue_date as string).getUTCMonth() + 1
    const key = `${row.account_id}_${month}`
    const amt = Number(row[col] ?? 0)
    bucket.set(key, (bucket.get(key) ?? 0) + amt)
  }
  const out: Array<{ account_id: string; month: number; total: number }> = []
  for (const [k, v] of bucket) {
    const [accountId, monthStr] = k.split('_')
    out.push({ account_id: accountId, month: parseInt(monthStr, 10), total: v })
  }
  return out
}

async function fetchIncomeActuals(
  propertyId: string,
  year: number,
  vatMode: OpReportVatMode,
  accountIds: string[],
): Promise<Array<{ account_id: string; month: number; total: number }>> {
  if (accountIds.length === 0) return []
  const supabase = await createClient()
  const { start, end } = { start: `${year}-01-01`, end: `${year + 1}-01-01` }

  // income_entries.amount is treated as gross; use amount_net if present.
  // If there is no net column, net == gross (spec allows).
  const { data, error } = await supabase
    .from('income_entries')
    .select('account_id, entry_date, amount')
    .eq('property_id', propertyId)
    .in('account_id', accountIds)
    .gte('entry_date', start)
    .lt('entry_date', end)
  if (error) throw new Error(`Failed to load income: ${error.message}`)

  const bucket = new Map<string, number>()
  for (const row of data ?? []) {
    const month = new Date(row.entry_date).getUTCMonth() + 1
    const key = `${row.account_id}_${month}`
    const gross = Number(row.amount ?? 0)
    // v1: if vatMode=net and no net column on income, apply 9% default accommodation VAT is NOT done;
    // income is stored as entered (assumed net). Gross is the same value until income.vat_amount is modeled.
    const value = gross
    bucket.set(key, (bucket.get(key) ?? 0) + value)
  }
  const out: Array<{ account_id: string; month: number; total: number }> = []
  for (const [k, v] of bucket) {
    const [accountId, monthStr] = k.split('_')
    out.push({ account_id: accountId, month: parseInt(monthStr, 10), total: v })
  }
  return out
}

async function fetchPayrollActuals(
  propertyId: string,
  year: number,
): Promise<{ net_salary: Record<number, number>; contributions: Record<number, number> }> {
  const supabase = await createClient()
  const { start, end } = { start: `${year}-01-01`, end: `${year + 1}-01-01` }

  // employees + employee_schedule approach: the payroll module computes monthly pay from attendance.
  // For v1 we approximate: sum(actual_salary * workedDaysInMonth / contractDaysInMonth) is payroll-module logic
  // — reuse whatever aggregator the module already exposes. If not available yet, fall back to
  // `actual_salary` per employee per month the employee was active.
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, actual_salary')
    .eq('property_id', propertyId)
    .eq('is_active', true)
  if (error) throw new Error(`Failed to load employees: ${error.message}`)

  const { data: schedules } = await supabase
    .from('employee_schedule')
    .select('employee_id, date, status')
    .gte('date', start)
    .lt('date', end)

  // Group WORK days per (employee, month)
  const workDaysMap = new Map<string, number>()
  for (const s of schedules ?? []) {
    if (s.status !== 'WORK') continue
    const month = new Date(s.date as string).getUTCMonth() + 1
    const key = `${s.employee_id}_${month}`
    workDaysMap.set(key, (workDaysMap.get(key) ?? 0) + 1)
  }

  const net: Record<number, number> = {}
  const contrib: Record<number, number> = {}
  for (let m = 1; m <= 12; m++) { net[m] = 0; contrib[m] = 0 }

  const contributionsRate = 0.188 // Bulgarian employer contribution approximation; see payroll module for exact
  for (const emp of (employees ?? []) as Array<{ id: string; actual_salary: number }>) {
    for (let m = 1; m <= 12; m++) {
      const daysInM = new Date(year, m, 0).getDate()
      const worked = workDaysMap.get(`${emp.id}_${m}`) ?? 0
      if (worked === 0) continue
      const pay = Number(emp.actual_salary) * (worked / daysInM)
      net[m] += pay
      contrib[m] += pay * contributionsRate
    }
  }

  return { net_salary: net, contributions: contrib }
}

async function fetchPropertyStatistics(propertyId: string, year: number) {
  const supabase = await createClient()
  const { start, end } = { start: `${year}-01-01`, end: `${year + 1}-01-01` }
  const { data, error } = await supabase
    .from('property_statistics')
    .select('date, rooms_available, rooms_sold, guests')
    .eq('property_id', propertyId)
    .gte('date', start)
    .lt('date', end)
  if (error) throw new Error(`Failed to load property_statistics: ${error.message}`)

  const byMonth = {
    rooms_available: {} as Record<number, number>,
    rooms_sold:      {} as Record<number, number>,
    guests:          {} as Record<number, number>,
  }
  for (let m = 1; m <= 12; m++) {
    byMonth.rooms_available[m] = 0
    byMonth.rooms_sold[m] = 0
    byMonth.guests[m] = 0
  }
  for (const s of data ?? []) {
    const m = new Date(s.date as string).getUTCMonth() + 1
    byMonth.rooms_available[m] += s.rooms_available
    byMonth.rooms_sold[m]      += s.rooms_sold
    byMonth.guests[m]          += s.guests
  }
  return byMonth
}

function emptyCell(): OpReportCell { return { plan: null, actual: null, variance_pct: null } }

function variancePct(plan: number | null, actual: number | null): number | null {
  if (plan === null || actual === null) return null
  if (plan === 0) return null
  return ((actual - plan) / plan) * 100
}

export async function computeOperationalReport(
  propertyId: string,
  year: number,
  vatMode: OpReportVatMode,
): Promise<OpReportMatrix> {
  const template = await loadOpReportTemplate()
  const property = await fetchProperty(propertyId)
  const budgets = await fetchBudgets(propertyId, year)
  const stats = await fetchPropertyStatistics(propertyId, year)
  const payroll = await fetchPayrollActuals(propertyId, year)

  // Gather unique expense/revenue accounts across all mapped rows
  const expenseAccountIds = new Set<string>()
  const revenueAccountIds = new Set<string>()
  for (const r of template) {
    if (r.row_type === 'EXPENSE') r.account_ids.forEach(id => expenseAccountIds.add(id))
    if (r.row_type === 'REVENUE') r.account_ids.forEach(id => revenueAccountIds.add(id))
  }
  const expenseActuals = await fetchExpenseActuals(propertyId, year, vatMode, [...expenseAccountIds])
  const incomeActuals  = await fetchIncomeActuals(propertyId,  year, vatMode, [...revenueAccountIds])

  // Build per-row monthly plan + actual maps (ignoring DERIVED for now)
  const plan: MonthlyMap   = {}
  const actual: MonthlyMap = {}

  for (const r of template) {
    plan[r.row_key]   = {}
    actual[r.row_key] = {}
  }

  // Budget values per row/month
  const rowById = new Map(template.map(r => [r.id, r]))
  for (const b of budgets) {
    const row = rowById.get(b.row_id)
    if (!row) continue
    plan[row.row_key][b.month] = Number(b.amount)
  }

  // Actual values:
  // STAT (property attribute) — same every month (present in operating months only)
  // STAT (property_statistics) — monthly sums
  // REVENUE / EXPENSE — sum of mapped-account totals per month
  // PAYROLL — from payroll aggregate
  // RENT — annual_rent / operating_months.length, per operating month
  // DERIVED — computed after all above

  const opMonths = property.operating_months ?? []
  const monthlyRent = opMonths.length > 0 ? Number(property.annual_rent) / opMonths.length : 0

  const accountToRowKey = new Map<string, string[]>()
  for (const r of template) {
    for (const accId of r.account_ids) {
      const list = accountToRowKey.get(accId) ?? []
      list.push(r.row_key)
      accountToRowKey.set(accId, list)
    }
  }

  for (const e of expenseActuals) {
    const rowKeys = accountToRowKey.get(e.account_id) ?? []
    for (const k of rowKeys) {
      actual[k][e.month] = (actual[k][e.month] ?? 0) + e.total
    }
  }
  for (const i of incomeActuals) {
    const rowKeys = accountToRowKey.get(i.account_id) ?? []
    for (const k of rowKeys) {
      actual[k][i.month] = (actual[k][i.month] ?? 0) + i.total
    }
  }

  for (const r of template) {
    if (r.row_type === 'STAT') {
      for (let m = 1; m <= 12; m++) {
        let v: number | null = null
        switch (r.source) {
          case 'property.rooms_main':   v = property.rooms_main; break
          case 'property.rooms_annex':  v = property.rooms_annex; break
          case 'property.total_beds':   v = property.total_beds; break
          case 'period.working_days':   v = workingDaysFor(year, m, opMonths); break
          case 'property_statistics.rooms_available': v = stats.rooms_available[m]; break
          case 'property_statistics.rooms_sold':      v = stats.rooms_sold[m]; break
          case 'property_statistics.guests':          v = stats.guests[m]; break
        }
        // For pure property attributes, only report for operating months
        if (r.source?.startsWith('property.') && !opMonths.includes(m)) v = 0
        if (v !== null) actual[r.row_key][m] = v
      }
    }
    if (r.row_type === 'PAYROLL') {
      for (let m = 1; m <= 12; m++) {
        if (r.source === 'payroll.net_salary')    actual[r.row_key][m] = payroll.net_salary[m] ?? 0
        if (r.source === 'payroll.contributions') actual[r.row_key][m] = payroll.contributions[m] ?? 0
      }
    }
    if (r.row_type === 'RENT') {
      for (const m of opMonths) actual[r.row_key][m] = monthlyRent
    }
  }

  // DERIVED: evaluate per month and per YTD in topo order
  const order = topologicalOrder(template.map(r => ({ row_key: r.row_key, formula: r.formula })))

  const evalColumn = (
    column: Record<string, number | null>,
  ): Record<string, number | null> => {
    const out: Record<string, number | null> = { ...column }
    for (const key of order) {
      const row = template.find(t => t.row_key === key)
      if (!row) continue
      if (row.row_type !== 'DERIVED') continue
      if (!row.formula) { out[key] = null; continue }
      out[key] = evaluateFormula(row.formula, out)
    }
    return out
  }

  // Build per-month columns and YTD column from Plan and Actual
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const planEvaluated: Record<number, Record<string, number | null>> = {}
  const actualEvaluated: Record<number, Record<string, number | null>> = {}
  for (const m of months) {
    const p: Record<string, number | null> = {}
    const a: Record<string, number | null> = {}
    for (const r of template) {
      p[r.row_key] = plan[r.row_key][m] ?? null
      a[r.row_key] = actual[r.row_key][m] ?? null
    }
    planEvaluated[m]   = evalColumn(p)
    actualEvaluated[m] = evalColumn(a)
  }

  // YTD: sum non-DERIVED, recompute DERIVED from YTD operands.
  const ytdPlan: Record<string, number | null> = {}
  const ytdActual: Record<string, number | null> = {}
  for (const r of template) {
    if (r.row_type === 'DERIVED') { ytdPlan[r.row_key] = null; ytdActual[r.row_key] = null; continue }
    let sumP = 0; let sumA = 0; let hasP = false; let hasA = false
    for (const m of months) {
      const p = plan[r.row_key][m]; if (p !== undefined) { sumP += p; hasP = true }
      const a = actual[r.row_key][m]; if (a !== undefined) { sumA += a; hasA = true }
    }
    ytdPlan[r.row_key]   = hasP ? sumP : null
    ytdActual[r.row_key] = hasA ? sumA : null
  }
  const ytdPlanEvaluated   = evalColumn(ytdPlan)
  const ytdActualEvaluated = evalColumn(ytdActual)

  // Assemble matrix rows
  const resultRows: OpReportMatrixRow[] = template.map(r => {
    const cells: Record<number, OpReportCell> = {}
    for (const m of months) {
      const p = planEvaluated[m][r.row_key] ?? null
      const a = actualEvaluated[m][r.row_key] ?? null
      cells[m] = { plan: p, actual: a, variance_pct: variancePct(p, a) }
    }
    const ytd: OpReportCell = {
      plan:   ytdPlanEvaluated[r.row_key] ?? null,
      actual: ytdActualEvaluated[r.row_key] ?? null,
      variance_pct: variancePct(ytdPlanEvaluated[r.row_key] ?? null, ytdActualEvaluated[r.row_key] ?? null),
    }
    return {
      row_key: r.row_key,
      label_bg: r.label_bg,
      section: r.section,
      row_type: r.row_type,
      display_format: r.display_format,
      indent_level: r.indent_level,
      cells,
      ytd,
    }
  })

  return {
    property_id: propertyId,
    year,
    vat_mode: vatMode,
    operating_months: opMonths,
    rows: resultRows,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors. If errors appear inside this file, fix them per standard TS feedback (usually import paths or optional chaining on possibly-undefined map lookups).

- [ ] **Step 3: Commit**

```bash
git add lib/finance/opreport/compute.ts
git commit -m "feat(opreport): add report computation service"
```

---

## Task 13: Excel export builder

**Files:**
- Create: `lib/finance/opreport/xlsx.ts`

- [ ] **Step 1: Implement**

```typescript
// lib/finance/opreport/xlsx.ts
import * as XLSX from 'xlsx'
import type { OpReportMatrix, OpReportViewMode } from '@/types/finance'

const MONTH_LABEL_BG = [
  '', 'Януари','Февруари','Март','Април','Май','Юни',
      'Юли','Август','Септември','Октомври','Ноември','Декември',
]

/** Build an xlsx buffer for a given matrix and view mode. */
export function buildOpReportXlsx(
  matrix: OpReportMatrix,
  view: OpReportViewMode,
  propertyName: string,
): Buffer {
  const wb = XLSX.utils.book_new()

  const months = matrix.operating_months.slice().sort((a, b) => a - b)

  // Header rows
  const title = `${propertyName} — Операционен P&L ${matrix.year} (${matrix.vat_mode === 'gross' ? 'С ДДС' : 'Без ДДС'})`
  const aoa: (string | number | null)[][] = []
  aoa.push([title])

  // Column header
  const colHeader: (string | number | null)[] = ['Ред']
  if (view === 'variance') {
    for (const m of months) {
      colHeader.push(`${MONTH_LABEL_BG[m]} Plan`, `${MONTH_LABEL_BG[m]} Actual`, `${MONTH_LABEL_BG[m]} Δ %`)
    }
    colHeader.push('YTD Plan', 'YTD Actual', 'YTD Δ %')
  } else {
    for (const m of months) colHeader.push(MONTH_LABEL_BG[m])
    colHeader.push('YTD')
  }
  aoa.push(colHeader)

  // Data rows
  for (const row of matrix.rows) {
    const label = '  '.repeat(row.indent_level) + row.label_bg
    const line: (string | number | null)[] = [label]
    for (const m of months) {
      const cell = row.cells[m]
      if (view === 'plan')        line.push(cell.plan)
      else if (view === 'actual') line.push(cell.actual)
      else {
        line.push(cell.plan, cell.actual, cell.variance_pct)
      }
    }
    if (view === 'plan')        line.push(row.ytd.plan)
    else if (view === 'actual') line.push(row.ytd.actual)
    else line.push(row.ytd.plan, row.ytd.actual, row.ytd.variance_pct)

    aoa.push(line)
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  // Column widths: label column wider
  ws['!cols'] = [{ wch: 38 }, ...Array(colHeader.length - 1).fill({ wch: 14 })]
  XLSX.utils.book_append_sheet(wb, ws, `${matrix.year}`)

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
```

- [ ] **Step 2: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```
Expected: both succeed. `xlsx` package may need `dynamic = 'force-dynamic'` at the route level (added in Task 17) but the library itself should build fine.

- [ ] **Step 3: Commit**

```bash
git add lib/finance/opreport/xlsx.ts
git commit -m "feat(opreport): add Excel workbook builder"
```

---

## Task 14: API — GET /template

**Files:**
- Create: `app/api/finance/opreport/template/route.ts`

- [ ] **Step 1: Implement**

```typescript
// app/api/finance/opreport/template/route.ts
import { NextResponse } from 'next/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { loadOpReportTemplate } from '@/lib/finance/opreport/template'

export async function GET() {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const allowed = await hasPermission(user, 'opreport.view')
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const template = await loadOpReportTemplate()
  return NextResponse.json(template, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
}
```

- [ ] **Step 2: Smoke test**

With the dev server running (`npm run dev`) and logged in as ADMIN_CO, in the browser console:
```js
await fetch('/api/finance/opreport/template').then(r => r.json())
```
Expected: an array of ~40 rows with `row_key`, `label_bg`, `row_type`, `account_ids`.

- [ ] **Step 3: Commit**

```bash
git add app/api/finance/opreport/template/route.ts
git commit -m "feat(opreport): add GET /api/finance/opreport/template"
```

---

## Task 15: API — GET + PUT /budget

**Files:**
- Create: `app/api/finance/opreport/budget/route.ts`

- [ ] **Step 1: Implement**

```typescript
// app/api/finance/opreport/budget/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { budgetBatchSchema, budgetQuerySchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'opreport.view')))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = budgetQuerySchema.safeParse(params)
  if (!parsed.success) return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(parsed.data.property_id))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('opreport_budgets')
    .select('row_id, month, amount, opreport_rows!inner(row_key)')
    .eq('property_id', parsed.data.property_id)
    .eq('year', parsed.data.year)

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  const matrix: Record<string, Record<number, number>> = {}
  for (const b of data ?? []) {
    const key = (b as { opreport_rows: { row_key: string } }).opreport_rows.row_key
    matrix[key] ??= {}
    matrix[key][(b as { month: number }).month] = Number((b as { amount: number }).amount)
  }
  return NextResponse.json({
    property_id: parsed.data.property_id,
    year: parsed.data.year,
    cells: matrix,
  })
}

export async function PUT(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'opreport.edit_budget')))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = budgetBatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })

  // Scope check: every cell's property must be allowed
  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds) {
    for (const c of parsed.data.cells) {
      if (!allowedIds.includes(c.property_id))
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const supabase = await createClient()

  // Resolve row_keys to row_ids and check budgetable
  const uniqueKeys = Array.from(new Set(parsed.data.cells.map(c => c.row_key)))
  const { data: rows, error: rowsErr } = await supabase
    .from('opreport_rows')
    .select('id, row_key, budgetable')
    .in('row_key', uniqueKeys)
  if (rowsErr) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  const rowMap = new Map((rows ?? []).map(r => [r.row_key, r]))
  for (const c of parsed.data.cells) {
    const row = rowMap.get(c.row_key)
    if (!row) return NextResponse.json({ error: `unknown row_key: ${c.row_key}` }, { status: 400 })
    if (!row.budgetable) return NextResponse.json({ error: `row_key not budgetable: ${c.row_key}` }, { status: 400 })
  }

  // Upsert: translate to row_id and perform batch upsert
  const payload = parsed.data.cells.map(c => ({
    property_id: c.property_id,
    year: c.year,
    month: c.month,
    row_id: rowMap.get(c.row_key)!.id,
    amount: c.amount,
  }))

  const { error: upErr } = await supabase
    .from('opreport_budgets')
    .upsert(payload, { onConflict: 'property_id,year,month,row_id' })
  if (upErr) return NextResponse.json({ error: 'database_error', detail: upErr.message }, { status: 500 })

  revalidatePath('/finance/usali-reports')
  return NextResponse.json({ success: true, saved: payload.length })
}
```

- [ ] **Step 2: Smoke test (GET)**

```js
await fetch('/api/finance/opreport/budget?property_id=<SOME_UUID>&year=2025').then(r => r.json())
```
Expected: `{ property_id, year, cells: {} }` (empty because no budgets yet).

- [ ] **Step 3: Smoke test (PUT)**

```js
await fetch('/api/finance/opreport/budget', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    cells: [{
      property_id: '<SOME_UUID>',
      year: 2025, month: 4, row_key: 'electricity', amount: 7683
    }]
  })
}).then(r => r.json())
```
Expected: `{ success: true, saved: 1 }`. Then re-run GET — cell should appear.

- [ ] **Step 4: Commit**

```bash
git add app/api/finance/opreport/budget/route.ts
git commit -m "feat(opreport): add GET/PUT /api/finance/opreport/budget"
```

---

## Task 16: API — GET /report

**Files:**
- Create: `app/api/finance/opreport/report/route.ts`

- [ ] **Step 1: Implement**

```typescript
// app/api/finance/opreport/report/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { reportQuerySchema } from '@/lib/finance/schemas'
import { computeOperationalReport } from '@/lib/finance/opreport/compute'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'opreport.view')))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = reportQuerySchema.safeParse(params)
  if (!parsed.success)
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(parsed.data.property_id))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const matrix = await computeOperationalReport(parsed.data.property_id, parsed.data.year, parsed.data.vat_mode)
  return NextResponse.json(matrix)
}
```

- [ ] **Step 2: Smoke test**

```js
await fetch('/api/finance/opreport/report?property_id=<UUID>&year=2025&vat_mode=net').then(r => r.json())
```
Expected: `{ property_id, year, vat_mode, operating_months, rows: [...] }`. For `operating_months`, if the property hasn't been configured yet, you'll see all 12 months; that's fine for this smoke.

- [ ] **Step 3: Commit**

```bash
git add app/api/finance/opreport/report/route.ts
git commit -m "feat(opreport): add GET /api/finance/opreport/report"
```

---

## Task 17: API — GET /export/xlsx

**Files:**
- Create: `app/api/finance/opreport/export/xlsx/route.ts`

- [ ] **Step 1: Implement**

```typescript
// app/api/finance/opreport/export/xlsx/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { exportQuerySchema } from '@/lib/finance/schemas'
import { computeOperationalReport } from '@/lib/finance/opreport/compute'
import { buildOpReportXlsx } from '@/lib/finance/opreport/xlsx'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await hasPermission(user, 'opreport.view')))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = exportQuerySchema.safeParse(params)
  if (!parsed.success)
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })

  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(parsed.data.property_id))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: property } = await supabase
    .from('properties')
    .select('name')
    .eq('id', parsed.data.property_id)
    .single()

  const matrix = await computeOperationalReport(parsed.data.property_id, parsed.data.year, parsed.data.vat_mode)
  const buffer = buildOpReportXlsx(matrix, parsed.data.view, property?.name ?? 'Unknown')

  const safeName = (property?.name ?? 'property').replace(/[^a-z0-9_-]+/gi, '_')
  const filename = `operational-pl-${safeName}-${parsed.data.year}-${parsed.data.view}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: Smoke test**

Open in a browser (logged in as ADMIN_CO):
```
http://localhost:3000/api/finance/opreport/export/xlsx?property_id=<UUID>&year=2025&view=variance&vat_mode=net
```
Expected: `.xlsx` file downloads. Open in Excel/LibreOffice — one sheet named `2025`, title row, header row, and data rows matching the report.

- [ ] **Step 3: Commit**

```bash
git add app/api/finance/opreport/export/xlsx/route.ts
git commit -m "feat(opreport): add GET /api/finance/opreport/export/xlsx"
```

---

## Task 18: UI — OpReportCell (editable cell)

**Files:**
- Create: `components/finance/OpReportCell.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/finance/OpReportCell.tsx
'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { OpReportDisplayFormat } from '@/types/finance'

interface Props {
  value: number | null
  editable: boolean
  format: OpReportDisplayFormat
  onCommit?: (newValue: number | null) => void
  readonly?: boolean
  className?: string
}

function fmt(value: number | null, format: OpReportDisplayFormat): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  if (format === 'PERCENT')  return `${(value).toFixed(1)}%`
  if (format === 'CURRENCY') return value.toLocaleString('bg-BG', { maximumFractionDigits: 2 })
  return value.toLocaleString('bg-BG', { maximumFractionDigits: 2 })
}

export function OpReportCell({ value, editable, format, onCommit, readonly, className }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value === null ? '' : String(value))

  useEffect(() => {
    setDraft(value === null ? '' : String(value))
  }, [value])

  if (!editable || readonly) {
    return (
      <div className={cn('px-2 py-1 text-right tabular-nums', className)}>
        {fmt(value, format)}
      </div>
    )
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.01"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          const parsed = draft.trim() === '' ? null : parseFloat(draft)
          const next = parsed !== null && !Number.isNaN(parsed) ? parsed : null
          if (next !== value) onCommit?.(next)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Tab') (e.currentTarget as HTMLInputElement).blur()
          if (e.key === 'Escape') { setDraft(value === null ? '' : String(value)); setEditing(false) }
        }}
        className={cn('w-full px-2 py-1 text-right tabular-nums bg-background border border-primary outline-none', className)}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={cn('px-2 py-1 text-right tabular-nums hover:bg-muted/40 cursor-text', className)}
    >
      {fmt(value, format)}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/finance/OpReportCell.tsx
git commit -m "feat(opreport): add editable OpReportCell component"
```

---

## Task 19: UI — OpReportBudgetGrid

**Files:**
- Create: `components/finance/OpReportBudgetGrid.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/finance/OpReportBudgetGrid.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { OpReportRowWithAccounts } from '@/types/finance'
import { OpReportCell } from './OpReportCell'

interface Props {
  propertyId: string
  year: number
  operatingMonths: number[]
}

const MONTH_LABELS = ['', 'Яну','Фев','Мар','Апр','Май','Юни','Юли','Авг','Сеп','Окт','Ное','Дек']

export function OpReportBudgetGrid({ propertyId, year, operatingMonths }: Props) {
  const [template, setTemplate] = useState<OpReportRowWithAccounts[]>([])
  const [cells, setCells] = useState<Record<string, Record<number, number>>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    let abort = false
    async function load() {
      setLoading(true)
      const [tmpl, budget] = await Promise.all([
        fetch('/api/finance/opreport/template').then(r => r.json()),
        fetch(`/api/finance/opreport/budget?property_id=${propertyId}&year=${year}`).then(r => r.json()),
      ])
      if (abort) return
      setTemplate(tmpl)
      setCells(budget.cells ?? {})
      setLoading(false)
    }
    load()
    return () => { abort = true }
  }, [propertyId, year])

  const months = useMemo(() => operatingMonths.slice().sort((a, b) => a - b), [operatingMonths])

  async function commitCell(rowKey: string, month: number, newVal: number | null) {
    const key = `${rowKey}_${month}`
    setSavingKey(key)
    // Optimistic update
    setCells(prev => {
      const next = { ...prev, [rowKey]: { ...(prev[rowKey] ?? {}) } }
      if (newVal === null) delete next[rowKey][month]
      else next[rowKey][month] = newVal
      return next
    })
    const amount = newVal ?? 0
    const res = await fetch('/api/finance/opreport/budget', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cells: [{ property_id: propertyId, year, month, row_key: rowKey, amount }],
      }),
    })
    setSavingKey(null)
    if (!res.ok) {
      // Reload to resync on failure
      const fresh = await fetch(`/api/finance/opreport/budget?property_id=${propertyId}&year=${year}`).then(r => r.json())
      setCells(fresh.cells ?? {})
    }
  }

  const ytdOf = (rowKey: string) =>
    months.reduce((sum, m) => sum + (cells[rowKey]?.[m] ?? 0), 0)

  if (loading) return <div className="text-xs text-muted-foreground p-4">Зареждане...</div>

  return (
    <div className="relative overflow-auto border rounded">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            <th className="text-left px-2 py-1.5 sticky left-0 bg-muted/50 min-w-[240px]">Ред</th>
            {months.map(m => (
              <th key={m} className="px-2 py-1.5 text-right min-w-[100px]">{MONTH_LABELS[m]}</th>
            ))}
            <th className="px-2 py-1.5 text-right min-w-[110px] bg-muted">YTD</th>
          </tr>
        </thead>
        <tbody>
          {template.map(row => (
            <tr
              key={row.row_key}
              className={cn(
                'border-t',
                row.row_type === 'HEADER' && 'bg-muted font-semibold',
              )}
            >
              <td
                className={cn(
                  'px-2 py-1 sticky left-0 bg-background',
                  'border-r',
                )}
                style={{ paddingLeft: `${8 + row.indent_level * 12}px` }}
              >
                {row.label_bg}
              </td>
              {months.map(m => (
                <td key={m} className={cn('border-r', savingKey === `${row.row_key}_${m}` && 'bg-primary/10')}>
                  <OpReportCell
                    value={cells[row.row_key]?.[m] ?? null}
                    editable={row.budgetable}
                    format={row.display_format}
                    onCommit={v => commitCell(row.row_key, m, v)}
                  />
                </td>
              ))}
              <td className="bg-muted/30">
                <OpReportCell value={ytdOf(row.row_key)} editable={false} format={row.display_format} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/finance/OpReportBudgetGrid.tsx
git commit -m "feat(opreport): add OpReportBudgetGrid with inline editing"
```

---

## Task 20: UI — OpReportView (Plan vs Actual)

**Files:**
- Create: `components/finance/OpReportView.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/finance/OpReportView.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { OpReportMatrix, OpReportViewMode, OpReportVatMode } from '@/types/finance'

interface Props {
  propertyId: string
  year: number
}

const MONTH_LABELS = ['', 'Яну','Фев','Мар','Апр','Май','Юни','Юли','Авг','Сеп','Окт','Ное','Дек']

function fmtNumber(value: number | null, format: 'NUMBER' | 'PERCENT' | 'CURRENCY'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  if (format === 'PERCENT') return `${value.toFixed(1)}%`
  return value.toLocaleString('bg-BG', { maximumFractionDigits: 2 })
}

function varianceClass(variancePct: number | null, rowType: string): string {
  if (variancePct === null) return ''
  const isExpense = rowType === 'EXPENSE' || rowType === 'PAYROLL' || rowType === 'RENT'
  const exceeded = isExpense ? variancePct > 0 : variancePct < 0
  const abs = Math.abs(variancePct)
  if (abs < 5)  return ''
  if (abs < 20) return exceeded ? 'text-red-600' : 'text-green-600'
  return exceeded ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'
}

export function OpReportView({ propertyId, year }: Props) {
  const [vatMode, setVatMode] = useState<OpReportVatMode>('net')
  const [view, setView] = useState<OpReportViewMode>('variance')
  const [matrix, setMatrix] = useState<OpReportMatrix | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let abort = false
    async function load() {
      setLoading(true)
      const m = await fetch(`/api/finance/opreport/report?property_id=${propertyId}&year=${year}&vat_mode=${vatMode}`).then(r => r.json())
      if (!abort) { setMatrix(m); setLoading(false) }
    }
    load()
    return () => { abort = true }
  }, [propertyId, year, vatMode])

  const months = useMemo(() => matrix?.operating_months.slice().sort((a, b) => a - b) ?? [], [matrix])

  const download = (fmt: 'xlsx' | 'print') => {
    if (fmt === 'xlsx') {
      const url = `/api/finance/opreport/export/xlsx?property_id=${propertyId}&year=${year}&view=${view}&vat_mode=${vatMode}`
      window.location.href = url
    } else {
      const url = `/finance/usali-reports/opreport/print?property_id=${propertyId}&year=${year}&vat_mode=${vatMode}`
      window.open(url, '_blank')
    }
  }

  if (loading || !matrix) return <div className="text-xs text-muted-foreground p-4">Зареждане...</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1 border rounded px-2 py-1 text-xs">
          <label>ДДС:</label>
          <button onClick={() => setVatMode('net')}   className={cn('px-2 py-0.5 rounded', vatMode === 'net'   && 'bg-primary text-primary-foreground')}>Без</button>
          <button onClick={() => setVatMode('gross')} className={cn('px-2 py-0.5 rounded', vatMode === 'gross' && 'bg-primary text-primary-foreground')}>С</button>
        </div>
        <div className="flex items-center gap-1 border rounded px-2 py-1 text-xs">
          <label>Изглед:</label>
          {(['plan','actual','variance'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn('px-2 py-0.5 rounded capitalize', view === v && 'bg-primary text-primary-foreground')}>
              {v === 'plan' ? 'Бюджет' : v === 'actual' ? 'Факт' : 'План vs Факт'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs ml-auto">
          <button onClick={() => download('xlsx')}  className="px-2 py-1 border rounded hover:bg-muted">📥 Excel</button>
          <button onClick={() => download('print')} className="px-2 py-1 border rounded hover:bg-muted">📄 PDF</button>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left px-2 py-1.5 sticky left-0 bg-muted/50 min-w-[240px]">Ред</th>
              {months.map(m => view === 'variance'
                ? [
                    <th key={`${m}p`} className="px-2 py-1.5 text-right min-w-[90px]">{MONTH_LABELS[m]} План</th>,
                    <th key={`${m}a`} className="px-2 py-1.5 text-right min-w-[90px]">{MONTH_LABELS[m]} Факт</th>,
                    <th key={`${m}v`} className="px-2 py-1.5 text-right min-w-[70px]">Δ %</th>,
                  ]
                : <th key={m} className="px-2 py-1.5 text-right min-w-[100px]">{MONTH_LABELS[m]}</th>
              )}
              {view === 'variance'
                ? [
                    <th key="yp" className="px-2 py-1.5 text-right bg-muted">YTD План</th>,
                    <th key="ya" className="px-2 py-1.5 text-right bg-muted">YTD Факт</th>,
                    <th key="yv" className="px-2 py-1.5 text-right bg-muted">Δ %</th>,
                  ]
                : <th className="px-2 py-1.5 text-right bg-muted">YTD</th>}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map(row => (
              <tr key={row.row_key} className="border-t">
                <td className="px-2 py-1 sticky left-0 bg-background border-r"
                    style={{ paddingLeft: `${8 + row.indent_level * 12}px` }}>
                  {row.label_bg}
                </td>
                {months.map(m => {
                  const c = row.cells[m]
                  if (view === 'plan')   return <td key={m} className="px-2 py-1 text-right tabular-nums border-r">{fmtNumber(c.plan, row.display_format)}</td>
                  if (view === 'actual') return <td key={m} className="px-2 py-1 text-right tabular-nums border-r">{fmtNumber(c.actual, row.display_format)}</td>
                  return [
                    <td key={`${m}p`} className="px-2 py-1 text-right tabular-nums text-muted-foreground border-r">{fmtNumber(c.plan, row.display_format)}</td>,
                    <td key={`${m}a`} className="px-2 py-1 text-right tabular-nums border-r">{fmtNumber(c.actual, row.display_format)}</td>,
                    <td key={`${m}v`} className={cn('px-2 py-1 text-right tabular-nums border-r', varianceClass(c.variance_pct, row.row_type))}>
                      {c.variance_pct === null ? '' : `${c.variance_pct.toFixed(1)}%`}
                    </td>,
                  ]
                })}
                {view === 'plan'   && <td className="px-2 py-1 text-right tabular-nums bg-muted/30">{fmtNumber(row.ytd.plan, row.display_format)}</td>}
                {view === 'actual' && <td className="px-2 py-1 text-right tabular-nums bg-muted/30">{fmtNumber(row.ytd.actual, row.display_format)}</td>}
                {view === 'variance' && [
                  <td key="yp" className="px-2 py-1 text-right tabular-nums bg-muted/30 text-muted-foreground">{fmtNumber(row.ytd.plan, row.display_format)}</td>,
                  <td key="ya" className="px-2 py-1 text-right tabular-nums bg-muted/30">{fmtNumber(row.ytd.actual, row.display_format)}</td>,
                  <td key="yv" className={cn('px-2 py-1 text-right tabular-nums bg-muted/30', varianceClass(row.ytd.variance_pct, row.row_type))}>
                    {row.ytd.variance_pct === null ? '' : `${row.ytd.variance_pct.toFixed(1)}%`}
                  </td>,
                ]}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add components/finance/OpReportView.tsx
git commit -m "feat(opreport): add OpReportView with Plan/Actual/Variance modes"
```

---

## Task 21: UI — OpReportTab + integrate into UsaliReportsClient

**Files:**
- Create: `components/finance/OpReportTab.tsx`
- Modify: `components/finance/UsaliReportsClient.tsx`

- [ ] **Step 1: Create OpReportTab**

```tsx
// components/finance/OpReportTab.tsx
'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { OpReportBudgetGrid } from './OpReportBudgetGrid'
import { OpReportView } from './OpReportView'

interface Props {
  propertyId: string
  year: number
}

export function OpReportTab({ propertyId, year }: Props) {
  const [inner, setInner] = useState<'budget' | 'report'>('report')
  const [operatingMonths, setOperatingMonths] = useState<number[]>([1,2,3,4,5,6,7,8,9,10,11,12])

  useEffect(() => {
    // Load operating months from property
    let abort = false
    async function load() {
      const r = await fetch(`/api/finance/properties/${propertyId}`).then(r => r.json()).catch(() => null)
      if (abort) return
      if (r && Array.isArray(r.operating_months) && r.operating_months.length > 0) {
        setOperatingMonths(r.operating_months)
      }
    }
    load()
    return () => { abort = true }
  }, [propertyId])

  return (
    <div className="space-y-3">
      <div className="flex gap-1 text-xs">
        <button onClick={() => setInner('report')}
          className={cn('px-3 py-1.5 border rounded-t border-b-0', inner === 'report' ? 'bg-background' : 'bg-muted')}>
          Отчет
        </button>
        <button onClick={() => setInner('budget')}
          className={cn('px-3 py-1.5 border rounded-t border-b-0', inner === 'budget' ? 'bg-background' : 'bg-muted')}>
          Бюджет
        </button>
      </div>
      {inner === 'budget'
        ? <OpReportBudgetGrid propertyId={propertyId} year={year} operatingMonths={operatingMonths} />
        : <OpReportView      propertyId={propertyId} year={year} />
      }
    </div>
  )
}
```

- [ ] **Step 2: Modify UsaliReportsClient to add the tab**

In `components/finance/UsaliReportsClient.tsx`:

1. Add import:
```tsx
import { OpReportTab } from './OpReportTab'
```

2. Extend `tabs` array:
```tsx
const tabs = [
  { key: 'departmental', label: 'Департаментален' },
  { key: 'summary', label: 'Обобщен (GOP/NOI)' },
  { key: 'revenue', label: 'Revenue Analysis' },
  { key: 'opreport', label: 'Операционен P&L' },
] as const
```

3. Add rendering at the bottom, after existing tabs:
```tsx
{tab === 'opreport' && propertyId && (
  <OpReportTab propertyId={propertyId} year={year} />
)}
```

- [ ] **Step 3: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 4: Browser smoke**

`npm run dev`, log in as ADMIN_CO, navigate to `/finance/usali-reports`. Click **Операционен P&L** tab. Switch between "Отчет" / "Бюджет". Edit a cell in Бюджет — it should persist (verify by reloading page).

- [ ] **Step 5: Commit**

```bash
git add components/finance/OpReportTab.tsx components/finance/UsaliReportsClient.tsx
git commit -m "feat(opreport): integrate Operational P&L tab into USALI reports page"
```

---

## Task 22: Print view page

**Files:**
- Create: `app/(finance)/finance/usali-reports/opreport/print/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(finance)/finance/usali-reports/opreport/print/page.tsx
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { hasPermission } from '@/lib/finance/permissions'
import { computeOperationalReport } from '@/lib/finance/opreport/compute'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ property_id?: string; year?: string; vat_mode?: string }>
}

export default async function OpReportPrintPage({ searchParams }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/login')
  if (!(await hasPermission(user, 'opreport.view'))) redirect('/finance')

  const sp = await searchParams
  const propertyId = sp.property_id ?? ''
  const year = parseInt(sp.year ?? String(new Date().getFullYear()), 10)
  const vatMode = (sp.vat_mode === 'gross' ? 'gross' : 'net') as 'net' | 'gross'

  const allowed = await getUserPropertyIds(user)
  if (allowed && !allowed.includes(propertyId)) redirect('/finance')

  const supabase = await createClient()
  const { data: property } = await supabase
    .from('properties')
    .select('name')
    .eq('id', propertyId)
    .single()

  const matrix = await computeOperationalReport(propertyId, year, vatMode)
  const months = matrix.operating_months.slice().sort((a, b) => a - b)
  const LABELS = ['','Яну','Фев','Мар','Апр','Май','Юни','Юли','Авг','Сеп','Окт','Ное','Дек']

  const fmt = (v: number | null, f: 'NUMBER'|'PERCENT'|'CURRENCY') => {
    if (v === null) return ''
    if (f === 'PERCENT') return `${v.toFixed(1)}%`
    return v.toLocaleString('bg-BG', { maximumFractionDigits: 2 })
  }

  return (
    <div className="p-6 print:p-3 text-[11px] print:text-[9px]">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d4d4d4; padding: 2px 4px; }
        th { background: #f4f4f4; text-align: right; }
        th:first-child, td:first-child { text-align: left; }
      `}</style>

      <h1 className="text-base font-semibold mb-2">
        {property?.name} — Операционен P&L {year} ({vatMode === 'gross' ? 'С ДДС' : 'Без ДДС'})
      </h1>

      <table>
        <thead>
          <tr>
            <th>Ред</th>
            {months.map(m => <th key={m}>{LABELS[m]}</th>)}
            <th>YTD</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map(row => (
            <tr key={row.row_key}>
              <td style={{ paddingLeft: `${4 + row.indent_level * 8}px` }}>{row.label_bg}</td>
              {months.map(m => (
                <td key={m} style={{ textAlign: 'right' }}>
                  {fmt(row.cells[m].actual, row.display_format)}
                </td>
              ))}
              <td style={{ textAlign: 'right' }}>{fmt(row.ytd.actual, row.display_format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Browser smoke**

Open (replace UUID with your property):
```
http://localhost:3000/finance/usali-reports/opreport/print?property_id=<UUID>&year=2025&vat_mode=net
```
Print the page (Ctrl+P / Cmd+P) and verify it lays out cleanly as A4 landscape.

- [ ] **Step 3: Commit**

```bash
git add "app/(finance)/finance/usali-reports/opreport/print/page.tsx"
git commit -m "feat(opreport): add print-friendly report page for PDF export"
```

---

## Task 23: Property form — new fields

**Files:**
- Modify: `components/finance/PropertyForm.tsx`

- [ ] **Step 1: Add state for new fields**

Inside `PropertyForm`, add state near the existing `type`/`category`/`status`:

```tsx
const [roomsMain, setRoomsMain] = useState(property?.rooms_main ?? 0)
const [roomsAnnex, setRoomsAnnex] = useState(property?.rooms_annex ?? 0)
const [totalBeds, setTotalBeds] = useState(property?.total_beds ?? 0)
const [annualRent, setAnnualRent] = useState(property?.annual_rent ?? 0)
const [operatingMonths, setOperatingMonths] = useState<number[]>(
  property?.operating_months ?? [1,2,3,4,5,6,7,8,9,10,11,12]
)
```

- [ ] **Step 2: In `handleSubmit`, attach the new fields to `body`**

Immediately after the existing FormData loop:

```tsx
body.rooms_main = roomsMain
body.rooms_annex = roomsAnnex
body.total_beds = totalBeds
body.annual_rent = annualRent
body.operating_months = operatingMonths
```

- [ ] **Step 3: Add form fields in JSX**

Add a new section below existing category/status fields (keep Tailwind grid style consistent):

```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <Label>Брой стаи (основна сграда)</Label>
    <Input type="number" min={0} value={roomsMain} onChange={e => setRoomsMain(parseInt(e.target.value) || 0)} />
  </div>
  <div>
    <Label>Брой стаи (анекс)</Label>
    <Input type="number" min={0} value={roomsAnnex} onChange={e => setRoomsAnnex(parseInt(e.target.value) || 0)} />
  </div>
  <div>
    <Label>Общ брой легла</Label>
    <Input type="number" min={0} value={totalBeds} onChange={e => setTotalBeds(parseInt(e.target.value) || 0)} />
  </div>
  <div>
    <Label>Годишен наем (EUR)</Label>
    <Input type="number" min={0} step="0.01" value={annualRent} onChange={e => setAnnualRent(parseFloat(e.target.value) || 0)} />
  </div>
  <div className="col-span-2">
    <Label>Работни месеци</Label>
    <div className="flex flex-wrap gap-1 mt-1">
      {['Яну','Фев','Мар','Апр','Май','Юни','Юли','Авг','Сеп','Окт','Ное','Дек'].map((name, idx) => {
        const m = idx + 1
        const active = operatingMonths.includes(m)
        return (
          <button
            type="button"
            key={m}
            onClick={() => {
              setOperatingMonths(prev =>
                prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b)
              )
            }}
            className={cn(
              'px-2 py-1 text-xs border rounded',
              active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'
            )}
          >
            {name}
          </button>
        )
      })}
    </div>
  </div>
</div>
```

Also add `import { cn } from '@/lib/utils'` at the top if not already present.

- [ ] **Step 4: Update the property API routes to accept these fields**

Check `app/api/finance/properties/route.ts` and `app/api/finance/properties/[id]/route.ts`. They should already parse via the Zod schema modified in Task 7 — so they'll pass the new fields through to the DB insert/update automatically. Verify that the select/return includes the new fields.

If the route uses explicit field allowlisting (not schema-inferred), append the new fields to both POST (insert) and PUT (update) payload objects:

```tsx
{
  // ...existing fields
  rooms_main: parsed.data.rooms_main ?? 0,
  rooms_annex: parsed.data.rooms_annex ?? 0,
  total_beds: parsed.data.total_beds ?? 0,
  annual_rent: parsed.data.annual_rent ?? 0,
  operating_months: parsed.data.operating_months ?? [1,2,3,4,5,6,7,8,9,10,11,12],
}
```

- [ ] **Step 5: Typecheck + build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 6: Browser smoke**

Edit an existing property (e.g., Riverside) at `/finance/properties/<id>`. Set:
- rooms_main = 77, rooms_annex = 31, total_beds = 169, annual_rent = 80000
- operating_months: select only Apr–Oct
Save and reload — values should persist. Check DB:
```sql
SELECT name, rooms_main, rooms_annex, total_beds, operating_months, annual_rent
FROM properties WHERE id = '<UUID>';
```

- [ ] **Step 7: Commit**

```bash
git add components/finance/PropertyForm.tsx app/api/finance/properties/
git commit -m "feat(properties): add rooms/beds/operating_months/annual_rent form fields"
```

---

## Task 24: End-to-end smoke + PR checklist

**Files:**
- None (manual verification)

- [ ] **Step 1: Final smoke walkthrough**

With `npm run dev` running and logged in as **ADMIN_CO**:

1. Navigate `/finance/properties/<riverside-id>` and confirm new fields are saved (77/31/169, Apr-Oct operating, 80000 EUR rent).
2. Navigate `/finance/usali-reports`, select Riverside, year 2025.
3. Click **Операционен P&L** tab.
4. Switch to **Бюджет** sub-tab. Enter a few cells (e.g. `accommodation_revenue` for Apr = 60000). Reload page — values persist.
5. Switch to **Отчет**. Confirm columns show only Apr-Oct (7 columns + YTD).
6. Toggle "Без ДДС" ↔ "С ДДС". Expense rows change for rows with VAT > 0 in their underlying expenses.
7. Toggle view Bug Plan / Факт / План vs Факт. Confirm color coding on variance.
8. Click **📥 Excel** — file downloads. Open and verify structure.
9. Click **📄 PDF** — new tab opens print view. Ctrl+P → preview landscape layout.

Log out, log in as **MANAGER**:
- Navigate `/finance/usali-reports` → should redirect (existing behavior). The opreport.view permission is false by default.

Log out, log in as **FINANCE_CO**:
- Navigate `/finance/usali-reports` → Операционен P&L tab accessible, can edit budget. Confirm cannot manage template (future feature, no UI yet).

- [ ] **Step 2: Baseline verifications**

```bash
npm run lint
npm run build
```
Expected: both succeed. Address any lint errors introduced by new code.

- [ ] **Step 3: Open a PR**

```bash
git push -u origin <your-branch>
gh pr create --title "feat: Operational P&L / Budget report (with Plan vs Actual, VAT toggle, Excel + PDF export)" \
  --body "$(cat <<'EOF'
## Summary

Adds a hotel-specific operational P&L report alongside existing USALI reports. Users enter a monthly budget per row per property; the report compares it to Actuals computed from existing `expenses`, `income_entries`, `property_statistics`, and the payroll module. VAT toggle flips between `amount_net` and `total_amount` on expense rows. Excel + print-to-PDF export supported.

- New tables: `opreport_rows`, `opreport_row_accounts`, `opreport_budgets`
- New property fields: `rooms_main`, `rooms_annex`, `total_beds`, `operating_months`, `annual_rent`
- New permissions: `opreport.view`, `opreport.edit_budget`, `opreport.manage_template`
- Default grants: ADMIN_CO + FINANCE_CO only

## Test plan

- [ ] Migrate (5 new migrations apply cleanly)
- [ ] Seed template: 40 rows inserted, 19 row-account mappings
- [ ] Property form: new fields save and reload correctly for Riverside (77/31 rooms, Apr-Oct, 80k rent)
- [ ] Budget grid: inline cell edits persist, YTD column auto-updates
- [ ] Report view Plan: shows budgeted values
- [ ] Report view Actual: matches hand-computed totals for one seeded month
- [ ] Report view Plan vs Actual: variance % colored correctly
- [ ] VAT toggle: expense rows differ between net and gross
- [ ] Seasonal property: only 7 month columns shown
- [ ] Rent row: annual_rent / 7 for each Apr-Oct column, 0 otherwise
- [ ] Excel export: file downloads and opens cleanly
- [ ] PDF export (print view): lays out cleanly in A4 landscape
- [ ] MANAGER / DEPT_HEAD: tab not accessible
- [ ] FINANCE_CO: same access as ADMIN_CO except template management

## Spec

See `docs/superpowers/specs/2026-04-20-operational-pl-report-design.md`.
EOF
)"
```

---

## Self-Review Notes

**Spec coverage check (gaps filled as tasks):**

| Spec section | Task(s) |
|---|---|
| `opreport_rows` / `opreport_row_accounts` / `opreport_budgets` tables | 1 |
| `properties` alterations | 2 |
| Permissions | 3 |
| Template seed (35 rows) | 4 |
| Account mappings | 5 |
| TypeScript types | 6 |
| Zod schemas | 7 |
| `xlsx` dependency | 8 |
| Formula evaluator + topo sort | 9 |
| Period utilities | 10 |
| Template fetcher | 11 |
| Report computation (all row types) | 12 |
| Excel workbook builder | 13 |
| `GET /template` | 14 |
| `GET+PUT /budget` | 15 |
| `GET /report` | 16 |
| `GET /export/xlsx` | 17 |
| `OpReportCell` | 18 |
| `OpReportBudgetGrid` | 19 |
| `OpReportView` (plan/actual/variance, VAT toggle, export menu) | 20 |
| Integration into UsaliReportsClient | 21 |
| Print view page | 22 |
| Property form UI | 23 |
| E2E smoke + PR | 24 |

**Known simplifications / explicit deferrals:**

- The payroll aggregation in Task 12 uses a linear pro-rata of `actual_salary` by worked days and a fixed 18.8% contributions rate. If the existing payroll module already exposes a monthly totals service, prefer that and delete the approximation — the approximation is a safety fallback, not a spec-level design choice. Flag this to the reviewer.
- The drill-down popover on `Actual` cells (spec §UI) is not implemented in this plan. It can be added as a follow-up without changing any schemas. If you want it in v1, add a Task between 20 and 21 that extends `OpReportView` with a `<details>` element reading from a new `/api/finance/opreport/drilldown` route.
- Income VAT handling assumes `income_entries.amount` is net; if the schema later adds `vat_amount`/`total_amount`, update the `fetchIncomeActuals` function in `lib/finance/opreport/compute.ts` to honor `vatMode`.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-20-operational-pl-report.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
