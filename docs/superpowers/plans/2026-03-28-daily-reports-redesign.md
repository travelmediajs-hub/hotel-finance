# Daily Reports Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the daily reports system from per-department to per-property model with a tabular overview and hybrid fill workflow (DEPT_HEAD fills own department, MANAGER fills/edits all).

**Architecture:** One daily report per property+date. Each report has `daily_report_lines` — one row per department containing cash income/refund, POS income/refund, Z-report amounts, POS bank report, and Z-report attachment URL. Old `pos_entries` and `z_reports` tables are dropped. Tabular page shows dates as rows, departments as grouped columns. Detail form shows all departments as sections. Workflow simplified to DRAFT→SUBMITTED→APPROVED/RETURNED.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Zod validation, shadcn/ui components, TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260328000004_redesign_daily_reports.sql` | Create | DB migration: restructure tables, drop old ones |
| `types/finance.ts` | Modify | Update `DailyReport`, `DailyReportLine`, `DailyReportStatus` types; remove `POSEntry`, `ZReport` |
| `lib/finance/schemas/daily-report.ts` | Modify | New Zod schemas for redesigned report |
| `app/api/finance/daily-reports/route.ts` | Modify | GET returns per-property data with lines join; POST creates per-property report |
| `app/api/finance/daily-reports/[id]/route.ts` | Modify | GET returns report with new line structure |
| `app/api/finance/daily-reports/[id]/lines/route.ts` | Create | PATCH to update individual department lines |
| `app/api/finance/daily-reports/[id]/submit/route.ts` | Modify | Validate Z-attachments per department line |
| `app/api/finance/daily-reports/[id]/approve/route.ts` | Modify | Accept from SUBMITTED (not SENT_TO_CO) |
| `app/api/finance/daily-reports/[id]/return/route.ts` | Modify | CO returns SUBMITTED reports |
| `app/api/finance/daily-reports/[id]/confirm/route.ts` | Delete | No longer needed |
| `components/finance/DailyReportTable.tsx` | Create | Tabular overview: rows=dates, cols=departments |
| `components/finance/DailyReportForm.tsx` | Rewrite | Per-property form with department sections |
| `components/finance/DailyReportView.tsx` | Rewrite | Read-only view matching new data structure |
| `components/finance/DailyReportActions.tsx` | Modify | Simplified workflow (no confirm step) |
| `components/finance/DailyReportList.tsx` | Delete | Replaced by DailyReportTable |
| `app/(finance)/finance/daily-reports/page.tsx` | Rewrite | Property selector + tabular view |
| `app/(finance)/finance/daily-reports/new/page.tsx` | Rewrite | Create report for property+date |
| `app/(finance)/finance/daily-reports/[id]/page.tsx` | Modify | Use new components |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260328000004_redesign_daily_reports.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =============================================================
-- Redesign daily reports: per-property instead of per-department
-- =============================================================

-- 1. Drop old child tables (no production data yet)
DROP TABLE IF EXISTS pos_entries CASCADE;
DROP TABLE IF EXISTS z_reports CASCADE;

-- 2. Restructure daily_report_lines
--    Drop old table and recreate with new schema
DROP TABLE IF EXISTS daily_report_lines CASCADE;

CREATE TABLE daily_report_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id),

  -- Cash
  cash_income DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (cash_income >= 0),
  cash_refund DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (cash_refund >= 0),
  cash_net DECIMAL(12,2) GENERATED ALWAYS AS (cash_income - cash_refund) STORED,

  -- POS
  pos_income DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (pos_income >= 0),
  pos_refund DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (pos_refund >= 0),
  pos_net DECIMAL(12,2) GENERATED ALWAYS AS (pos_income - pos_refund) STORED,

  -- Z-report (fiscal device control report)
  z_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  z_pos DECIMAL(12,2) NOT NULL DEFAULT 0,
  z_attachment_url TEXT,

  -- POS bank report
  pos_report_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Differences (auto-calculated)
  cash_diff DECIMAL(12,2) GENERATED ALWAYS AS (cash_income - cash_refund - z_cash) STORED,
  pos_diff DECIMAL(12,2) GENERATED ALWAYS AS (pos_income - pos_refund - pos_report_amount) STORED,
  total_diff DECIMAL(12,2) GENERATED ALWAYS AS (
    (cash_income - cash_refund - z_cash) + (pos_income - pos_refund - pos_report_amount)
  ) STORED,

  -- Who filled this line
  filled_by_id UUID REFERENCES user_profiles(id),

  UNIQUE (daily_report_id, department_id)
);

-- 3. Alter daily_reports
--    Remove department_id, confirmed fields; add general_attachment_url
--    Simplify status check
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_department_id_date_key;
ALTER TABLE daily_reports DROP COLUMN IF EXISTS department_id;
ALTER TABLE daily_reports DROP COLUMN IF EXISTS confirmed_by_id;
ALTER TABLE daily_reports DROP COLUMN IF EXISTS confirmed_at;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS general_attachment_url TEXT;

-- New unique constraint: one report per property per date
ALTER TABLE daily_reports ADD CONSTRAINT daily_reports_property_date_key UNIQUE (property_id, date);

-- Simplify status values
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_status_check;
ALTER TABLE daily_reports ADD CONSTRAINT daily_reports_status_check
  CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED'));

-- 4. RLS for daily_report_lines
ALTER TABLE daily_report_lines ENABLE ROW LEVEL SECURITY;

-- All finance users can read lines for reports they can see
CREATE POLICY "daily_report_lines_select" ON daily_report_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = daily_report_lines.daily_report_id
    )
  );

-- Insert/update: finance users can modify lines
CREATE POLICY "daily_report_lines_insert" ON daily_report_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = daily_report_lines.daily_report_id
        AND dr.status = 'DRAFT'
    )
  );

CREATE POLICY "daily_report_lines_update" ON daily_report_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.id = daily_report_lines.daily_report_id
        AND dr.status IN ('DRAFT', 'RETURNED')
    )
  );

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_daily_report_lines_report ON daily_report_lines(daily_report_id);
```

- [ ] **Step 2: Verify migration syntax**

Run: `cd /mnt/c/Users/gorch/Documents/assistant && npx supabase db lint`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260328000004_redesign_daily_reports.sql
git commit -m "feat: add migration to redesign daily reports per-property"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `types/finance.ts`

- [ ] **Step 1: Update DailyReportStatus enum**

In `types/finance.ts`, replace the `DailyReportStatus` type:

