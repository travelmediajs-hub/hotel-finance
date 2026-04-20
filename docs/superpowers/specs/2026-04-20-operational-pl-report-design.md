# Operational P&L / Budget Report Design

## Overview

A new report type alongside existing USALI reports: a hotel-specific operational P&L with Plan vs Actual comparison. Based on a real-world Excel template used for Hotel Riverside (`ZBudget _Riverside_01.04-31.10.2025.xlsx`).

Unlike USALI (which follows international uniform structure), this report groups revenue, expenses, payroll, statistics and derived KPIs into a fixed, hotel-operator-friendly template with Bulgarian labels. Budget is entered per row per month and compared against actual values from existing data (expenses, income, payroll, property statistics).

Lives as a new tab inside `/finance/usali-reports`. Two sub-views: **Бюджет** (grid editor) and **Отчет** (Plan vs Actual with variance).

## Goals

- Replace the manual Excel workflow with an in-app equivalent
- Reuse existing data (income entries, expenses, payroll, property statistics) as single source of truth for Actual
- Allow FINANCE_CO / ADMIN_CO to plan yearly budget per row per month
- Support seasonal properties (columns = operating months only)
- Support VAT toggle (net vs gross display) for revenue and expense rows
- Export to Excel (format-preserving) and PDF (print-friendly)

## Non-Goals

- Per-property customization of the row template (v1 = one global template)
- Multi-year comparison (v1 = single-year view)
- Forecasting / what-if modeling
- Automated variance alerts or notifications
- Per-department drill-down (existing USALI covers departmental views)

## Database

### New table: `opreport_rows`

Global, fixed template. One set of rows applied to all properties. Seeded once; changes go through new seed migrations.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `row_key` | text UNIQUE | stable identifier, e.g. `accommodation_revenue`, used in formulas and API |
| `label_bg` | text | Bulgarian UI label |
| `section` | text | e.g. `STATISTICS`, `REVENUE`, `FB_EXPENSES`, `STAFF`, `UTILITIES`, `OTHER_EXPENSES`, `TOTALS` |
| `sort_order` | int | ordering within section |
| `row_type` | text CHECK | one of: `HEADER`, `STAT`, `REVENUE`, `EXPENSE`, `PAYROLL`, `RENT`, `DERIVED` |
| `formula` | text NULL | only for `DERIVED`; simple arithmetic over `row_key` references |
| `source` | text NULL | only for `STAT` / `PAYROLL`; e.g. `property.rooms_main`, `property_statistics.guests`, `payroll.net_salary` |
| `vat_applicable` | boolean | `true` only for `REVENUE` / `EXPENSE`; controls whether global VAT toggle affects the row |
| `budgetable` | boolean | `true` only for rows the user can edit in the Budget grid |
| `display_format` | text CHECK | `NUMBER` \| `PERCENT` \| `CURRENCY` |
| `indent_level` | int | 0..3; visual nesting (e.g. `1. Food and vegetables` → `1.1 BGN per guest`) |

### New table: `opreport_row_accounts`

Many-to-many mapping from template rows to existing `usali_accounts`. Used only for `REVENUE` / `EXPENSE` rows.

| Column | Type | Notes |
|---|---|---|
| `row_id` | uuid FK → `opreport_rows` | cascade delete |
| `account_id` | uuid FK → `usali_accounts` | restrict delete |
| PRIMARY KEY | `(row_id, account_id)` | |

### New table: `opreport_budgets`

Budget values stored per row per month per property. One amount per cell.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `property_id` | uuid FK → `properties` | |
| `year` | int | 2020..2100 |
| `month` | int CHECK 1..12 | |
| `row_id` | uuid FK → `opreport_rows` | restrict delete |
| `amount` | decimal(14,2) | may be negative for rows that expect it |
| `created_at`, `updated_at` | timestamptz | |
| UNIQUE | `(property_id, year, month, row_id)` | |

RLS: CO roles (ADMIN_CO, FINANCE_CO) read/write all; other roles read rows only for their `user_property_access` properties. Write access additionally requires `opreport.edit_budget` permission.

### Alterations to `properties`

| Column | Type | Notes |
|---|---|---|
| `rooms_main` | int default 0 | main building room count |
| `rooms_annex` | int default 0 | annex room count (0 if none) |
| `total_beds` | int default 0 | total bed count |
| `operating_months` | int[] default `{1,2,3,4,5,6,7,8,9,10,11,12}` | months the property is operational |
| `annual_rent` | decimal(12,2) default 0 | yearly rent in EUR; distributed evenly across `operating_months` |

