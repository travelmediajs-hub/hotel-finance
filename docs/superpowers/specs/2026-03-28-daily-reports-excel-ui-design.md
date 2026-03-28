# Daily Reports Excel-Style UI Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the multi-page daily report form/view with a single-page Excel-like spreadsheet where all dates are visible as rows, departments as grouped columns, with inline editing and a right-side drawer for extended fields.

## Context

The finance module tracks daily revenue reports per hotel property. Each report has one row per department with cash/POS income, refunds, Z-report control values, and auto-calculated differences. The current UI uses separate pages for list, form, and view — which is clunky and requires too many page navigations.

## Layout Overview

One page at `/finance/daily-reports`. No separate detail/edit/view pages.

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Property tabs]                                     [+ Нов отчет]  │
├──────┬──────────────────┬──────────────────┬───────┬─────┬────┬────┤
│ Дата │ Рецепция         │ Лоби бар         │ Каса  │ ПОС │Разл│Ст │▸│
│      │ К+  К-  П+  П-  │ К+  К-  П+  П-  │ нето  │нето │    │   │ │
├──────┼──────────────────┼──────────────────┼───────┼─────┼────┼───┼─┤
│03-28 │[__][__][__][__]  │[__][__][__][__]  │ 450.00│280  │0.00│ ▣ │✉▸│
│03-27 │ 120  0   50   0  │  80  5   40   0  │ 425.00│175  │-5  │ ✓ │ ▸│
│03-26 │ 100  0   60   0  │  90  0   35   0  │ 385.00│190  │0.00│ ✓ │ ▸│
└──────┴──────────────────┴──────────────────┴───────┴─────┴────┴───┴─┘
```

## Main Table

### Columns

Per department (grouped under department name header):
- **К+** — cash income (editable input)
- **К-** — cash refund (editable input)
- **П+** — POS income (editable input)
- **П-** — POS refund (editable input)

Summary columns (auto-calculated, read-only):
- **Каса нето** — sum of (К+ - К-) across all departments
- **ПОС нето** — sum of (П+ - П-) across all departments
- **Разл.** — total difference `(cash_diff + pos_diff)` from the database. This is a generated column that uses Z-report and POS report data. When Z/POS report values are 0, the difference equals net income (will show red). This is correct behavior — it reflects that the control data hasn't been entered yet.

Fixed columns:
- **Дата** — sticky left, links/text showing the report date
- **Ст.** — status icon (▣ DRAFT, ⏳ SUBMITTED, ✓ APPROVED, ↩ RETURNED)
- **Actions + ▸** — last column: action icons + drawer toggle

### Row Behavior

- **DRAFT / RETURNED rows:** Input fields are editable. Cells are `<input type="number">` styled to look like Excel cells — minimal border, aligned right, tabular-nums font. The cell border and the input border are one and the same (no double borders, no padding gaps).
- **SUBMITTED / APPROVED rows:** Values displayed as plain text, same alignment and font. No inputs.
- **DEPT_HEAD users:** Can only edit inputs for departments they have access to. Other department cells in editable rows are disabled.

### Cell Styling (Excel-like)

- No rounded corners on cells
- Thin 1px borders (`border-zinc-800`) between all cells
- Input fields fill their cell completely — no padding gap between input border and cell border
- Right-aligned numbers, `tabular-nums font-mono`
- Header cells: `bg-zinc-900/50`, slightly bolder
- Alternating row backgrounds not needed (borders are sufficient)
- Compact row height (~32px)
- Department group headers span their 4 sub-columns with `colSpan={4}`

### Sticky Behavior

- Date column: `sticky left-0` with solid background to prevent overlap artifacts

### Horizontal Scroll

The table container has `overflow-x-auto`. With sidebar at 256px, the table gets `calc(100vw - 256px - padding)`. For 3+ departments (12+ data columns + summary columns), horizontal scroll kicks in naturally.

### Auto-Save on Blur

When a user changes a value and leaves the cell (blur event), the component fires a PATCH request to `/api/finance/daily-reports/{id}/lines` for that department line. No "save all" button for the main table.

- Debounce: none needed (blur fires once)
- Optimistic UI: update local state immediately, revert on error
- Error feedback: brief toast or inline red highlight on the cell

## Drawer (Right-Side Sheet)

Opens when clicking the `▸` button on any row. Uses shadcn `Sheet` component with `side="right"`.

### Width

400px fixed.

### Content (for the selected report)

**Header:**
- Date + property name + status Badge

**Section: Z-отчет** (only departments with fiscal devices)

Per department row:
- Department name label
- Zк — Z-report cash (number input)
- Zп — Z-report POS (number input)
- Z-файл — URL input for Z-report file

**Section: ПОС банков отчет**

Per department row:
- Department name label
- ПОС отч. — POS bank report amount (number input)

**Section: Разлики** (read-only, auto-calculated)

| | Каса | ПОС | Общо |
|---|---|---|---|
| Per dept... | diff | diff | diff |
| **Общо** | total | total | total |

Color-coded: green if 0, red if != 0.

**Section: Допълнителни полета**
- Обяснение за разликата (textarea, required if total diff != 0)
- Общ прикачен файл (URL input, optional)
- Коментар от ЦО (read-only, shown if RETURNED and co_comment exists)

**Footer:**
- "Запази" button — saves all Z-report, POS report, explanation, and attachment fields via PATCH calls

### Editability

- DRAFT / RETURNED: all fields editable (respecting DEPT_HEAD department restrictions)
- SUBMITTED / APPROVED: all fields read-only

### State Sync

When drawer saves, the main table recalculates the "Разл." column for that row (since Z-report and POS report data affects the difference calculation).

## Action Icons

Last column of each row, before the `▸` drawer toggle:

| Status | User Role | Icons Shown |
|--------|-----------|-------------|
| DRAFT | MANAGER / ADMIN_CO | ✉️ (submit to CO) |
| DRAFT | DEPT_HEAD | — (no actions) |
| SUBMITTED | ADMIN_CO / FINANCE_CO | ✅ (approve) ↩️ (return) |
| SUBMITTED | MANAGER / DEPT_HEAD | — (no actions) |
| APPROVED | any | — (no actions) |
| RETURNED | MANAGER / ADMIN_CO | ✉️ (re-submit) |

Icon clicks trigger confirmation dialog, then call the respective API endpoint (POST submit/approve/return).

Return action shows a small dialog/popover for the mandatory comment.

## "Нов отчет" Button

Creates a new DRAFT report for the selected property + today's date via POST to `/api/finance/daily-reports`. On success, the table refreshes and the new row appears at the top (editable). If a report already exists for today, shows an error toast.

## Files to Create/Modify/Delete

**Create:**
- `components/finance/DailyReportDrawer.tsx` — Sheet component for Z-report, POS report, diffs, files

**Rewrite:**
- `components/finance/DailyReportTable.tsx` — Full rewrite as Excel-like editable spreadsheet
- `app/(finance)/finance/daily-reports/page.tsx` — Simplified: property tabs + DailyReportTable + "Нов отчет" as client action

**Delete:**
- `components/finance/DailyReportForm.tsx`
- `components/finance/DailyReportView.tsx`
- `components/finance/DailyReportActions.tsx`
- `app/(finance)/finance/daily-reports/[id]/page.tsx`
- `app/(finance)/finance/daily-reports/new/page.tsx`

**No changes:**
- All API routes remain unchanged
- Database schema remains unchanged
- `types/finance.ts` remains unchanged

## Data Flow

1. `page.tsx` (server component) fetches reports with lines + departments for selected property
2. Passes data to `DailyReportTable` (client component)
3. Table manages local state for all rows, renders inputs for editable rows
4. Cell blur → PATCH `/api/finance/daily-reports/{id}/lines` with department_id + changed field
5. Drawer open → shows extended fields for selected row from local state
6. Drawer save → PATCH lines for Z/POS fields + PATCH report for explanation/attachment → update local state
7. Action icon click → confirm → POST submit/approve/return → update row status in local state + refresh

## User Role Permissions Summary

| Action | ADMIN_CO | FINANCE_CO | MANAGER | DEPT_HEAD |
|--------|----------|------------|---------|-----------|
| View all reports | ✓ | ✓ | ✓ (own properties) | ✓ (own properties) |
| Edit cells (DRAFT/RETURNED) | all depts | — | all depts | own depts only |
| Create new report | ✓ | — | ✓ | ✓ |
| Submit to CO | ✓ | — | ✓ | — |
| Approve | ✓ | ✓ | — | — |
| Return with comment | ✓ | ✓ | — | — |