```typescript
export type DailyReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED'
```

- [ ] **Step 2: Update DailyReport interface**

Replace the `DailyReport` interface:

```typescript
export interface DailyReport {
  id: string
  property_id: string
  date: string
  created_by_id: string
  status: DailyReportStatus
  submitted_at: string | null
  approved_by_id: string | null
  approved_at: string | null
  co_comment: string | null
  manager_comment: string | null
  total_cash_net: number
  total_pos_net: number
  cash_diff: number
  pos_diff: number
  total_diff: number
  diff_explanation: string | null
  general_attachment_url: string | null
  consolidation_id: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Replace DailyReportLine interface**

Replace the `DailyReportLine` interface:

```typescript
export interface DailyReportLine {
  id: string
  daily_report_id: string
  department_id: string
  cash_income: number
  cash_refund: number
  cash_net: number // generated
  pos_income: number
  pos_refund: number
  pos_net: number // generated
  z_cash: number
  z_pos: number
  z_attachment_url: string | null
  pos_report_amount: number
  cash_diff: number // generated
  pos_diff: number // generated
  total_diff: number // generated
  filled_by_id: string | null
}
```

- [ ] **Step 4: Remove POSEntry and ZReport interfaces**

Delete the `POSEntry` interface (lines 198-205) and the `ZReport` interface (lines 207-216) from `types/finance.ts`.

- [ ] **Step 5: Commit**

```bash
git add types/finance.ts
git commit -m "feat: update TypeScript types for daily reports redesign"
```

---

### Task 3: Update Zod Schemas

**Files:**
- Modify: `lib/finance/schemas/daily-report.ts`

- [ ] **Step 1: Rewrite the schema file**

Replace the entire content of `lib/finance/schemas/daily-report.ts`:

```typescript
import { z } from 'zod'

const nonNegativeDecimal = z.number().min(0)

// ============================================================
// DAILY REPORT LINE (one per department)
// ============================================================
export const dailyReportLineSchema = z.object({
  department_id: z.string().uuid(),
  cash_income: nonNegativeDecimal,
  cash_refund: nonNegativeDecimal,
  pos_income: nonNegativeDecimal,
  pos_refund: nonNegativeDecimal,
  z_cash: nonNegativeDecimal,
  z_pos: nonNegativeDecimal,
  z_attachment_url: z.string().url().nullable().optional(),
  pos_report_amount: nonNegativeDecimal,
})

// ============================================================
// CREATE DAILY REPORT (property + date)
// ============================================================
export const createDailyReportSchema = z.object({
  property_id: z.string().uuid(),
  date: z.string().date(),
})

// ============================================================
// UPDATE A SINGLE LINE (PATCH)
// ============================================================
export const updateLineSchema = z.object({
  department_id: z.string().uuid(),
  cash_income: nonNegativeDecimal.optional(),
  cash_refund: nonNegativeDecimal.optional(),
  pos_income: nonNegativeDecimal.optional(),
  pos_refund: nonNegativeDecimal.optional(),
  z_cash: nonNegativeDecimal.optional(),
  z_pos: nonNegativeDecimal.optional(),
  z_attachment_url: z.string().url().nullable().optional(),
  pos_report_amount: nonNegativeDecimal.optional(),
})

// ============================================================
// SUBMIT REPORT (with optional general attachment + diff explanation)
// ============================================================
export const submitDailyReportSchema = z.object({
  general_attachment_url: z.string().url().nullable().optional(),
  diff_explanation: z.string().nullable().optional(),
})

// ============================================================
// CO ACTIONS
// ============================================================
export const approveDailyReportSchema = z.object({
  co_comment: z.string().nullable().optional(),
})