Constraint: `operating_months` contains only values 1..12, no duplicates, at least one element.

## Row Types and Computation

| Type | Plan (budget) | Actual | VAT toggle |
|---|---|---|---|
| `HEADER` | — | — | — |
| `STAT` | optional target from `opreport_budgets` | from `source`: property attribute, or aggregated from `property_statistics` | — |
| `REVENUE` | from `opreport_budgets` | `SUM(income_entries.amount)` for mapped accounts, in period | yes |
| `EXPENSE` | from `opreport_budgets` | `SUM(expenses.amount_net or total_amount)` for mapped accounts, in period | yes |
| `PAYROLL` | from `opreport_budgets` | from payroll module (net salary or employer contributions sum for month) | — |
| `RENT` | = Actual (read-only) | `properties.annual_rent / length(operating_months)` for operating months, 0 otherwise | — |
| `DERIVED` | computed from other Plan values | computed from other Actual values per `formula` | — |

### Formula evaluator

Simple expression parser supporting:

- Operators: `+`, `-`, `*`, `/`, parentheses
- Operands: numeric literals, `row_key` references (resolved in same column/month)
- Circular dependency check at template seed time; formulas must form a DAG

Examples:
```
avg_price_per_bed   = accommodation_revenue / booked_beds
fb_per_guest        = fb_total / booked_beds
total_revenue       = accommodation_revenue + fb_revenue
total_expenses      = fb_total + net_salary + social_contributions + electricity + heating_pellets + water + lpg + other_expenses + local_tax_per_night + laundry + software + tv_tel_internet + extraordinary + overbooking + accounting + booking_com_commission + facebook_ads + rent
profit              = total_revenue - total_expenses
net_profit_margin   = profit / total_revenue
avg_price_per_night = accommodation_revenue / rooms_sold
occupancy_rate      = rooms_sold / (rooms_available * working_days)
```

### YTD column

- For `STAT`/`REVENUE`/`EXPENSE`/`PAYROLL`/`RENT`: SUM across months
- For `DERIVED`: **recomputed** from YTD operands (not a sum of monthly derived values) to keep ratios meaningful
- For non-operating months: value = 0, excluded from averages where appropriate

## Template Seed (Initial Rows)

Sections in display order, matching the Excel:

**STATISTICS**
- `rooms_main` (STAT)
- `rooms_annex` (STAT)
- `total_beds` (STAT)
- `working_days` (STAT, derived from `operating_months` and period month)
- `occupancy_rate` (DERIVED, PERCENT format)
- `booked_beds` (STAT, from `SUM(property_statistics.guests)`)
- `avg_price_per_bed_hb` (DERIVED)

**REVENUE**
- `accommodation_revenue` (REVENUE → account `1101 Accommodation`)
- `fb_revenue` (REVENUE → account `3101 F&B`)
- `total_incomes` (DERIVED)

**F&B EXPENSES**
- `fb_total` (DERIVED: sum of subrows)
- `fb_per_guest` (DERIVED)
- `food_vegetables` (EXPENSE) — account mapping confirmed during seed migration
- `food_per_guest` (DERIVED)
- `soft_drinks_coffee` (EXPENSE)
- `soft_drinks_per_guest` (DERIVED)
- `hotel_supplies` (EXPENSE)
- `hotel_supplies_per_guest` (DERIVED)

**STAFF**
- `net_salary` (PAYROLL, source=`payroll.net_salary`)
- `social_contributions` (PAYROLL, source=`payroll.contributions`)

**UTILITIES**
- `electricity`, `heating_pellets`, `water`, `lpg` (all EXPENSE)

**OTHER EXPENSES**
- `local_tax_per_night`, `laundry`, `software`, `tv_tel_internet`, `extraordinary`, `overbooking`, `accounting`, `booking_com_commission`, `facebook_ads`, `other_expenses` (all EXPENSE)

**TOTALS**
- `rent` (RENT)
- `total_expenses` (DERIVED)
- `profit` (DERIVED)
- `net_profit_margin` (DERIVED, PERCENT)
- `avg_price_per_night` (DERIVED)

### Account mapping notes

