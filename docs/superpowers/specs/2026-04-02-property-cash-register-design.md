# Property Cash Register (Каса на обект) — Design Spec

## Overview

Each property gets a cash register that tracks its real-time cash position. The register is created automatically when a property is created. Balance is computed dynamically from all cash-affecting operations.

## Database

### Table: `property_cash_registers`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, default gen_random_uuid() | |
| property_id | uuid | FK → properties(id), UNIQUE, NOT NULL | One register per property |
| name | text | NOT NULL | Default: "Каса {property name}" |
| opening_balance | numeric(12,2) | NOT NULL, default 0 | Initial cash amount |
| opening_balance_date | date | NOT NULL, default now() | Balance start date |
| created_at | timestamptz | NOT NULL, default now() | |

RLS: Same pattern as other finance tables — select for all finance roles, update for ADMIN_CO and FINANCE_CO only.

### View: `property_cash_balances`

Computes current balance per register:

```
balance = opening_balance
  + SUM(daily_report_lines.cash_net)          -- daily cash revenue (APPROVED reports only)
  - SUM(withdrawals.amount)                    -- cash withdrawals (APPROVED or ACCOUNTED)
  - SUM(cash_collections.amount)               -- collections sent to CO (SENT, RECEIVED, or ACCOUNTED)
  + SUM(money_received.amount)                 -- funds received from CO (RECEIVED or ACCOUNTED)
  + SUM(in_transits destination=PROPERTY_CASH)  -- incoming transfers
  - SUM(in_transits source=PROPERTY_CASH)       -- outgoing transfers
```

All sums filtered to dates >= opening_balance_date.

## Auto-creation

When `POST /api/finance/properties` creates a new property, it also inserts a row in `property_cash_registers` with:
- `name`: "Каса {property.name}"
- `opening_balance`: 0
- `opening_balance_date`: current date

## API

### `GET /api/finance/cash-register`

Query params: `property_id` (optional for ADMIN_CO/FINANCE_CO, required for MANAGER)

Returns: register info + current balance + list of movements.

Movements are a union query across all source tables, sorted by date desc:
- daily_report_lines (cash_net) → type: "daily_report"
- withdrawals → type: "withdrawal"
- cash_collections → type: "cash_collection"
- money_received → type: "money_received"
- in_transits (source or destination = PROPERTY_CASH) → type: "transfer"

Each movement: `{ date, type, description, income, expense, running_balance }`

Optional date range filter: `from`, `to`.

### `PATCH /api/finance/cash-register/[id]`

Update opening_balance and opening_balance_date. Restricted to ADMIN_CO and FINANCE_CO.

## UI

### Navigation

New sidebar item "Каса" with Wallet icon. Visible to: ADMIN_CO, FINANCE_CO, MANAGER.
Route: `/finance/cash-register`

### Page layout

**Header area:**
- Property selector (dropdown) — ADMIN_CO/FINANCE_CO see all properties, MANAGER sees only their property
- Current balance displayed prominently
- Edit button for opening balance (ADMIN_CO/FINANCE_CO only)

**Filter:**
- Date range picker (from/to)

**Movements table:**
| Дата | Тип | Описание | Приход | Разход | Салдо |
|------|-----|----------|--------|--------|-------|

Type badges with colors:
- Дневен отчет (green)
- Теглене (red)
- Инкасация (orange)
- Получени средства (blue)
- Трансфер (purple)

### Access control

- MANAGER: sees only their property's cash register, no property selector
- ADMIN_CO / FINANCE_CO: see all properties via dropdown, can edit opening balance