export const returnDailyReportSchema = z.object({
  comment: z.string().min(1, 'Коментарът е задължителен при връщане'),
})
```

- [ ] **Step 2: Update schema index exports**

In `lib/finance/schemas/index.ts`, update the daily-report exports. If the old file exports `saveDailyReportSchema`, `confirmDailyReportSchema`, `returnFromCOSchema`, etc., replace them with the new names: `createDailyReportSchema`, `updateLineSchema`, `submitDailyReportSchema`, `approveDailyReportSchema`, `returnDailyReportSchema`.

- [ ] **Step 3: Commit**

```bash
git add lib/finance/schemas/daily-report.ts lib/finance/schemas/index.ts
git commit -m "feat: rewrite Zod schemas for daily reports redesign"
```

---

### Task 4: API — Create & List Reports

**Files:**
- Modify: `app/api/finance/daily-reports/route.ts`

- [ ] **Step 1: Rewrite the route file**

Replace the entire content of `app/api/finance/daily-reports/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { createDailyReportSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { searchParams } = request.nextUrl

  const propertyId = searchParams.get('property_id')
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')

  if (!propertyId) {
    return NextResponse.json({ error: 'property_id is required' }, { status: 400 })
  }

  // Check property access
  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(propertyId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let query = supabase
    .from('daily_reports')
    .select('*, daily_report_lines(*, departments(id, name))')
    .eq('property_id', propertyId)
    .order('date', { ascending: false })
    .limit(60)

  if (fromDate) query = query.gte('date', fromDate)
  if (toDate) query = query.lte('date', toDate)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Only MANAGER and ADMIN_CO can create reports
  if (user.role !== 'MANAGER' && user.role !== 'ADMIN_CO' && user.role !== 'DEPT_HEAD') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createDailyReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { property_id, date } = parsed.data
  const supabase = await createClient()

  // Check property access
  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(property_id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Check for duplicate (property + date)
  const { data: existing } = await supabase
    .from('daily_reports')
    .select('id')
    .eq('property_id', property_id)
    .eq('date', date)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'duplicate', message: 'Вече съществува отчет за този обект и дата' },
      { status: 409 }
    )
  }

  // Create the report
  const { data: report, error: reportError } = await supabase
    .from('daily_reports')
    .insert({
      property_id,
      date,
      created_by_id: user.id,
      status: 'DRAFT',
      total_cash_net: 0,
      total_pos_net: 0,
      cash_diff: 0,
      pos_diff: 0,
      total_diff: 0,
    })
    .select()
    .single()

  if (reportError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  // Create empty lines for all active departments in this property
  const { data: departments } = await supabase
    .from('departments')
    .select('id')
    .eq('property_id', property_id)
    .eq('status', 'ACTIVE')

  if (departments && departments.length > 0) {
    const { error: linesError } = await supabase
      .from('daily_report_lines')
      .insert(
        departments.map((d) => ({
          daily_report_id: report.id,
          department_id: d.id,
        }))
      )

    if (linesError) {
      await supabase.from('daily_reports').delete().eq('id', report.id)
      return NextResponse.json({ error: 'database_error' }, { status: 500 })
    }
  }

  return NextResponse.json(report, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/finance/daily-reports/route.ts
git commit -m "feat: rewrite daily reports list/create API for per-property model"
```

---

### Task 5: API — Get Single Report & Update Lines

**Files:**
- Modify: `app/api/finance/daily-reports/[id]/route.ts`
- Create: `app/api/finance/daily-reports/[id]/lines/route.ts`

- [ ] **Step 1: Rewrite the single report GET**

Replace `app/api/finance/daily-reports/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data: report, error } = await supabase
    .from('daily_reports')
    .select('*, properties(id, name), daily_report_lines(*, departments(id, name))')
    .eq('id', id)
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(report)
}
```

- [ ] **Step 2: Create the lines PATCH endpoint**

Create `app/api/finance/daily-reports/[id]/lines/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { updateLineSchema } from '@/lib/finance/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = updateLineSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Fetch the report to check status and ownership
  const { data: report } = await supabase
    .from('daily_reports')
    .select('id, property_id, status')
    .eq('id', id)
    .single()

  if (!report) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (report.status !== 'DRAFT' && report.status !== 'RETURNED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Отчетът не може да се редактира в този статус' },
      { status: 400 }
    )
  }

  // DEPT_HEAD can only update their own departments
  if (user.role === 'DEPT_HEAD') {
    const { data: access } = await supabase
      .from('user_department_access')
      .select('department_id')
      .eq('user_id', user.id)

    const allowedDepts = (access ?? []).map((a) => a.department_id)
    if (!allowedDepts.includes(parsed.data.department_id)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const { department_id, ...updateFields } = parsed.data

  const { data: line, error } = await supabase
    .from('daily_report_lines')
    .update({ ...updateFields, filled_by_id: user.id })
    .eq('daily_report_id', id)
    .eq('department_id', department_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  // Recalculate report totals from all lines
  const { data: allLines } = await supabase
    .from('daily_report_lines')
    .select('cash_net, pos_net, cash_diff, pos_diff, total_diff')
    .eq('daily_report_id', id)

  if (allLines) {
    const totalCashNet = allLines.reduce((s, l) => s + Number(l.cash_net), 0)
    const totalPosNet = allLines.reduce((s, l) => s + Number(l.pos_net), 0)
    const cashDiff = allLines.reduce((s, l) => s + Number(l.cash_diff), 0)
    const posDiff = allLines.reduce((s, l) => s + Number(l.pos_diff), 0)
    const totalDiff = allLines.reduce((s, l) => s + Number(l.total_diff), 0)

    await supabase
      .from('daily_reports')
      .update({
        total_cash_net: totalCashNet,
        total_pos_net: totalPosNet,
        cash_diff: cashDiff,
        pos_diff: posDiff,
        total_diff: totalDiff,
      })
      .eq('id', id)
  }

  return NextResponse.json(line)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/finance/daily-reports/[id]/route.ts app/api/finance/daily-reports/[id]/lines/route.ts
git commit -m "feat: add single report GET and lines PATCH endpoints"
```

---

### Task 6: API — Submit, Approve, Return (Simplified Workflow)

**Files:**
- Modify: `app/api/finance/daily-reports/[id]/submit/route.ts`
- Modify: `app/api/finance/daily-reports/[id]/approve/route.ts`
- Modify: `app/api/finance/daily-reports/[id]/return/route.ts`
- Delete: `app/api/finance/daily-reports/[id]/confirm/route.ts`

- [ ] **Step 1: Rewrite submit endpoint**

Replace `app/api/finance/daily-reports/[id]/submit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Only MANAGER and ADMIN_CO can submit
  if (user.role !== 'MANAGER' && user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select('*, daily_report_lines(*)')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (report.status !== 'DRAFT' && report.status !== 'RETURNED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Отчетът трябва да е в статус ЧЕРНОВА или ВЪРНАТ' },
      { status: 400 }
    )
  }

  const lines: any[] = report.daily_report_lines ?? []

  // Validate: all departments with fiscal devices must have z_attachment_url
  // For now, check that at least some data has been entered
  const hasData = lines.some(
    (l: any) => Number(l.cash_income) > 0 || Number(l.pos_income) > 0
  )
  if (!hasData) {
    return NextResponse.json(
      { error: 'validation_error', message: 'Поне един отдел трябва да има въведени данни' },
      { status: 400 }
    )
  }

  // Check Z-report attachments for departments that have fiscal devices
  const { data: departments } = await supabase
    .from('departments')
    .select('id, fiscal_device_id')
    .eq('property_id', report.property_id)
    .eq('status', 'ACTIVE')

  const deptsWithFiscal = new Set(
    (departments ?? []).filter((d) => d.fiscal_device_id).map((d) => d.id)
  )

  for (const line of lines) {
    const hasFiscal = deptsWithFiscal.has(line.department_id)
    const hasActivity = Number(line.cash_income) > 0 || Number(line.pos_income) > 0
    if (hasFiscal && hasActivity && !line.z_attachment_url) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Z-отчет файл е задължителен за отдели с фискално устройство',
        },
        { status: 400 }
      )
    }
  }

  // diff_explanation required if total_diff != 0
  if (Number(report.total_diff) !== 0 && !report.diff_explanation) {
    // Try to get it from request body
    let diffExplanation: string | null = null
    try {
      const body = await request.json()
      diffExplanation = body.diff_explanation ?? null
    } catch {
      // no body
    }

    if (!diffExplanation) {
      return NextResponse.json(
        { error: 'validation_error', message: 'Обяснение за разликата е задължително' },
        { status: 400 }
      )
    }

    // Save the explanation
    await supabase
      .from('daily_reports')
      .update({ diff_explanation: diffExplanation })
      .eq('id', id)
  }

  // Parse optional general_attachment_url from body
  let generalAttachment: string | null = null
  try {
    const body = await request.json()
    generalAttachment = body.general_attachment_url ?? null
  } catch {
    // no body or already parsed
  }

  const updateData: Record<string, unknown> = {
    status: 'SUBMITTED',
    submitted_at: new Date().toISOString(),
  }
  if (generalAttachment) {
    updateData.general_attachment_url = generalAttachment
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Rewrite approve endpoint**

Replace `app/api/finance/daily-reports/[id]/approve/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (report.status !== 'SUBMITTED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Отчетът трябва да е в статус ИЗПРАТЕН' },
      { status: 400 }
    )
  }

  let coComment: string | undefined
  try {
    const body = await request.json()
    coComment = body.co_comment
  } catch {
    // optional
  }

  const updateData: Record<string, unknown> = {
    status: 'APPROVED',
    approved_by_id: user.id,
    approved_at: new Date().toISOString(),
  }
  if (coComment) updateData.co_comment = coComment

  const { data, error } = await supabase
    .from('daily_reports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  return NextResponse.json(data)
}
```

- [ ] **Step 3: Rewrite return endpoint**

Replace `app/api/finance/daily-reports/[id]/return/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { comment?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'validation_error', message: 'Тялото на заявката е задължително' },
      { status: 400 }
    )
  }

  if (!body.comment || body.comment.trim() === '') {
    return NextResponse.json(
      { error: 'validation_error', message: 'Коментарът е задължителен при връщане' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (report.status !== 'SUBMITTED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Отчетът трябва да е в статус ИЗПРАТЕН' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .update({
      status: 'RETURNED',
      co_comment: body.comment.trim(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })

  return NextResponse.json(data)
}
```

- [ ] **Step 4: Delete confirm endpoint**

Delete the file `app/api/finance/daily-reports/[id]/confirm/route.ts`.

- [ ] **Step 5: Commit**

```bash
git add app/api/finance/daily-reports/[id]/submit/route.ts app/api/finance/daily-reports/[id]/approve/route.ts app/api/finance/daily-reports/[id]/return/route.ts
git rm app/api/finance/daily-reports/[id]/confirm/route.ts
git commit -m "feat: simplify daily report workflow (DRAFT→SUBMITTED→APPROVED/RETURNED)"
```

---

### Task 7: DailyReportTable Component (Tabular Overview)

**Files:**
- Create: `components/finance/DailyReportTable.tsx`
- Delete: `components/finance/DailyReportList.tsx`

- [ ] **Step 1: Create the tabular component**

Create `components/finance/DailyReportTable.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { DailyReportStatus } from '@/types/finance'

interface DepartmentInfo {
  id: string
  name: string
}

interface ReportLine {
  department_id: string
  cash_income: number
  cash_refund: number
  cash_net: number
  pos_income: number
  pos_refund: number
  pos_net: number
  total_diff: number
  departments: { id: string; name: string }
}

export interface ReportWithLines {
  id: string
  date: string
  status: DailyReportStatus
  total_cash_net: number
  total_pos_net: number
  total_diff: number
  daily_report_lines: ReportLine[]
}

const statusLabels: Record<DailyReportStatus, string> = {
  DRAFT: '▣',
  SUBMITTED: '⏳',
  APPROVED: '✓',
  RETURNED: '↩',
}

const statusColors: Record<DailyReportStatus, string> = {
  DRAFT: 'text-zinc-400',
  SUBMITTED: 'text-yellow-500',
  APPROVED: 'text-green-500',
  RETURNED: 'text-red-500',
}

interface Props {
  reports: ReportWithLines[]
  departments: DepartmentInfo[]
}

function fmt(n: number): string {
  return n === 0 ? '—' : n.toFixed(2)
}

export function DailyReportTable({ reports, departments }: Props) {
  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма дневни отчети за този обект
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2} className="align-bottom border-r">Дата</TableHead>
            {departments.map((dept) => (
              <TableHead
                key={dept.id}
                colSpan={4}
                className="text-center border-r border-b"
              >
                {dept.name}
              </TableHead>
            ))}
            <TableHead rowSpan={2} className="text-right align-bottom border-r">Общо</TableHead>
            <TableHead rowSpan={2} className="text-right align-bottom border-r">Разлика</TableHead>
            <TableHead rowSpan={2} className="text-center align-bottom">Ст.</TableHead>
          </TableRow>
          <TableRow>
            {departments.map((dept) => (
              <TableHead key={dept.id} className="contents">
                <TableHead className="text-right text-xs px-2">Каса</TableHead>
                <TableHead className="text-right text-xs px-2">К.Ст</TableHead>
                <TableHead className="text-right text-xs px-2">ПОС</TableHead>
                <TableHead className="text-right text-xs px-2 border-r">П.Ст</TableHead>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => {
            const linesByDept = new Map(
              report.daily_report_lines.map((l) => [l.department_id, l])
            )
            const grandTotal = report.total_cash_net + report.total_pos_net

            return (
              <TableRow key={report.id}>
                <TableCell className="border-r whitespace-nowrap">
                  <Link
                    href={`/finance/daily-reports/${report.id}`}
                    className="text-foreground hover:underline font-medium"
                  >
                    {report.date}
                  </Link>
                </TableCell>
                {departments.map((dept) => {
                  const line = linesByDept.get(dept.id)
                  return (
                    <TableCell key={dept.id} className="contents">
                      <TableCell className="text-right text-sm tabular-nums px-2">
                        {fmt(line?.cash_income ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums px-2">
                        {fmt(line?.cash_refund ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums px-2">
                        {fmt(line?.pos_income ?? 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums px-2 border-r">
                        {fmt(line?.pos_refund ?? 0)}
                      </TableCell>
                    </TableCell>
                  )
                })}
                <TableCell className="text-right font-medium tabular-nums border-r">
                  {fmt(grandTotal)}
                </TableCell>
                <TableCell className={`text-right tabular-nums border-r ${report.total_diff !== 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {fmt(report.total_diff)}
                </TableCell>
                <TableCell className={`text-center ${statusColors[report.status]}`}>
                  <span title={report.status}>{statusLabels[report.status]}</span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: Delete DailyReportList.tsx**

Delete `components/finance/DailyReportList.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/finance/DailyReportTable.tsx
git rm components/finance/DailyReportList.tsx
git commit -m "feat: add DailyReportTable tabular component, remove old list"
```

---

### Task 8: DailyReportForm Component (Per-Property)

**Files:**
- Modify: `components/finance/DailyReportForm.tsx`

- [ ] **Step 1: Rewrite the form component**

Replace the entire content of `components/finance/DailyReportForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface DepartmentInfo {
  id: string
  name: string
  fiscal_device_id: string | null
}

interface LineData {
  department_id: string
  department_name: string
  has_fiscal: boolean
  cash_income: number
  cash_refund: number
  pos_income: number
  pos_refund: number
  z_cash: number
  z_pos: number
  z_attachment_url: string
  pos_report_amount: number
}

interface Props {
  reportId: string
  propertyName: string
  departments: DepartmentInfo[]
  initialLines?: Array<{
    department_id: string
    cash_income: number
    cash_refund: number
    pos_income: number
    pos_refund: number
    z_cash: number
    z_pos: number
    z_attachment_url: string | null
    pos_report_amount: number
  }>
  generalAttachmentUrl?: string | null
  diffExplanation?: string | null
  status: string
  userRole: string
  userDepartmentIds?: string[]
}

function fmt(n: number): string {
  return n.toFixed(2)
}

export function DailyReportForm({
  reportId,
  propertyName,
  departments,
  initialLines,
  generalAttachmentUrl: initialGeneralAttachment,
  diffExplanation: initialDiffExplanation,
  status,
  userRole,
  userDepartmentIds,
}: Props) {
  const router = useRouter()

  const [lines, setLines] = useState<LineData[]>(
    departments.map((dept) => {
      const existing = initialLines?.find((l) => l.department_id === dept.id)
      return {
        department_id: dept.id,
        department_name: dept.name,
        has_fiscal: !!dept.fiscal_device_id,
        cash_income: existing?.cash_income ?? 0,
        cash_refund: existing?.cash_refund ?? 0,
        pos_income: existing?.pos_income ?? 0,
        pos_refund: existing?.pos_refund ?? 0,
        z_cash: existing?.z_cash ?? 0,
        z_pos: existing?.z_pos ?? 0,
        z_attachment_url: existing?.z_attachment_url ?? '',
        pos_report_amount: existing?.pos_report_amount ?? 0,
      }
    })
  )

  const [generalAttachment, setGeneralAttachment] = useState(initialGeneralAttachment ?? '')
  const [diffExplanation, setDiffExplanation] = useState(initialDiffExplanation ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingLine, setSavingLine] = useState<string | null>(null)

  // Totals
  const totalCashNet = lines.reduce((s, l) => s + l.cash_income - l.cash_refund, 0)
  const totalPosNet = lines.reduce((s, l) => s + l.pos_income - l.pos_refund, 0)
  const totalCashDiff = lines.reduce((s, l) => s + (l.cash_income - l.cash_refund - l.z_cash), 0)
  const totalPosDiff = lines.reduce((s, l) => s + (l.pos_income - l.pos_refund - l.pos_report_amount), 0)
  const totalDiff = totalCashDiff + totalPosDiff

  const canEdit = status === 'DRAFT' || status === 'RETURNED'
  const canSubmit = canEdit && (userRole === 'MANAGER' || userRole === 'ADMIN_CO')
  const isDeptHead = userRole === 'DEPT_HEAD'

  function canEditLine(deptId: string): boolean {
    if (!canEdit) return false
    if (isDeptHead && userDepartmentIds) {
      return userDepartmentIds.includes(deptId)
    }
    return true
  }

  function updateLine(deptId: string, field: keyof LineData, value: number | string) {
    setLines((prev) =>
      prev.map((l) => (l.department_id === deptId ? { ...l, [field]: value } : l))
    )
  }

  async function saveLine(deptId: string) {
    const line = lines.find((l) => l.department_id === deptId)
    if (!line) return

    setSavingLine(deptId)
    setError(null)

    try {
      const res = await fetch(`/api/finance/daily-reports/${reportId}/lines`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: deptId,
          cash_income: line.cash_income,
          cash_refund: line.cash_refund,
          pos_income: line.pos_income,
          pos_refund: line.pos_refund,
          z_cash: line.z_cash,
          z_pos: line.z_pos,
          z_attachment_url: line.z_attachment_url || null,
          pos_report_amount: line.pos_report_amount,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? 'Грешка при запис')
      }
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setSavingLine(null)
    }
  }

  async function saveAllLines() {
    setError(null)
    setLoading(true)

    try {
      for (const line of lines) {
        if (!canEditLine(line.department_id)) continue

        const res = await fetch(`/api/finance/daily-reports/${reportId}/lines`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            department_id: line.department_id,
            cash_income: line.cash_income,
            cash_refund: line.cash_refund,
            pos_income: line.pos_income,
            pos_refund: line.pos_refund,
            z_cash: line.z_cash,
            z_pos: line.z_pos,
            z_attachment_url: line.z_attachment_url || null,
            pos_report_amount: line.pos_report_amount,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.message ?? 'Грешка при запис')
          return
        }
      }
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    // Save all lines first
    await saveAllLines()
    if (error) return

    setLoading(true)
    try {
      const res = await fetch(`/api/finance/daily-reports/${reportId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          general_attachment_url: generalAttachment || null,
          diff_explanation: totalDiff !== 0 ? diffExplanation : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? 'Грешка при изпращане')
        return
      }

      router.push(`/finance/daily-reports/${reportId}`)
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const diffColor = (v: number) => (v !== 0 ? 'text-red-500' : 'text-green-500')

  function numInput(
    deptId: string,
    field: keyof LineData,
    value: number,
    disabled: boolean
  ) {
    return (
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value || ''}
        disabled={disabled}
        onChange={(e) => updateLine(deptId, field, parseFloat(e.target.value) || 0)}
        className="h-8 text-sm"
      />
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {/* Department sections */}
      {lines.map((line) => {
        const editable = canEditLine(line.department_id)
        const cashNet = line.cash_income - line.cash_refund
        const posNet = line.pos_income - line.pos_refund
        const cashDiff = cashNet - line.z_cash
        const posDiff = posNet - line.pos_report_amount
        const lineDiff = cashDiff + posDiff
        const isSaving = savingLine === line.department_id

        return (
          <Card key={line.department_id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{line.department_name}</CardTitle>
                {editable && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => saveLine(line.department_id)}
                  >
                    {isSaving ? 'Запис...' : 'Запази'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-[140px_1fr_1fr_100px] gap-2 text-sm">
                {/* Cash row */}
                <div className="flex items-center font-medium">Каса</div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Приход</Label>
                  {numInput(line.department_id, 'cash_income', line.cash_income, !editable)}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Сторно</Label>
                  {numInput(line.department_id, 'cash_refund', line.cash_refund, !editable)}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Нето</Label>
                  <div className="h-8 flex items-center justify-end font-mono text-sm">
                    {fmt(cashNet)}
                  </div>
                </div>

                {/* POS row */}
                <div className="flex items-center font-medium">ПОС</div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Приход</Label>
                  {numInput(line.department_id, 'pos_income', line.pos_income, !editable)}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Сторно</Label>
                  {numInput(line.department_id, 'pos_refund', line.pos_refund, !editable)}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Нето</Label>
                  <div className="h-8 flex items-center justify-end font-mono text-sm">
                    {fmt(posNet)}
                  </div>
                </div>
              </div>

              <Separator className="my-3" />

              {/* Z-report & POS report */}
              <div className="grid grid-cols-[140px_1fr_1fr_100px] gap-2 text-sm">
                <div className="flex items-center font-medium">Z-отчет</div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Каса от Z</Label>
                  {numInput(line.department_id, 'z_cash', line.z_cash, !editable)}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">ПОС от Z</Label>
                  {numInput(line.department_id, 'z_pos', line.z_pos, !editable)}
                </div>
                <div />

                <div className="flex items-center font-medium">ПОС отчет</div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Сума от банка</Label>
                  {numInput(line.department_id, 'pos_report_amount', line.pos_report_amount, !editable)}
                </div>
                <div />
                <div />
              </div>

              {/* Z-report attachment */}
              {line.has_fiscal && (
                <div className="mt-3 space-y-1">
                  <Label className="text-xs text-muted-foreground">Z-отчет файл</Label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={line.z_attachment_url}
                    disabled={!editable}
                    onChange={(e) => updateLine(line.department_id, 'z_attachment_url', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              )}

              {/* Differences */}
              <div className="mt-3 flex gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Каса разл: </span>
                  <span className={diffColor(cashDiff)}>{fmt(cashDiff)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ПОС разл: </span>
                  <span className={diffColor(posDiff)}>{fmt(posDiff)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Общо: </span>
                  <span className={`font-medium ${diffColor(lineDiff)}`}>{fmt(lineDiff)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Totals card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Обобщение — {propertyName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Общо каса нето</div>
              <div className="text-lg font-medium font-mono">{fmt(totalCashNet)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Общо ПОС нето</div>
              <div className="text-lg font-medium font-mono">{fmt(totalPosNet)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Общо</div>
              <div className="text-lg font-medium font-mono">{fmt(totalCashNet + totalPosNet)}</div>
            </div>
          </div>

          <Separator className="my-3" />

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Разлика каса</div>
              <div className={`text-lg font-medium font-mono ${diffColor(totalCashDiff)}`}>
                {fmt(totalCashDiff)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Разлика ПОС</div>
              <div className={`text-lg font-medium font-mono ${diffColor(totalPosDiff)}`}>
                {fmt(totalPosDiff)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Обща разлика</div>
              <div className={`text-lg font-medium font-mono ${diffColor(totalDiff)}`}>
                {fmt(totalDiff)}
              </div>
            </div>
          </div>

          {totalDiff !== 0 && canEdit && (
            <div className="mt-4 space-y-2">
              <Label>Обяснение за разликата *</Label>
              <Textarea
                value={diffExplanation}
                onChange={(e) => setDiffExplanation(e.target.value)}
                placeholder="Опишете причината за разликата..."
                rows={3}
              />
            </div>
          )}

          {/* General attachment */}
          {canEdit && (
            <div className="mt-4 space-y-2">
              <Label>Общ прикачен файл (незадължителен)</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={generalAttachment}
                onChange={(e) => setGeneralAttachment(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      {canEdit && (
        <div className="flex gap-3">
          {canSubmit && (
            <Button disabled={loading} onClick={handleSubmit}>
              {loading ? 'Изпращане...' : 'Изпрати към ЦО'}
            </Button>
          )}
          <Button variant="outline" disabled={loading} onClick={saveAllLines}>
            {loading ? 'Запис...' : 'Запази всичко'}
          </Button>
          <Button variant="ghost" onClick={() => router.back()}>
            Отказ
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/finance/DailyReportForm.tsx
git commit -m "feat: rewrite DailyReportForm for per-property model with department sections"
```

---

### Task 9: DailyReportView & DailyReportActions (Simplified)

**Files:**
- Modify: `components/finance/DailyReportView.tsx`
- Modify: `components/finance/DailyReportActions.tsx`

- [ ] **Step 1: Rewrite DailyReportView**

Replace the entire content of `components/finance/DailyReportView.tsx`:

```typescript
'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { DailyReportStatus } from '@/types/finance'

const statusLabels: Record<DailyReportStatus, string> = {
  DRAFT: 'Чернова',
  SUBMITTED: 'Изпратен',
  APPROVED: 'Одобрен',
  RETURNED: 'Върнат',
}

const statusVariants: Record<DailyReportStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  SUBMITTED: 'default',
  APPROVED: 'outline',
  RETURNED: 'destructive',
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function diffColor(v: number): string {
  return v !== 0 ? 'text-red-500' : 'text-green-500'
}

interface Props {
  report: any
}

export function DailyReportView({ report }: Props) {
  const propertyName = report.properties?.name ?? '—'
  const lines: any[] = report.daily_report_lines ?? []

  const createdAt = new Date(report.created_at).toLocaleString('bg-BG', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">
            Дневен отчет — {propertyName} — {report.date}
          </CardTitle>
          <Badge variant={statusVariants[report.status as DailyReportStatus]}>
            {statusLabels[report.status as DailyReportStatus]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Обект: </span>{propertyName}
          </div>
          <div>
            <span className="text-muted-foreground">Създаден: </span>{createdAt}
          </div>
          {report.co_comment && (
            <div>
              <span className="text-muted-foreground">Коментар от ЦО: </span>
              {report.co_comment}
            </div>
          )}
          {report.general_attachment_url && (
            <div>
              <a
                href={report.general_attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Общ прикачен файл
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department lines */}
      {lines.map((line: any) => {
        const deptName = line.departments?.name ?? line.department_id
        const cashNet = Number(line.cash_net)
        const posNet = Number(line.pos_net)
        const cashDiff = Number(line.cash_diff)
        const posDiff = Number(line.pos_diff)
        const lineDiff = Number(line.total_diff)

        return (
          <Card key={line.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{deptName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Каса приход</div>
                  <div className="font-mono">{fmt(line.cash_income)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Каса сторно</div>
                  <div className="font-mono">{fmt(line.cash_refund)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Каса нето</div>
                  <div className="font-mono font-medium">{fmt(cashNet)}</div>
                </div>
                <div />

                <div className="space-y-1">
                  <div className="text-muted-foreground">ПОС приход</div>
                  <div className="font-mono">{fmt(line.pos_income)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">ПОС сторно</div>
                  <div className="font-mono">{fmt(line.pos_refund)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">ПОС нето</div>
                  <div className="font-mono font-medium">{fmt(posNet)}</div>
                </div>
                <div />
              </div>

              <Separator className="my-3" />

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Z-отчет каса</div>
                  <div className="font-mono">{fmt(line.z_cash)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Z-отчет ПОС</div>
                  <div className="font-mono">{fmt(line.z_pos)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">ПОС отчет (банка)</div>
                  <div className="font-mono">{fmt(line.pos_report_amount)}</div>
                </div>
                {line.z_attachment_url && (
                  <div className="space-y-1">
                    <a
                      href={line.z_attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      Z-отчет файл
                    </a>
                  </div>
                )}
              </div>

              <Separator className="my-3" />

              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Каса разл: </span>
                  <span className={`font-mono ${diffColor(cashDiff)}`}>{fmt(cashDiff)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ПОС разл: </span>
                  <span className={`font-mono ${diffColor(posDiff)}`}>{fmt(posDiff)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Общо: </span>
                  <span className={`font-mono font-medium ${diffColor(lineDiff)}`}>{fmt(lineDiff)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Report totals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Обобщение</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Общо каса нето</div>
              <div className="text-lg font-medium font-mono">{fmt(report.total_cash_net)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Общо ПОС нето</div>
              <div className="text-lg font-medium font-mono">{fmt(report.total_pos_net)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Обща разлика</div>
              <div className={`text-lg font-medium font-mono ${diffColor(report.total_diff)}`}>
                {fmt(report.total_diff)}
              </div>
            </div>
          </div>
          {report.diff_explanation && (
            <div className="mt-4 text-sm">
              <span className="text-muted-foreground">Обяснение: </span>
              {report.diff_explanation}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Simplify DailyReportActions**

Replace the entire content of `components/finance/DailyReportActions.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DailyReportStatus, UserRole } from '@/types/finance'

interface Props {
  reportId: string
  status: DailyReportStatus
  userRole: UserRole
}

export function DailyReportActions({ reportId, status, userRole }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [showReturn, setShowReturn] = useState(false)

  const baseUrl = `/api/finance/daily-reports/${reportId}`

  async function performAction(action: string, body?: Record<string, unknown>) {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${baseUrl}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка')
        return
      }
      setShowReturn(false)
      setComment('')
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const isCO = userRole === 'ADMIN_CO' || userRole === 'FINANCE_CO'
  const canApprove = isCO && status === 'SUBMITTED'
  const canReturn = isCO && status === 'SUBMITTED'

  if (!canApprove && !canReturn) return null

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {canApprove && (
            <Button disabled={loading} onClick={() => performAction('approve')}>
              {loading ? 'Одобряване...' : 'Одобри'}
            </Button>
          )}

          {canReturn && (
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => setShowReturn(!showReturn)}
            >
              Върни
            </Button>
          )}
        </div>

        {showReturn && (
          <div className="space-y-3 border rounded-lg p-4">
            <Label htmlFor="return_comment">Коментар (задължителен при връщане)</Label>
            <Textarea
              id="return_comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Причина за връщане..."
              rows={3}
            />
            <Button
              variant="destructive"
              disabled={loading || comment.trim().length === 0}
              onClick={() => performAction('return', { comment: comment.trim() })}
            >
              {loading ? 'Връщане...' : 'Потвърди връщане'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/finance/DailyReportView.tsx components/finance/DailyReportActions.tsx
git commit -m "feat: rewrite DailyReportView and simplify DailyReportActions"
```

---

### Task 10: Pages — Tabular List, New Report, Detail

**Files:**
- Modify: `app/(finance)/finance/daily-reports/page.tsx`
- Modify: `app/(finance)/finance/daily-reports/new/page.tsx`
- Modify: `app/(finance)/finance/daily-reports/[id]/page.tsx`

- [ ] **Step 1: Rewrite the main daily reports page**

Replace `app/(finance)/finance/daily-reports/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole, getUserPropertyIds } from '@/lib/finance/auth'
import { DailyReportTable } from '@/components/finance/DailyReportTable'
import type { ReportWithLines } from '@/components/finance/DailyReportTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'

interface Props {
  searchParams: Promise<{ property_id?: string }>
}

export default async function DailyReportsPage({ searchParams }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const params = await searchParams

  // Get accessible properties
  let properties: Array<{ id: string; name: string }> = []
  if (isCORole(user.role)) {
    const { data } = await supabase
      .from('properties')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name')
    properties = data ?? []
  } else {
    const propertyIds = await getUserPropertyIds(user)
    if (propertyIds && propertyIds.length > 0) {
      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .in('id', propertyIds)
        .eq('status', 'ACTIVE')
        .order('name')
      properties = data ?? []
    }
  }

  const selectedPropertyId = params.property_id ?? properties[0]?.id
  if (!selectedPropertyId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <p className="text-muted-foreground text-sm">Няма достъпни обекти.</p>
      </div>
    )
  }

  // Fetch departments for this property
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name')
    .eq('property_id', selectedPropertyId)
    .eq('status', 'ACTIVE')
    .order('name')

  // Fetch reports with lines
  const { data: reports } = await supabase
    .from('daily_reports')
    .select('*, daily_report_lines(*, departments(id, name))')
    .eq('property_id', selectedPropertyId)
    .order('date', { ascending: false })
    .limit(60)

  const canCreate = user.role === 'MANAGER' || user.role === 'ADMIN_CO' || user.role === 'DEPT_HEAD'

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg">Дневни отчети</CardTitle>
            {properties.length > 1 && (
              <select
                value={selectedPropertyId}
                onChange={(e) => {
                  // Client-side nav would be better, but this is a server component
                  // Use a link-based approach instead
                }}
                className="h-8 rounded-md border bg-zinc-900 text-sm px-2 [&_option]:bg-zinc-900 [&_option]:text-zinc-100"
                // We use a form-based approach for server component
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            {/* Property links for server-side navigation */}
            {properties.length > 1 && (
              <div className="flex gap-1">
                {properties.map((p) => (
                  <Link
                    key={p.id}
                    href={`/finance/daily-reports?property_id=${p.id}`}
                    className={`px-2 py-1 rounded text-xs ${
                      p.id === selectedPropertyId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {canCreate && (
            <Link
              href={`/finance/daily-reports/new?property_id=${selectedPropertyId}`}
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Нов отчет
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <DailyReportTable
            reports={(reports as ReportWithLines[]) ?? []}
            departments={departments ?? []}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the new report page**

Replace `app/(finance)/finance/daily-reports/new/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'

interface Props {
  searchParams: Promise<{ property_id?: string; date?: string }>
}

export default async function NewDailyReportPage({ searchParams }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const params = await searchParams
  const supabase = await createClient()

  if (!params.property_id) {
    // Show property picker
    let properties: Array<{ id: string; name: string }> = []
    const allowedIds = await getUserPropertyIds(user)
    if (allowedIds) {
      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .in('id', allowedIds)
        .eq('status', 'ACTIVE')
        .order('name')
      properties = data ?? []
    } else {
      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .order('name')
      properties = data ?? []
    }

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-lg font-semibold mb-6">Нов дневен отчет — изберете обект</h1>
        <div className="space-y-2">
          {properties.map((p) => (
            <a
              key={p.id}
              href={`/finance/daily-reports/new?property_id=${p.id}`}
              className="block px-3 py-2 rounded-md hover:bg-secondary text-sm"
            >
              {p.name}
            </a>
          ))}
          {properties.length === 0 && (
            <p className="text-muted-foreground text-sm">Няма достъпни обекти.</p>
          )}
        </div>
      </div>
    )
  }

  // Check access
  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(params.property_id)) {
    redirect('/finance/daily-reports')
  }

  const today = new Date().toISOString().slice(0, 10)
  const date = params.date ?? today

  // Check if report already exists for this property+date
  const { data: existing } = await supabase
    .from('daily_reports')
    .select('id')
    .eq('property_id', params.property_id)
    .eq('date', date)
    .maybeSingle()

  if (existing) {
    // Redirect to the existing report
    redirect(`/finance/daily-reports/${existing.id}`)
  }

  // Create the report via API
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/finance/daily-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ property_id: params.property_id, date }),
  })

  if (!response.ok) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-destructive text-sm">Грешка при създаване на отчет.</p>
      </div>
    )
  }

  const report = await response.json()
  redirect(`/finance/daily-reports/${report.id}`)
}
```

- [ ] **Step 3: Rewrite the detail page**

Replace `app/(finance)/finance/daily-reports/[id]/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { DailyReportForm } from '@/components/finance/DailyReportForm'
import { DailyReportView } from '@/components/finance/DailyReportView'
import { DailyReportActions } from '@/components/finance/DailyReportActions'

export default async function DailyReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const { id } = await params
  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select('*, properties(id, name), daily_report_lines(*, departments(id, name, fiscal_device_id))')
    .eq('id', id)
    .single()

  if (!report) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Отчетът не е намерен.</p>
      </div>
    )
  }

  const canEdit = report.status === 'DRAFT' || report.status === 'RETURNED'

  // For DEPT_HEAD, get their department access
  let userDepartmentIds: string[] | undefined
  if (user.role === 'DEPT_HEAD') {
    const { data: access } = await supabase
      .from('user_department_access')
      .select('department_id')
      .eq('user_id', user.id)
    userDepartmentIds = (access ?? []).map((a) => a.department_id)
  }

  // Get departments with fiscal info for the form
  const departments = (report.daily_report_lines ?? []).map((l: any) => ({
    id: l.departments.id,
    name: l.departments.name,
    fiscal_device_id: l.departments.fiscal_device_id ?? null,
  }))

  if (canEdit) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-lg font-semibold mb-6">
          Дневен отчет — {report.properties?.name} — {report.date}
        </h1>
        <DailyReportForm
          reportId={report.id}
          propertyName={report.properties?.name ?? ''}
          departments={departments}
          initialLines={(report.daily_report_lines ?? []).map((l: any) => ({
            department_id: l.department_id,
            cash_income: Number(l.cash_income),
            cash_refund: Number(l.cash_refund),
            pos_income: Number(l.pos_income),
            pos_refund: Number(l.pos_refund),
            z_cash: Number(l.z_cash),
            z_pos: Number(l.z_pos),
            z_attachment_url: l.z_attachment_url,
            pos_report_amount: Number(l.pos_report_amount),
          }))}
          generalAttachmentUrl={report.general_attachment_url}
          diffExplanation={report.diff_explanation}
          status={report.status}
          userRole={user.role}
          userDepartmentIds={userDepartmentIds}
        />
      </div>
    )
  }

  // Read-only view for submitted/approved reports
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <DailyReportView report={report} />
      <DailyReportActions
        reportId={report.id}
        status={report.status}
        userRole={user.role}
      />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/(finance)/finance/daily-reports/page.tsx app/(finance)/finance/daily-reports/new/page.tsx app/(finance)/finance/daily-reports/[id]/page.tsx
git commit -m "feat: rewrite daily report pages for per-property tabular model"
```

---

### Task 11: Cleanup & Build Verification

**Files:**
- Modify: `lib/finance/schemas/index.ts` (ensure exports are correct)

- [ ] **Step 1: Verify schema index exports**

Read `lib/finance/schemas/index.ts` and ensure it exports:
- `createDailyReportSchema`
- `updateLineSchema`
- `submitDailyReportSchema`
- `approveDailyReportSchema`
- `returnDailyReportSchema`

Remove old exports: `saveDailyReportSchema`, `confirmDailyReportSchema`, `returnFromCOSchema`, `posEntrySchema`, `zReportSchema`.

- [ ] **Step 2: Search for remaining references to old types/components**

Search the codebase for:
- `DailyReportList` (should be gone, replaced by `DailyReportTable`)
- `pos_entries` (should only be in migration files, not in new code)
- `z_reports` (same)
- `saveDailyReportSchema` (should be gone)
- `confirmDailyReportSchema` (should be gone)
- `department_id` in daily_reports context (should only be in lines, not in the report itself)
- `CONFIRMED` or `SENT_TO_CO` or `CORRECTED` daily report status references

Fix any remaining references.

- [ ] **Step 3: Run build**

Run: `cd /mnt/c/Users/gorch/Documents/assistant && npm run build`

Fix any TypeScript or build errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: cleanup old daily report references and fix build errors"
```

- [ ] **Step 5: Run dev server and verify**

Run: `npm run dev`

Navigate to `/finance/daily-reports` and verify:
1. Property selector works
2. Tabular view shows dates as rows, departments as columns
3. Clicking a date opens the form
4. "Нов отчет" creates a new report and redirects to form
5. Department sections show cash/POS fields
6. Differences calculate automatically
7. Save/Submit buttons work
8. Approved reports show read-only view