For rows where a dedicated `usali_account` does not yet exist (e.g. "Heating - пелети" as a distinct category, "Booking.com commission", "Facebook ad"), the seed migration adds new accounts under appropriate USALI parents before inserting the mapping. The seed migration file is reviewable and editable before apply.

## UI

### Location

New tab **"Операционен P&L"** added to `/finance/usali-reports`. The tab contains two sub-sections controlled by an inner toggle: **Бюджет** and **Отчет**.

### Budget grid (Бюджет)

- Controls: property selector, year selector, global Save button
- Table: rows = all template rows (sections visible as sticky group headers), columns = months in `operating_months` of selected property + YTD
- Editable cells: `budgetable=true` rows only; other cells (DERIVED, RENT, HEADER) are read-only and auto-recomputed
- Excel-like cell UX: click to edit, Tab / arrow keys to navigate, debounced save on blur (individual cell PATCH)
- Left column sticky during horizontal scroll
- "Копирай от миналата година" button: populates empty cells from previous year's `opreport_budgets`
- Styling: reuse `DailyReportTable` cell pattern

### Report view (Отчет)

- Controls: property, year, VAT toggle (`Без ДДС` / `С ДДС`), view mode (`Plan` / `Actual` / `Plan vs Actual`), export buttons
- In **Plan vs Actual** mode: each month column splits into three sub-columns: Plan, Actual, Δ%
- YTD column: same triple split
- Variance coloring:
  - Revenue rows: green if Actual > Plan, red if Actual < Plan
  - Expense rows: inverse
  - Critical threshold (|Δ| > 20%): darker shade
- Drill-down: clicking an `EXPENSE` or `REVENUE` Actual cell opens a popover showing the mapped accounts and top 5 contributing documents (expense records / income entries)

### Components

- `FilterSelect` (existing) for property and year
- New: `OpReportBudgetGrid.tsx`, `OpReportView.tsx`, `OpReportCell.tsx`, `OpReportExportMenu.tsx`
- Shared aggregation on backend (`lib/finance/opreport/compute.ts`) feeds both the view and the export endpoints

## API Routes

All under `app/api/finance/opreport/`. Each route follows the standard finance API pattern: `getFinanceUser()` → permission check → `getUserPropertyIds()` scope check → Zod validation → `revalidatePath()` on mutation.

| Method | Path | Purpose |
|---|---|---|
| GET | `/template` | Returns rows + account mappings. Cached per deploy. |
| GET | `/budget?property_id&year` | Matrix of budget values: `{ [row_key]: { [month]: amount } }` |
| PUT | `/budget` | Batch upsert of budget cells (up to 500 per request) |
| GET | `/report?property_id&year&vat_mode` | Full report matrix: rows × months with `{plan, actual, variance_pct}` |
| GET | `/export/xlsx?property_id&year&view&vat_mode` | Streams `.xlsx` file |
| GET | `/export/pdf-view?property_id&year&vat_mode` | Print-friendly HTML page (user prints via browser) |

### Permissions

Three new keys added to `permissions` table via seed migration:

| Key | Label |
|---|---|
| `opreport.view` | Достъп до Операционен P&L |
| `opreport.edit_budget` | Редакция на бюджет |
| `opreport.manage_template` | Управление на шаблон (бъдещо) |

Default grants in `role_permissions`:

| Role | view | edit_budget | manage_template |
|---|---|---|---|
| ADMIN_CO | ✅ | ✅ | ✅ |
| FINANCE_CO | ✅ | ✅ | ❌ |
| MANAGER | ❌ | ❌ | ❌ |
| DEPT_HEAD | ❌ | ❌ | ❌ |

Administrators can modify grants via the existing permissions admin UI without a deploy.

### Validation (Zod)

```typescript
// lib/finance/schemas/opreport.ts
budgetCellSchema = {
  property_id: uuid,
  year: int (2020..2100),
  month: int (1..12),
  row_key: string,
  amount: number (-1e10..1e10)
}
budgetBatchSchema = array(budgetCellSchema).max(500)
reportQuerySchema = {
  property_id: uuid,
  year: int,
  vat_mode: enum('net', 'gross')
}
```

Service-layer checks:
- Reject upsert on non-`budgetable` rows
- Reject `month` not in `property.operating_months` (soft warning, not error; allows pre-filling)
- `operating_months` CHECK constraint enforced at DB level

## Aggregation

