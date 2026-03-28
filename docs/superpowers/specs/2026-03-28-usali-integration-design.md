# USALI Integration Design

## Goal

Integrate USALI (Uniform System of Accounts for the Lodging Industry) standards into the existing hotel finance system — full hierarchical chart of accounts with 3 levels, configurable department templates, category migration, departmental P&L, GOP/NOI summary, and Revenue Analysis KPIs.

## Architecture

The USALI layer adds two core tables (`usali_department_templates`, `usali_accounts`) and one budget table (`usali_budgets`), plus a `property_statistics` table for future PMS integration. Existing `expenses` and `income_entries` tables gain an `account_id` FK replacing the old `category` enum. Departments gain a `usali_template_id` FK linking them to USALI department types. A seed migration provides a ready-to-use USALI-based chart of accounts. Three new report views aggregate data by USALI structure.

## Tech Stack

- PostgreSQL (Supabase) for schema, views, RLS
- Next.js 16 App Router for pages/API routes
- Existing finance component patterns (server pages, client forms, spreadsheet UI)

---

## 1. Database Schema

### 1.1 `usali_department_templates`

Configurable system-level USALI department types. Admin can activate/deactivate.

```sql
CREATE TABLE usali_department_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,          -- 'ROOMS', 'FB', 'SPA', 'AG', etc.
  name TEXT NOT NULL,                  -- Bulgarian: 'Стаи', 'Храна и напитки'
  category TEXT NOT NULL               -- 'OPERATED' | 'UNDISTRIBUTED' | 'FIXED'
    CHECK (category IN ('OPERATED', 'UNDISTRIBUTED', 'FIXED')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Seed data (11 templates):**

| code | name | category | sort_order |
|------|------|----------|------------|
| ROOMS | Стаи | OPERATED | 10 |
| FB | Храна и напитки | OPERATED | 20 |
| SPA | Спа и уелнес | OPERATED | 30 |
| OTHER_OPERATED | Други оперативни | OPERATED | 40 |
| AG | Администрация | UNDISTRIBUTED | 50 |
| SALES_MARKETING | Маркетинг и продажби | UNDISTRIBUTED | 60 |
| POMEC | Поддръжка | UNDISTRIBUTED | 70 |
| UTILITIES | Комунални | UNDISTRIBUTED | 80 |
| IT | ИТ и телекомуникации | UNDISTRIBUTED | 90 |
| MGMT_FEES | Управленска такса | FIXED | 100 |
| INSURANCE | Застраховки | FIXED | 110 |
| TAXES | Данъци и такси | FIXED | 120 |

### 1.2 `usali_accounts` (3-level hierarchy)

Free numbering scheme following USALI structure.

```sql
CREATE TABLE usali_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,            -- free numbering: '1000', '1100', '1101'
  name TEXT NOT NULL,                    -- 'Приходи от нощувки'
  account_type TEXT NOT NULL             -- 'REVENUE' | 'EXPENSE'
    CHECK (account_type IN ('REVENUE', 'EXPENSE')),
  level INT NOT NULL                     -- 1, 2, or 3
    CHECK (level BETWEEN 1 AND 3),
  parent_id UUID REFERENCES usali_accounts(id),
  template_id UUID NOT NULL REFERENCES usali_department_templates(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- Level 1 = group (e.g., "1000 Приходи от стаи")
- Level 2 = subgroup (e.g., "1100 Нощувки")
- Level 3 = leaf account (e.g., "1101 Стаи")
- Only level 3 accounts are selectable when entering expenses/income
- `parent_id`: level 2 → level 1, level 3 → level 2, level 1 → NULL

### 1.3 `usali_budgets`

Monthly budget per account per property.

```sql
CREATE TABLE usali_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  account_id UUID NOT NULL REFERENCES usali_accounts(id),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, account_id, year, month)
);
```

### 1.4 `property_statistics` (for PMS integration)

Prepopulated by PMS later. Manual entry possible.

```sql
CREATE TABLE property_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  date DATE NOT NULL,
  rooms_available INT NOT NULL DEFAULT 0,
  rooms_sold INT NOT NULL DEFAULT 0,
  guests INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, date)
);
```

### 1.5 Alterations to existing tables

**`departments`** — add USALI template link:
```sql
ALTER TABLE departments ADD COLUMN usali_template_id UUID REFERENCES usali_department_templates(id);
```

**`expenses`** — add account, migrate, drop category:
```sql
-- Step 1: Add nullable account_id
ALTER TABLE expenses ADD COLUMN account_id UUID REFERENCES usali_accounts(id);

-- Step 2: Migration mapping (see section 3)
-- Maps old category values to new account IDs

-- Step 3: Make NOT NULL, drop old column
ALTER TABLE expenses ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE expenses DROP COLUMN category;
```

**`income_entries`** — same pattern:
```sql
ALTER TABLE income_entries ADD COLUMN account_id UUID REFERENCES usali_accounts(id);
-- Migration mapping
ALTER TABLE income_entries ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE income_entries DROP COLUMN category;
```

---

## 2. Seed Chart of Accounts

Full USALI-based chart with free numbering. All created during migration.

### OPERATED: Rooms (ROOMS)

| Code | Name | Type | Level |
|------|------|------|-------|
| 1000 | Приходи от стаи | REVENUE | 1 |
| 1100 | Нощувки | REVENUE | 2 |
| 1101 | Стаи | REVENUE | 3 |
| 1102 | Късно напускане / Ранно настаняване | REVENUE | 3 |
| 1200 | Допълнителни услуги | REVENUE | 2 |
| 1201 | Мини-бар | REVENUE | 3 |
| 1202 | Пералня / Химическо чистене | REVENUE | 3 |
| 2000 | Разходи стаи | EXPENSE | 1 |
| 2100 | Персонал стаи | EXPENSE | 2 |
| 2101 | Заплати стаи | EXPENSE | 3 |
| 2102 | Осигуровки стаи | EXPENSE | 3 |
| 2200 | Оперативни стаи | EXPENSE | 2 |
| 2201 | Консумативи стаи | EXPENSE | 3 |
| 2202 | Пералня | EXPENSE | 3 |
| 2203 | Декорация / Цветя | EXPENSE | 3 |

### OPERATED: F&B (FB)

| Code | Name | Type | Level |
|------|------|------|-------|
| 3000 | Приходи F&B | REVENUE | 1 |
| 3100 | Ресторант | REVENUE | 2 |
| 3101 | Храна | REVENUE | 3 |
| 3102 | Напитки ресторант | REVENUE | 3 |
| 3200 | Бар | REVENUE | 2 |
| 3201 | Напитки бар | REVENUE | 3 |
| 3300 | Банкети / Събития | REVENUE | 2 |
| 3301 | Банкети | REVENUE | 3 |
| 4000 | Разходи F&B | EXPENSE | 1 |
| 4100 | Персонал F&B | EXPENSE | 2 |
| 4101 | Заплати F&B | EXPENSE | 3 |
| 4102 | Осигуровки F&B | EXPENSE | 3 |
| 4200 | Себестойност F&B | EXPENSE | 2 |
| 4201 | Хранителни продукти | EXPENSE | 3 |
| 4202 | Напитки (себестойност) | EXPENSE | 3 |
| 4300 | Оперативни F&B | EXPENSE | 2 |
| 4301 | Прибори / Посуда | EXPENSE | 3 |
| 4302 | Декорация F&B | EXPENSE | 3 |

### OPERATED: Spa (SPA)

| Code | Name | Type | Level |
|------|------|------|-------|
| 5000 | Приходи Spa | REVENUE | 1 |
| 5100 | Услуги Spa | REVENUE | 2 |
| 5101 | Процедури | REVENUE | 3 |
| 5102 | Фитнес / Басейн | REVENUE | 3 |
| 6000 | Разходи Spa | EXPENSE | 1 |
| 6100 | Персонал Spa | EXPENSE | 2 |
| 6101 | Заплати Spa | EXPENSE | 3 |
| 6102 | Осигуровки Spa | EXPENSE | 3 |
| 6200 | Оперативни Spa | EXPENSE | 2 |
| 6201 | Козметика / Препарати | EXPENSE | 3 |
| 6202 | Консумативи Spa | EXPENSE | 3 |

### UNDISTRIBUTED: A&G (AG)

| Code | Name | Type | Level |
|------|------|------|-------|
| 7000 | Разходи администрация | EXPENSE | 1 |
| 7100 | Персонал администрация | EXPENSE | 2 |
| 7101 | Заплати администрация | EXPENSE | 3 |
| 7102 | Осигуровки администрация | EXPENSE | 3 |
| 7200 | Оперативни администрация | EXPENSE | 2 |
| 7201 | Счетоводство | EXPENSE | 3 |
| 7202 | Юридически услуги | EXPENSE | 3 |
| 7203 | Офис консумативи | EXPENSE | 3 |
| 7204 | Банкови такси | EXPENSE | 3 |

### UNDISTRIBUTED: Sales & Marketing (SALES_MARKETING)

| Code | Name | Type | Level |
|------|------|------|-------|
| 7500 | Разходи маркетинг | EXPENSE | 1 |
| 7510 | Персонал маркетинг | EXPENSE | 2 |
| 7511 | Заплати маркетинг | EXPENSE | 3 |
| 7520 | Оперативни маркетинг | EXPENSE | 2 |
| 7521 | Реклама | EXPENSE | 3 |
| 7522 | Комисионни OTA | EXPENSE | 3 |
| 7523 | Представителни разходи | EXPENSE | 3 |

### UNDISTRIBUTED: POMEC (POMEC)

| Code | Name | Type | Level |
|------|------|------|-------|
| 8000 | Разходи поддръжка | EXPENSE | 1 |
| 8100 | Персонал поддръжка | EXPENSE | 2 |
| 8101 | Заплати поддръжка | EXPENSE | 3 |
| 8200 | Оперативни поддръжка | EXPENSE | 2 |
| 8201 | Ремонти сграда | EXPENSE | 3 |
| 8202 | Ремонти оборудване | EXPENSE | 3 |
| 8203 | Резервни части | EXPENSE | 3 |

### UNDISTRIBUTED: Utilities (UTILITIES)

| Code | Name | Type | Level |
|------|------|------|-------|
| 8500 | Разходи комунални | EXPENSE | 1 |
| 8510 | Електричество | EXPENSE | 2 |
| 8511 | Ел. енергия | EXPENSE | 3 |
| 8520 | Вода | EXPENSE | 2 |
| 8521 | ВиК | EXPENSE | 3 |
| 8530 | Отопление | EXPENSE | 2 |
| 8531 | Газ / Гориво | EXPENSE | 3 |

### UNDISTRIBUTED: IT (IT)

| Code | Name | Type | Level |
|------|------|------|-------|
| 8700 | Разходи ИТ | EXPENSE | 1 |
| 8710 | Персонал ИТ | EXPENSE | 2 |
| 8711 | Заплати ИТ | EXPENSE | 3 |
| 8720 | Оперативни ИТ | EXPENSE | 2 |
| 8721 | Софтуер и лицензи | EXPENSE | 3 |
| 8722 | Хардуер | EXPENSE | 3 |
| 8723 | Телекомуникации | EXPENSE | 3 |

### FIXED: Management Fees (MGMT_FEES)

| Code | Name | Type | Level |
|------|------|------|-------|
| 9000 | Управленска такса | EXPENSE | 1 |
| 9010 | Управленска такса | EXPENSE | 2 |
| 9011 | Управленска такса | EXPENSE | 3 |

### FIXED: Insurance (INSURANCE)

| Code | Name | Type | Level |
|------|------|------|-------|
| 9200 | Застраховки | EXPENSE | 1 |
| 9210 | Имуществени застраховки | EXPENSE | 2 |
| 9211 | Застраховка сгради | EXPENSE | 3 |
| 9212 | Застраховка оборудване | EXPENSE | 3 |

### FIXED: Taxes (TAXES)

| Code | Name | Type | Level |
|------|------|------|-------|
| 9400 | Данъци и такси | EXPENSE | 1 |
| 9410 | Местни данъци | EXPENSE | 2 |
| 9411 | Данък сгради | EXPENSE | 3 |
| 9412 | Такса смет | EXPENSE | 3 |
| 9413 | Туристически данък | EXPENSE | 3 |

---

## 3. Category Migration Mapping

Old expense `category` enum → new `account_id` (by code):

| Old Category | → Account Code | Account Name |
|---|---|---|
| CONSUMABLES | 2201 | Консумативи стаи |
| SALARIES | 2101 | Заплати стаи |
| FOOD_KITCHEN | 4201 | Хранителни продукти |
| FUEL | 8531 | Газ / Гориво |
| TAXES_FEES | 9411 | Данък сгради |
| MAINTENANCE | 8201 | Ремонти сграда |
| UTILITIES | 8511 | Ел. енергия |
| MARKETING | 7521 | Реклама |
| INSURANCE | 9211 | Застраховка сгради |
| ACCOUNTING | 7201 | Счетоводство |
| OTHER | 7203 | Офис консумативи |

Old income `category` enum → new `account_id`:

| Old Category | → Account Code | Account Name |
|---|---|---|
| ACCOMMODATION | 1101 | Стаи |
| FB | 3101 | Храна |
| SPA | 5101 | Процедури |
| FEES | 7204 | Банкови такси |
| COMMISSIONS | 7522 | Комисионни OTA |
| OTHER | 1201 | Мини-бар |

Migration strategy:
1. Create `usali_department_templates` + seed data
2. Create `usali_accounts` + seed chart of accounts
3. Add `account_id` (nullable) to `expenses` and `income_entries`
4. UPDATE existing rows using mapping table
5. ALTER `account_id` to NOT NULL
6. DROP old `category` columns and their CHECK constraints
7. Update TypeScript types and enums accordingly

---

## 4. USALI Reports

### 4.1 Departmental Income Statement

**API:** `GET /api/finance/usali-reports/departmental`

**Query params:** `property_id`, `year`, `month`

**Logic:**
- For each active OPERATED template:
  - Sum `income_entries.amount` where `account.template_id = template.id` AND `account.account_type = 'REVENUE'`
  - Sum `expenses.total_amount` where `account.template_id = template.id` AND `account.account_type = 'EXPENSE'`
  - Group by level 2 account for breakdown
  - Departmental Profit = Revenue - Expenses
  - Margin % = Departmental Profit / Revenue * 100
- Join `usali_budgets` for budget column (if exists for that month)
- Variance = Actual - Budget

**Response shape:**
```typescript
interface DepartmentalReport {
  property: { id: string; name: string }
  period: { year: number; month: number }
  departments: {
    template: { code: string; name: string }
    revenue: {
      groups: { account: AccountInfo; amount: number; budget: number }[]
      total: number; totalBudget: number
    }
    expenses: {
      groups: { account: AccountInfo; amount: number; budget: number }[]
      total: number; totalBudget: number
    }
    profit: number; profitBudget: number
    margin: number
  }[]
}
```

### 4.2 Summary Operating Statement (GOP / NOI)

**API:** `GET /api/finance/usali-reports/summary`

**Query params:** `property_id`, `year`, `month`

**Logic:**
- Aggregate departmental profits from 4.1 for OPERATED departments
- Sum UNDISTRIBUTED expenses by template
- GOP = Total Departmental Profit - Total Undistributed
- Sum FIXED charges by template
- NOI = GOP - Total Fixed
- GOP% and NOI% = relative to Total Revenue
- YTD: same aggregation from month 1 to current month

**Response shape:**
```typescript
interface SummaryReport {
  property: { id: string; name: string }
  period: { year: number; month: number }
  operatedDepartments: {
    template: { code: string; name: string }
    profit: number; profitYtd: number
  }[]
  totalDepartmentalProfit: number; totalDepartmentalProfitYtd: number
  undistributed: {
    template: { code: string; name: string }
    amount: number; amountYtd: number
  }[]
  totalUndistributed: number; totalUndistributedYtd: number
  gop: number; gopYtd: number
  gopPercent: number; gopPercentYtd: number
  fixedCharges: {
    template: { code: string; name: string }
    amount: number; amountYtd: number
  }[]
  totalFixed: number; totalFixedYtd: number
  noi: number; noiYtd: number
  noiPercent: number; noiPercentYtd: number
}
```

### 4.3 Revenue Analysis (KPIs)

**API:** `GET /api/finance/usali-reports/revenue-analysis`

**Query params:** `property_id`, `year`, `month`

**Logic:**
- From `property_statistics`: sum rooms_available, rooms_sold, guests for the month
- Room Revenue: sum income_entries where account is under ROOMS template + REVENUE type
- Total Revenue: sum all REVENUE income_entries for the property/month
- Occupancy % = Rooms Sold / Rooms Available * 100
- ADR = Room Revenue / Rooms Sold
- RevPAR = Room Revenue / Rooms Available
- Total Revenue per Available Room = Total Revenue / Rooms Available
- Previous month and YoY (same month last year) for comparison

**Response shape:**
```typescript
interface RevenueAnalysis {
  property: { id: string; name: string }
  period: { year: number; month: number }
  current: KpiSet
  previousMonth: KpiSet | null
  previousYear: KpiSet | null
}

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
```

---

## 5. UI Changes

### 5.1 Sidebar additions

In `FinanceSidebar.tsx` navItems:
- Add `{ href: '/finance/usali-reports', label: 'USALI Отчети', icon: BarChart3, roles: ['ADMIN_CO', 'FINANCE_CO'] }`
- The "Сметкоплан" management is accessible from Properties admin page, not a separate sidebar item

### 5.2 Chart of Accounts management (`/finance/properties/chart-of-accounts`)

- Tree-view table with 3 collapsible levels
- Columns: Код, Наименование, Тип (Приход/Разход), Департамент, Статус (active/inactive)
- "Нова сметка" button opens form: code, name, type, parent (dropdown filtered by level), department template
- "Департаменти" button opens template management: toggle is_active per template
- Only ADMIN_CO can access

### 5.3 USALI Reports page (`/finance/usali-reports`)

- 3 tabs: **Департаментален** | **Обобщен (GOP/NOI)** | **Revenue Analysis**
- Property selector + Month/Year picker as filters
- Each tab renders its respective table as shown in section 4
- Budget column shown when data exists in `usali_budgets`
- Numbers formatted with Bulgarian locale (thousands separator, 2 decimal places)

### 5.4 Expense/Income spreadsheet changes

- "Категория" column replaced with "Сметка" column
- Account picker: flat dropdown with visual indent for hierarchy
  - Format: `[code] name` with indent by level
  - Only level 3 accounts selectable
  - Filtered by type: EXPENSE accounts in expense form, REVENUE accounts in income form
- Existing records show their mapped account

### 5.5 Department form changes

- Add "USALI Департамент" dropdown in department create/edit form
- Dropdown shows active templates from `usali_department_templates`
- Optional field (nullable FK)

### 5.6 Monthly Report enhancement

- Add "USALI" tab/section alongside existing format
- Shows departmental P&L summary for the selected property/month

---

## 6. RLS Policies

- `usali_department_templates`: SELECT for all finance roles, INSERT/UPDATE/DELETE for ADMIN_CO only
- `usali_accounts`: SELECT for all finance roles, INSERT/UPDATE/DELETE for ADMIN_CO only
- `usali_budgets`: SELECT for all finance roles (filtered by property access), INSERT/UPDATE/DELETE for ADMIN_CO and FINANCE_CO
- `property_statistics`: SELECT for all finance roles (filtered by property access), INSERT/UPDATE for ADMIN_CO and FINANCE_CO

---

## 7. TypeScript Type Changes

### New types
```typescript
type UsaliDepartmentCategory = 'OPERATED' | 'UNDISTRIBUTED' | 'FIXED'
type UsaliAccountType = 'REVENUE' | 'EXPENSE'

interface UsaliDepartmentTemplate {
  id: string
  code: string
  name: string
  category: UsaliDepartmentCategory
  sort_order: number
  is_active: boolean
}

interface UsaliAccount {
  id: string
  code: string
  name: string
  account_type: UsaliAccountType
  level: number
  parent_id: string | null
  template_id: string
  is_active: boolean
  sort_order: number
}

interface UsaliBudget {
  id: string
  property_id: string
  account_id: string
  year: number
  month: number
  amount: number
}

interface PropertyStatistics {
  id: string
  property_id: string
  date: string
  rooms_available: number
  rooms_sold: number
  guests: number
}
```

### Modified types
- `Expense`: remove `category: ExpenseCategory`, add `account_id: string`
- `IncomeEntry`: remove `category: IncomeCategory`, add `account_id: string`
- `Department`: add `usali_template_id: string | null`
- Remove `ExpenseCategory` and `IncomeCategory` enums

### New Zod schemas
- `usaliAccountSchema` for account CRUD validation
- `usaliBudgetSchema` for budget entry validation
- Update `expenseSchema` and `incomeSchema` to use `account_id` instead of `category`

---

## 8. API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/finance/usali-templates` | List department templates |
| PATCH | `/api/finance/usali-templates/[id]` | Toggle template active/inactive |
| GET | `/api/finance/usali-accounts` | List accounts (with hierarchy) |
| POST | `/api/finance/usali-accounts` | Create account |
| PATCH | `/api/finance/usali-accounts/[id]` | Update account |
| GET | `/api/finance/usali-budgets` | List budgets (by property/year) |
| POST | `/api/finance/usali-budgets` | Create/update budget entry |
| GET | `/api/finance/usali-reports/departmental` | Departmental Income Statement |
| GET | `/api/finance/usali-reports/summary` | Summary Operating Statement |
| GET | `/api/finance/usali-reports/revenue-analysis` | Revenue Analysis KPIs |
| GET | `/api/finance/property-statistics` | List property statistics |
| POST | `/api/finance/property-statistics` | Create/update statistics entry |

---

## 9. Migration Order

1. Create `usali_department_templates` table + seed 12 templates
2. Create `usali_accounts` table + seed full chart of accounts (~85 accounts)
3. Create `usali_budgets` table
4. Create `property_statistics` table
5. ALTER `departments` — add `usali_template_id`
6. ALTER `expenses` — add `account_id` (nullable)
7. ALTER `income_entries` — add `account_id` (nullable)
8. UPDATE `expenses` mapping old category → account_id
9. UPDATE `income_entries` mapping old category → account_id
10. ALTER `expenses.account_id` SET NOT NULL
11. ALTER `income_entries.account_id` SET NOT NULL
12. DROP old category columns and CHECK constraints
13. Add RLS policies for new tables
14. Update TypeScript types and Zod schemas
