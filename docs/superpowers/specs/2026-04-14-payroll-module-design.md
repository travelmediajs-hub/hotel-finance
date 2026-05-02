# Payroll Module Design

## Overview

Payroll module for hotel finance system. Two parts: employee registry with salary info, and monthly schedule grid for tracking working days, hours, and overtime. Auto-calculates monthly salary based on actual attendance.

## Database

### Table: `employees`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| property_id | uuid FK → properties | required |
| department_id | uuid FK → departments | required, for USALI distribution |
| full_name | text | required |
| contract_salary | numeric(12,2) | official salary per contract |
| actual_salary | numeric(12,2) | real salary (with bonuses etc.) |
| contract_hours_per_day | smallint | default 8 |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: scoped to authenticated users. MANAGER sees only their property.

### Table: `employee_schedule`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| employee_id | uuid FK → employees | required, cascade delete |
| date | date | required |
| status | text | WORK, REST, LEAVE, SICK |
| hours | numeric(4,1) | normal hours worked (nullable, relevant when WORK) |
| overtime_hours | numeric(4,1) | overtime hours (nullable) |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Unique constraint: `(employee_id, date)`

### Status values

- **WORK** (Р) — working day, hours required
- **REST** (П) — rest day
- **LEAVE** (О) — paid leave / vacation
- **SICK** (Б) — sick leave

## Calculations (monthly)

All calculated client-side from schedule data, no stored aggregates.

- **Worked days** = count of WORK entries in month
- **Total normal hours** = sum of `hours` for WORK entries
- **Total overtime hours** = sum of `overtime_hours`
- **Expected working days** = business days in month (Mon-Fri, excluding Bulgarian holidays is out of scope for now — use standard 22 working days or derive from schedule plan)
- **Monthly salary** = `actual_salary * (worked_days / expected_working_days)`
  - If worked fewer days than expected, salary is proportionally reduced
  - If worked more, salary is proportionally increased
- **Overtime pay** = `(actual_salary / expected_working_days / contract_hours_per_day) * overtime_hours * 1.5`
- **Total** = monthly salary + overtime pay

## UI

### Part 1: Employee List (top section)

Table columns: Ime, Otdel, Zaplatа, Po dogovor, Dogovoreni ch/den, Status (active badge)

Actions:
- Add employee (dialog: name, property, department, contract salary, actual salary, hours/day)
- Edit employee (inline or dialog)
- Deactivate employee

Filter: property selector (ADMIN_CO sees all, MANAGER sees own property only).

### Part 2: Monthly Schedule Grid (bottom section)

Controls: month/year picker, property filter.

Grid layout:
- Rows = employees (from selected property)
- Columns = days of month (1-31, depending on month)
- Each cell shows status letter (Р/П/О/Б) colored by type
- Click cell → popover/dialog to set: status, hours (if WORK), overtime hours

Right-side summary columns per employee:
- Total worked days
- Total normal hours
- Total overtime hours
- Calculated salary for month
- Overtime pay
- Total pay

Can fill in days in advance (e.g., plan schedule for next month).

### Schedule cell colors

- WORK: default/green tint
- REST: muted/gray
- LEAVE: blue tint
- SICK: amber/yellow tint

## Access Control

- **ADMIN_CO**: full access, all properties
- **MANAGER**: view and edit employees + schedule for own property only
- **FINANCE_CO, DEPT_HEAD**: no access

Sidebar entry: "Zapalti" with Banknote icon, roles: ['ADMIN_CO', 'MANAGER']

## API Routes

- `GET/POST /api/finance/payroll/employees` — list/create employees
- `PATCH /api/finance/payroll/employees/[id]` — update employee
- `GET /api/finance/payroll/schedule?property_id=X&month=YYYY-MM` — get schedule for month
- `PUT /api/finance/payroll/schedule` — bulk upsert schedule entries (array of {employee_id, date, status, hours, overtime_hours})

## File Structure

```
app/(finance)/finance/payroll/page.tsx          — server component, auth + data fetch
components/finance/PayrollView.tsx              — client component, tabs/layout
components/finance/EmployeeList.tsx             — employee table + CRUD
components/finance/ScheduleGrid.tsx             — monthly grid
supabase/migrations/XXXXXXXXXX_payroll.sql      — tables + RLS
app/api/finance/payroll/employees/route.ts      — employees CRUD
app/api/finance/payroll/employees/[id]/route.ts — employee update
app/api/finance/payroll/schedule/route.ts       — schedule GET + bulk PUT
```