Single function `computeOperationalReport(propertyId, year, vatMode): Promise<ReportMatrix>` in `lib/finance/opreport/compute.ts`, used by both the report API and the export endpoints.

**Query strategy:**
- One SQL query aggregating `income_entries` by month and mapped row (via `opreport_row_accounts` join), using `amount_net` or `amount_gross` per `vat_mode`
- One SQL query aggregating `expenses` similarly
- One query for `property_statistics` (grouped by month)
- One query for payroll monthly totals
- DERIVED rows computed in TypeScript after data fetch (easier to iterate on formulas than DB views)
- YTD computed in-memory after monthly values materialize

No materialized views in v1 — 12 months × ~35 rows × single property is cheap.

## Export

### Excel

- Package: `xlsx` (SheetJS)
- Generated server-side in `GET /api/finance/opreport/export/xlsx` route
- Worksheet layout matches the source Excel: title row, months across columns, YTD column, Bulgarian labels in left column, section headers with background fill, totals bolded, negatives red, derived cells formatted (percent, number)
- Filename: `operational-pl-{propertySlug}-{year}-{view}.xlsx`
- Returns streamed `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### PDF

- Approach: print-friendly HTML + `@media print` CSS, opened in new tab, user triggers browser print dialog ("Save as PDF")
- Dedicated route `/finance/usali-reports/opreport/print` renders a minimal layout (no sidebar, no interactive controls) with the report matrix
- A4 landscape orientation; auto font-shrink when >7 month columns
- No server-side PDF generation (Puppeteer) in v1

## Testing

Minimal test strategy given the app has no existing test framework:

- **Manual smoke plan documented** in the PR checklist:
  - Seed template applied cleanly
  - Budget grid edits persist
  - Actual values match hand-computed totals for one seeded month
  - VAT toggle correctly flips net vs gross
  - Seasonal property (operating_months subset) shows only those columns
  - Excel export opens and matches report view
  - Print view renders correctly in Chrome and Firefox
- **Unit test target** (new folder `__tests__/opreport/`): formula evaluator (pure function, easy to test in isolation). Skip if no test runner set up yet.

## Migration Plan

Ordered steps (each is a single migration file under `supabase/migrations/`):

1. `20260420000000_opreport_schema.sql` — create `opreport_rows`, `opreport_row_accounts`, `opreport_budgets` + RLS policies
2. `20260420000001_properties_add_rent_beds.sql` — add `rooms_main`, `rooms_annex`, `total_beds`, `operating_months`, `annual_rent` to `properties`
3. `20260420000002_opreport_permissions.sql` — insert `opreport.view`, `opreport.edit_budget`, `opreport.manage_template` into `permissions` and default `role_permissions`
4. `20260420000003_opreport_seed_template.sql` — insert the 35 template rows with section, type, formulas, and any missing `usali_accounts` (Booking.com commission, Facebook ad, pellet heating)
5. `20260420000004_opreport_seed_mappings.sql` — insert `opreport_row_accounts` rows linking template rows to USALI accounts

Each migration is reversible (rollback commentary in the SQL file).

## Open Items / Future Enhancements (Not in v1)

- Budget versioning / history
- Per-property row template overrides
- Multi-year comparison views
- Variance alerts (email / in-app) when actual exceeds threshold
- Department-level breakdown of Operational P&L
- API for pulling budget data from external tools
- MANAGER role read-only access (currently gated behind `opreport.view` permission; admin can grant manually)

## Acceptance Criteria

- [ ] ADMIN_CO can open `/finance/usali-reports` → "Операционен P&L" tab
- [ ] Budget grid for Riverside Y2025 matches source Excel layout
- [ ] Editing a budget cell persists and re-renders derived rows correctly
- [ ] Actual column for Jun 2025 matches sum of seeded expenses + income for that month
- [ ] VAT toggle correctly switches between `amount_net` and `total_amount`
- [ ] Seasonal property (e.g. Riverside Apr-Oct) shows 7 month columns, not 12
- [ ] Rent row = `annual_rent / 7` for each Apr-Oct column, 0 otherwise
- [ ] Plan vs Actual view shows variance % with correct color coding
- [ ] Excel export file opens in Excel and reproduces the view structure
- [ ] Print view produces clean single-page landscape PDF via browser
- [ ] FINANCE_CO has same access as ADMIN_CO except `manage_template`
- [ ] MANAGER and DEPT_HEAD do not see the tab
