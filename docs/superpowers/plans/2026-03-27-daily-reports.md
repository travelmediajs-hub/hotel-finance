# Daily Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full daily report workflow — DEPT_HEAD fills report, MANAGER confirms/returns, CO approves/returns/corrects.

**Architecture:** API routes handle CRUD and workflow transitions with Zod validation. Server components fetch data, client components handle forms and interactions. Three views: DEPT_HEAD sees own department reports, MANAGER sees all reports for their property, CO sees all reports across properties.

**Tech Stack:** Next.js 16 App Router, Supabase (RLS-scoped queries), Zod schemas (existing), shadcn/ui components (base-ui variant), TypeScript.

**Existing pieces (do NOT recreate):**
- DB tables: `daily_reports`, `daily_report_lines`, `pos_entries`, `z_reports`, `property_consolidations` — all created
- Types: `DailyReport`, `DailyReportLine`, `POSEntry`, `ZReport` in `types/finance.ts`
- Schemas: `saveDailyReportSchema`, `confirmDailyReportSchema`, `returnDailyReportSchema`, `approveDailyReportSchema`, `returnFromCOSchema` in `lib/finance/schemas/daily-report.ts`
- Auth: `getFinanceUser()`, `requireRole()`, `isCORole()` in `lib/finance/auth.ts`
- RLS policies: already configured for all daily report tables
- Sidebar: link to `/finance/daily-reports` already exists

---

## File Structure

### API Routes (new)
- `app/api/finance/daily-reports/route.ts` — GET list, POST create/save
- `app/api/finance/daily-reports/[id]/route.ts` — GET single report with lines/pos/z-report, PATCH update
- `app/api/finance/daily-reports/[id]/submit/route.ts` — POST submit (DRAFT → SUBMITTED)
- `app/api/finance/daily-reports/[id]/confirm/route.ts` — POST confirm (SUBMITTED → CONFIRMED)
- `app/api/finance/daily-reports/[id]/return/route.ts` — POST return (SUBMITTED → RETURNED or SENT_TO_CO → RETURNED)
- `app/api/finance/daily-reports/[id]/approve/route.ts` — POST approve (SENT_TO_CO → APPROVED)

### Pages (new)
- `app/(finance)/finance/daily-reports/page.tsx` — list of reports (role-scoped)
- `app/(finance)/finance/daily-reports/new/page.tsx` — create new report (DEPT_HEAD only)
- `app/(finance)/finance/daily-reports/[id]/page.tsx` — view/edit report

### Components (new)
- `components/finance/DailyReportList.tsx` — table listing reports with status badges and filters
- `components/finance/DailyReportForm.tsx` — full form: cash lines, POS entries, Z-report, diff section
- `components/finance/DailyReportView.tsx` — read-only view with action buttons per role
- `components/finance/DailyReportActions.tsx` — submit/confirm/return/approve buttons with dialogs

---

## Task 1: API — GET list and POST create daily reports

**Files:**
- Create: `app/api/finance/daily-reports/route.ts`

- [ ] **Step 1: Create GET endpoint for listing daily reports**

```ts
// app/api/finance/daily-reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { saveDailyReportSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('property_id')
  const date = searchParams.get('date')
  const status = searchParams.get('status')

  let query = supabase
    .from('daily_reports')
    .select(`
      *,
      departments!inner(name),
      properties!inner(name)
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  // Role-based scoping
  if (user.role === 'DEPT_HEAD') {
    // Dept heads only see reports they created
    query = query.eq('created_by_id', user.id)
  } else if (user.role === 'MANAGER') {
    // Managers see reports for their properties (RLS handles this)
  }
  // CO roles see everything (RLS handles this)

  if (propertyId) query = query.eq('property_id', propertyId)
  if (date) query = query.eq('date', date)
  if (status) query = query.eq('status', status)

  query = query.limit(100)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'database_error', details: error.message }, { status: 500 })

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Add POST endpoint for creating a daily report**

Append to the same file:

```ts
export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.role !== 'DEPT_HEAD') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = saveDailyReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { lines, pos_entries, z_report, ...reportData } = parsed.data
  const supabase = await createClient()

  // Check no existing report for same department+date
  const { data: existing } = await supabase
    .from('daily_reports')
    .select('id')
    .eq('department_id', reportData.department_id)
    .eq('date', reportData.date)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'duplicate', message: 'Вече съществува отчет за този отдел и дата' },
      { status: 409 }
    )
  }

  // Calculate totals
  const totalCashNet = lines.reduce((sum, l) => sum + l.cash_income - l.cash_return, 0)
  const totalPOSNet = pos_entries.reduce((sum, p) => sum + p.amount - p.return_amount, 0)
  const cashDiff = totalCashNet - z_report.cash_amount
  const posDiff = totalPOSNet - z_report.pos_amount
  const totalDiff = cashDiff + posDiff

  // Insert report
  const { data: report, error: reportError } = await supabase
    .from('daily_reports')
    .insert({
      ...reportData,
      created_by_id: user.id,
      status: 'DRAFT',
      total_cash_net: totalCashNet,
      total_pos_net: totalPOSNet,
      cash_diff: cashDiff,
      pos_diff: posDiff,
      total_diff: totalDiff,
    })
    .select()
    .single()

  if (reportError) {
    return NextResponse.json({ error: 'database_error', details: reportError.message }, { status: 500 })
  }

  // Insert lines
  if (lines.length > 0) {
    const { error: linesError } = await supabase
      .from('daily_report_lines')
      .insert(lines.map(l => ({ ...l, daily_report_id: report.id })))
    if (linesError) {
      return NextResponse.json({ error: 'database_error', details: linesError.message }, { status: 500 })
    }
  }

  // Insert POS entries
  if (pos_entries.length > 0) {
    const { error: posError } = await supabase
      .from('pos_entries')
      .insert(pos_entries.map(p => ({ ...p, daily_report_id: report.id })))
    if (posError) {
      return NextResponse.json({ error: 'database_error', details: posError.message }, { status: 500 })
    }
  }

  // Insert Z-report
  const { error: zError } = await supabase
    .from('z_reports')
    .insert({ ...z_report, daily_report_id: report.id })
  if (zError) {
    return NextResponse.json({ error: 'database_error', details: zError.message }, { status: 500 })
  }

  return NextResponse.json(report, { status: 201 })
}
```

- [ ] **Step 3: Verify the endpoint compiles**

Run: `npx next build --no-lint 2>&1 | head -30` or test manually via browser.

- [ ] **Step 4: Commit**

```bash
git add app/api/finance/daily-reports/route.ts
git commit -m "feat: add daily reports list and create API endpoints"
```

---

## Task 2: API — GET single report and workflow actions

**Files:**
- Create: `app/api/finance/daily-reports/[id]/route.ts`
- Create: `app/api/finance/daily-reports/[id]/submit/route.ts`
- Create: `app/api/finance/daily-reports/[id]/confirm/route.ts`
- Create: `app/api/finance/daily-reports/[id]/return/route.ts`
- Create: `app/api/finance/daily-reports/[id]/approve/route.ts`

- [ ] **Step 1: Create GET single report endpoint**

```ts
// app/api/finance/daily-reports/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data: report, error } = await supabase
    .from('daily_reports')
    .select(`
      *,
      departments(id, name),
      properties(id, name),
      daily_report_lines(*),
      pos_entries(*, pos_terminals(tid, bank, location)),
      z_reports(*)
    `)
    .eq('id', id)
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(report)
}
```

- [ ] **Step 2: Create submit endpoint (DRAFT → SUBMITTED)**

```ts
// app/api/finance/daily-reports/[id]/submit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.role !== 'DEPT_HEAD') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  // Fetch report with z_report
  const { data: report } = await supabase
    .from('daily_reports')
    .select('*, z_reports(*)')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (report.created_by_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (report.status !== 'DRAFT' && report.status !== 'RETURNED') {
    return NextResponse.json({ error: 'invalid_status', message: 'Отчетът не може да бъде изпратен в текущия статус' }, { status: 400 })
  }

  // Validate z_report attachment exists
  const zReport = Array.isArray(report.z_reports) ? report.z_reports[0] : report.z_reports
  if (!zReport?.attachment_url) {
    return NextResponse.json({ error: 'validation_error', message: 'Z-отчетът трябва да има прикачен файл' }, { status: 400 })
  }

  // Rule #3: diff_explanation required when totalDiff != 0
  if (report.total_diff !== 0 && !report.diff_explanation) {
    return NextResponse.json({ error: 'validation_error', message: 'Обяснение на разликата е задължително' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .update({ status: 'SUBMITTED', submitted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Create confirm endpoint (SUBMITTED → CONFIRMED)**

```ts
// app/api/finance/daily-reports/[id]/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (report.status !== 'SUBMITTED') {
    return NextResponse.json({ error: 'invalid_status', message: 'Отчетът не е в статус "Изпратен"' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .update({
      status: 'CONFIRMED',
      confirmed_by_id: user.id,
      confirmed_at: new Date().toISOString(),
      manager_comment: body.manager_comment ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Create return endpoint (SUBMITTED → RETURNED or SENT_TO_CO → RETURNED)**

```ts
// app/api/finance/daily-reports/[id]/return/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  if (!body.comment || body.comment.trim() === '') {
    return NextResponse.json({ error: 'validation_error', message: 'Коментарът е задължителен при връщане' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: report } = await supabase
    .from('daily_reports')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Manager can return SUBMITTED reports, CO can return SENT_TO_CO reports
  if (user.role === 'MANAGER' && report.status === 'SUBMITTED') {
    const { data, error } = await supabase
      .from('daily_reports')
      .update({ status: 'RETURNED', manager_comment: body.comment })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })
    return NextResponse.json(data)
  }

  if (isCORole(user.role) && report.status === 'SENT_TO_CO') {
    const { data, error } = await supabase
      .from('daily_reports')
      .update({ status: 'RETURNED', co_comment: body.comment })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'invalid_status', message: 'Отчетът не може да бъде върнат в текущия статус' }, { status: 400 })
}
```

- [ ] **Step 5: Create approve endpoint (SENT_TO_CO → APPROVED)**

```ts
// app/api/finance/daily-reports/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (report.status !== 'SENT_TO_CO') {
    return NextResponse.json({ error: 'invalid_status', message: 'Отчетът не е в статус "Изпратен към ЦО"' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('daily_reports')
    .update({
      status: 'APPROVED',
      approved_by_id: user.id,
      approved_at: new Date().toISOString(),
      co_comment: body.co_comment ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error' }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/finance/daily-reports/
git commit -m "feat: add daily report detail and workflow action API endpoints"
```

---

## Task 3: Daily Reports list page and component

**Files:**
- Create: `app/(finance)/finance/daily-reports/page.tsx`
- Create: `components/finance/DailyReportList.tsx`

- [ ] **Step 1: Create the DailyReportList client component**

```tsx
// components/finance/DailyReportList.tsx
'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { DailyReport } from '@/types/finance'

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  DRAFT: { label: 'Чернова', variant: 'secondary' },
  SUBMITTED: { label: 'Изпратен', variant: 'default' },
  CONFIRMED: { label: 'Потвърден', variant: 'default' },
  RETURNED: { label: 'Върнат', variant: 'destructive' },
  SENT_TO_CO: { label: 'Изпратен към ЦО', variant: 'default' },
  APPROVED: { label: 'Одобрен', variant: 'outline' },
  CORRECTED: { label: 'Коригиран', variant: 'outline' },
}

interface ReportWithJoins extends DailyReport {
  departments: { name: string }
  properties: { name: string }
}

interface Props {
  reports: ReportWithJoins[]
}

export function DailyReportList({ reports }: Props) {
  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Няма дневни отчети
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Обект</TableHead>
          <TableHead>Отдел</TableHead>
          <TableHead className="text-right">Каса нето</TableHead>
          <TableHead className="text-right">POS нето</TableHead>
          <TableHead className="text-right">Разлика</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map(report => {
          const st = statusLabels[report.status] ?? { label: report.status, variant: 'secondary' as const }
          return (
            <TableRow key={report.id}>
              <TableCell>
                <Link href={`/finance/daily-reports/${report.id}`} className="text-primary hover:underline">
                  {report.date}
                </Link>
              </TableCell>
              <TableCell>{report.properties?.name}</TableCell>
              <TableCell>{report.departments?.name}</TableCell>
              <TableCell className="text-right">{Number(report.total_cash_net).toFixed(2)}</TableCell>
              <TableCell className="text-right">{Number(report.total_pos_net).toFixed(2)}</TableCell>
              <TableCell className={`text-right ${report.total_diff !== 0 ? 'text-destructive font-medium' : ''}`}>
                {Number(report.total_diff).toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge variant={st.variant}>{st.label}</Badge>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Create the list page (server component)**

```tsx
// app/(finance)/finance/daily-reports/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { DailyReportList } from '@/components/finance/DailyReportList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DailyReportsPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()

  let query = supabase
    .from('daily_reports')
    .select(`
      *,
      departments!inner(name),
      properties!inner(name)
    `)
    .order('date', { ascending: false })
    .limit(100)

  if (user.role === 'DEPT_HEAD') {
    query = query.eq('created_by_id', user.id)
  }

  const { data: reports } = await query

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Дневни отчети</CardTitle>
          {user.role === 'DEPT_HEAD' && (
            <Link
              href="/finance/daily-reports/new"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
            >
              Нов отчет
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <DailyReportList reports={reports ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verify the page loads at /finance/daily-reports**

Open http://localhost:3000/finance/daily-reports — should show empty state.

- [ ] **Step 4: Commit**

```bash
git add app/(finance)/finance/daily-reports/page.tsx components/finance/DailyReportList.tsx
git commit -m "feat: add daily reports list page"
```

---

## Task 4: Daily Report form component

**Files:**
- Create: `components/finance/DailyReportForm.tsx`

- [ ] **Step 1: Create the DailyReportForm client component**

This is the main form for DEPT_HEAD to fill in the daily report. It has sections:
- A: Department & date (auto-filled)
- B: Cash income lines (one per active department)
- C: POS entries (one per assigned terminal)
- D: Z-report (cash, pos, attachment)
- E: Calculated diffs + explanation

```tsx
// components/finance/DailyReportForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { Department, POSTerminal } from '@/types/finance'

interface CashLine {
  department_id: string
  department_name: string
  cash_income: number
  cash_return: number
}

interface PosLine {
  pos_terminal_id: string
  terminal_label: string
  amount: number
  return_amount: number
}

interface Props {
  department: Department
  property_id: string
  departments: Department[]
  posTerminals: POSTerminal[]
}

export function DailyReportForm({ department, property_id, departments, posTerminals }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const [date, setDate] = useState(today)

  // Cash lines — one per active department
  const [cashLines, setCashLines] = useState<CashLine[]>(
    departments.map(d => ({
      department_id: d.id,
      department_name: d.name,
      cash_income: 0,
      cash_return: 0,
    }))
  )

  // POS lines — one per assigned terminal
  const [posLines, setPosLines] = useState<PosLine[]>(
    posTerminals.map(t => ({
      pos_terminal_id: t.id,
      terminal_label: `${t.tid} (${t.bank})`,
      amount: 0,
      return_amount: 0,
    }))
  )

  // Z-report
  const [zCash, setZCash] = useState(0)
  const [zPos, setZPos] = useState(0)
  const [zAttachment, setZAttachment] = useState('')
  const [diffExplanation, setDiffExplanation] = useState('')

  // Calculations
  const totalCashNet = cashLines.reduce((s, l) => s + l.cash_income - l.cash_return, 0)
  const totalPOSNet = posLines.reduce((s, l) => s + l.amount - l.return_amount, 0)
  const cashDiff = totalCashNet - zCash
  const posDiff = totalPOSNet - zPos
  const totalDiff = cashDiff + posDiff

  function updateCashLine(index: number, field: 'cash_income' | 'cash_return', value: number) {
    setCashLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  function updatePosLine(index: number, field: 'amount' | 'return_amount', value: number) {
    setPosLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  async function handleSubmit(asDraft: boolean) {
    setError(null)
    setLoading(true)

    // Validate attachment
    if (!asDraft && !zAttachment) {
      setError('Z-отчетът трябва да има прикачен файл')
      setLoading(false)
      return
    }

    // Validate diff explanation
    if (!asDraft && totalDiff !== 0 && !diffExplanation.trim()) {
      setError('Обяснение на разликата е задължително')
      setLoading(false)
      return
    }

    const body = {
      department_id: department.id,
      property_id,
      date,
      lines: cashLines.map(l => ({
        department_id: l.department_id,
        cash_income: l.cash_income,
        cash_return: l.cash_return,
      })),
      pos_entries: posLines.map(p => ({
        pos_terminal_id: p.pos_terminal_id,
        amount: p.amount,
        return_amount: p.return_amount,
      })),
      z_report: {
        cash_amount: zCash,
        pos_amount: zPos,
        attachment_url: zAttachment || 'https://placeholder.test/z-report.pdf',
        additional_files: [],
      },
      diff_explanation: diffExplanation || null,
    }

    try {
      const res = await fetch('/api/finance/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        const details = data.details?.fieldErrors
          ? Object.entries(data.details.fieldErrors)
              .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
              .join(' | ')
          : null
        setError(details ?? data.message ?? data.error ?? 'Грешка при запис')
        setLoading(false)
        return
      }

      const saved = await res.json()

      // If not draft, submit immediately
      if (!asDraft) {
        await fetch(`/api/finance/daily-reports/${saved.id}/submit`, { method: 'POST' })
      }

      router.push(`/finance/daily-reports/${saved.id}`)
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>
      )}

      {/* Section A: Department & Date */}
      <Card>
        <CardHeader><CardTitle className="text-base">Отдел и дата</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Отдел</Label>
            <Input value={department.name} disabled />
          </div>
          <div>
            <Label>Дата</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)}
              min={yesterday} max={today} />
          </div>
        </CardContent>
      </Card>

      {/* Section B: Cash Income */}
      <Card>
        <CardHeader><CardTitle className="text-base">Б. Приходи в брой</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_120px_120px_100px] gap-2 text-sm">
            <div className="font-medium text-muted-foreground">Отдел</div>
            <div className="font-medium text-muted-foreground text-right">Приход</div>
            <div className="font-medium text-muted-foreground text-right">Сторно</div>
            <div className="font-medium text-muted-foreground text-right">Нето</div>
            {cashLines.map((line, i) => (
              <div key={line.department_id} className="contents">
                <div className="flex items-center">{line.department_name}</div>
                <Input type="number" min={0} step="0.01" value={line.cash_income || ''}
                  onChange={e => updateCashLine(i, 'cash_income', Number(e.target.value))}
                  className="text-right" />
                <Input type="number" min={0} step="0.01" value={line.cash_return || ''}
                  onChange={e => updateCashLine(i, 'cash_return', Number(e.target.value))}
                  className="text-right" />
                <div className="flex items-center justify-end font-mono">
                  {(line.cash_income - line.cash_return).toFixed(2)}
                </div>
              </div>
            ))}
            <Separator className="col-span-4 my-2" />
            <div className="font-medium">Общо каса</div>
            <div />
            <div />
            <div className="text-right font-medium font-mono">{totalCashNet.toFixed(2)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Section C: POS Entries */}
      {posLines.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">В. Приходи по POS терминали</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_120px_120px_100px] gap-2 text-sm">
              <div className="font-medium text-muted-foreground">Терминал</div>
              <div className="font-medium text-muted-foreground text-right">Сума</div>
              <div className="font-medium text-muted-foreground text-right">Сторно</div>
              <div className="font-medium text-muted-foreground text-right">Нето</div>
              {posLines.map((line, i) => (
                <div key={line.pos_terminal_id} className="contents">
                  <div className="flex items-center">{line.terminal_label}</div>
                  <Input type="number" min={0} step="0.01" value={line.amount || ''}
                    onChange={e => updatePosLine(i, 'amount', Number(e.target.value))}
                    className="text-right" />
                  <Input type="number" min={0} step="0.01" value={line.return_amount || ''}
                    onChange={e => updatePosLine(i, 'return_amount', Number(e.target.value))}
                    className="text-right" />
                  <div className="flex items-center justify-end font-mono">
                    {(line.amount - line.return_amount).toFixed(2)}
                  </div>
                </div>
              ))}
              <Separator className="col-span-4 my-2" />
              <div className="font-medium">Общо POS</div>
              <div />
              <div />
              <div className="text-right font-medium font-mono">{totalPOSNet.toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section D: Z-Report */}
      <Card>
        <CardHeader><CardTitle className="text-base">Г. Фискален Z-отчет</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Каса (от Z-отчета)</Label>
            <Input type="number" min={0} step="0.01" value={zCash || ''}
              onChange={e => setZCash(Number(e.target.value))} />
          </div>
          <div>
            <Label>POS (от Z-отчета)</Label>
            <Input type="number" min={0} step="0.01" value={zPos || ''}
              onChange={e => setZPos(Number(e.target.value))} />
          </div>
          <div>
            <Label>Общо Z</Label>
            <Input value={(zCash + zPos).toFixed(2)} disabled />
          </div>
          <div className="md:col-span-3">
            <Label>Прикачен файл (URL) *</Label>
            <Input placeholder="https://... (PDF/JPG/PNG)"
              value={zAttachment} onChange={e => setZAttachment(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Section E: Diffs */}
      <Card>
        <CardHeader><CardTitle className="text-base">Д. Разлики</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Разлика каса:</span>
              <span className={`ml-2 font-mono font-medium ${cashDiff !== 0 ? 'text-destructive' : ''}`}>
                {cashDiff.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Разлика POS:</span>
              <span className={`ml-2 font-mono font-medium ${posDiff !== 0 ? 'text-destructive' : ''}`}>
                {posDiff.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Общо разлика:</span>
              <span className={`ml-2 font-mono font-medium ${totalDiff !== 0 ? 'text-destructive' : ''}`}>
                {totalDiff.toFixed(2)}
              </span>
            </div>
          </div>
          {totalDiff !== 0 && (
            <div>
              <Label>Обяснение на разликата *</Label>
              <Textarea value={diffExplanation}
                onChange={e => setDiffExplanation(e.target.value)}
                placeholder="Задължително при разлика ≠ 0" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={() => handleSubmit(false)} disabled={loading}>
          {loading ? 'Изпращане...' : 'Изпрати отчет'}
        </Button>
        <Button variant="outline" onClick={() => handleSubmit(true)} disabled={loading}>
          Запази чернова
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>Отказ</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/finance/DailyReportForm.tsx
git commit -m "feat: add DailyReportForm component with cash/POS/Z-report sections"
```

---

## Task 5: New report page

**Files:**
- Create: `app/(finance)/finance/daily-reports/new/page.tsx`

- [ ] **Step 1: Create the new report page**

This page fetches the DEPT_HEAD's department, its associated POS terminals, and all active departments for the property (for cash lines).

```tsx
// app/(finance)/finance/daily-reports/new/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/finance/auth'
import { DailyReportForm } from '@/components/finance/DailyReportForm'

export default async function NewDailyReportPage() {
  const user = await requireRole('DEPT_HEAD')
  if (!user) redirect('/finance')

  const supabase = await createClient()

  // Get user's department(s) via department access
  const { data: access } = await supabase
    .from('user_department_access')
    .select('department_id')
    .eq('user_id', user.id)

  if (!access || access.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Нямате присвоен отдел. Свържете се с администратор.</p>
      </div>
    )
  }

  // Get the first department (DEPT_HEAD typically has one)
  const { data: department } = await supabase
    .from('departments')
    .select('*')
    .eq('id', access[0].department_id)
    .eq('status', 'ACTIVE')
    .single()

  if (!department) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Отделът не е намерен или не е активен.</p>
      </div>
    )
  }

  // Get all active departments for this property (for cash lines)
  const { data: departments } = await supabase
    .from('departments')
    .select('*')
    .eq('property_id', department.property_id)
    .eq('status', 'ACTIVE')
    .order('name')

  // Get POS terminals assigned to this department
  const { data: deptTerminals } = await supabase
    .from('department_pos_terminals')
    .select('pos_terminal_id')
    .eq('department_id', department.id)

  const terminalIds = deptTerminals?.map(t => t.pos_terminal_id) ?? []

  let posTerminals: any[] = []
  if (terminalIds.length > 0) {
    const { data } = await supabase
      .from('pos_terminals')
      .select('*')
      .in('id', terminalIds)
      .eq('status', 'ACTIVE')
    posTerminals = data ?? []
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Нов дневен отчет</h1>
      <DailyReportForm
        department={department}
        property_id={department.property_id}
        departments={departments ?? []}
        posTerminals={posTerminals}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify the page loads at /finance/daily-reports/new**

- [ ] **Step 3: Commit**

```bash
git add app/(finance)/finance/daily-reports/new/page.tsx
git commit -m "feat: add new daily report page for DEPT_HEAD"
```

---

## Task 6: Report detail page with view and actions

**Files:**
- Create: `components/finance/DailyReportView.tsx`
- Create: `components/finance/DailyReportActions.tsx`
- Create: `app/(finance)/finance/daily-reports/[id]/page.tsx`

- [ ] **Step 1: Create DailyReportView component (read-only view)**

```tsx
// components/finance/DailyReportView.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  DRAFT: { label: 'Чернова', variant: 'secondary' },
  SUBMITTED: { label: 'Изпратен', variant: 'default' },
  CONFIRMED: { label: 'Потвърден', variant: 'default' },
  RETURNED: { label: 'Върнат', variant: 'destructive' },
  SENT_TO_CO: { label: 'Изпратен към ЦО', variant: 'default' },
  APPROVED: { label: 'Одобрен', variant: 'outline' },
  CORRECTED: { label: 'Коригиран', variant: 'outline' },
}

interface Props {
  report: any // Full report with joins
}

export function DailyReportView({ report }: Props) {
  const st = statusLabels[report.status] ?? { label: report.status, variant: 'secondary' as const }
  const zReport = Array.isArray(report.z_reports) ? report.z_reports[0] : report.z_reports
  const lines = report.daily_report_lines ?? []
  const posEntries = report.pos_entries ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Отчет — {report.departments?.name} — {report.date}
          </CardTitle>
          <Badge variant={st.variant}>{st.label}</Badge>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="text-muted-foreground">Обект:</span> {report.properties?.name}</p>
          <p><span className="text-muted-foreground">Създаден:</span> {new Date(report.created_at).toLocaleString('bg-BG')}</p>
          {report.manager_comment && (
            <p><span className="text-muted-foreground">Коментар управител:</span> {report.manager_comment}</p>
          )}
          {report.co_comment && (
            <p><span className="text-muted-foreground">Коментар ЦО:</span> {report.co_comment}</p>
          )}
        </CardContent>
      </Card>

      {/* Cash lines */}
      <Card>
        <CardHeader><CardTitle className="text-base">Б. Приходи в брой</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="font-medium text-muted-foreground">Отдел</div>
            <div className="font-medium text-muted-foreground text-right">Приход</div>
            <div className="font-medium text-muted-foreground text-right">Сторно</div>
            <div className="font-medium text-muted-foreground text-right">Нето</div>
            {lines.map((line: any) => (
              <div key={line.id} className="contents">
                <div>{line.department_id}</div>
                <div className="text-right font-mono">{Number(line.cash_income).toFixed(2)}</div>
                <div className="text-right font-mono">{Number(line.cash_return).toFixed(2)}</div>
                <div className="text-right font-mono">{Number(line.cash_net).toFixed(2)}</div>
              </div>
            ))}
            <Separator className="col-span-4 my-2" />
            <div className="font-medium">Общо каса</div>
            <div /><div />
            <div className="text-right font-medium font-mono">{Number(report.total_cash_net).toFixed(2)}</div>
          </div>
        </CardContent>
      </Card>

      {/* POS entries */}
      {posEntries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">В. Приходи по POS</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <div className="font-medium text-muted-foreground">Терминал</div>
              <div className="font-medium text-muted-foreground text-right">Сума</div>
              <div className="font-medium text-muted-foreground text-right">Сторно</div>
              <div className="font-medium text-muted-foreground text-right">Нето</div>
              {posEntries.map((entry: any) => (
                <div key={entry.id} className="contents">
                  <div>{entry.pos_terminals?.tid ?? entry.pos_terminal_id}</div>
                  <div className="text-right font-mono">{Number(entry.amount).toFixed(2)}</div>
                  <div className="text-right font-mono">{Number(entry.return_amount).toFixed(2)}</div>
                  <div className="text-right font-mono">{Number(entry.net_amount).toFixed(2)}</div>
                </div>
              ))}
              <Separator className="col-span-4 my-2" />
              <div className="font-medium">Общо POS</div>
              <div /><div />
              <div className="text-right font-medium font-mono">{Number(report.total_pos_net).toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Z-Report */}
      {zReport && (
        <Card>
          <CardHeader><CardTitle className="text-base">Г. Фискален Z-отчет</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="grid grid-cols-3 gap-4">
              <p><span className="text-muted-foreground">Каса:</span> <span className="font-mono">{Number(zReport.cash_amount).toFixed(2)}</span></p>
              <p><span className="text-muted-foreground">POS:</span> <span className="font-mono">{Number(zReport.pos_amount).toFixed(2)}</span></p>
              <p><span className="text-muted-foreground">Общо:</span> <span className="font-mono">{Number(zReport.total_amount).toFixed(2)}</span></p>
            </div>
            {zReport.attachment_url && (
              <p><span className="text-muted-foreground">Файл:</span> <a href={zReport.attachment_url} target="_blank" className="text-primary hover:underline">Отвори</a></p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diffs */}
      <Card>
        <CardHeader><CardTitle className="text-base">Д. Разлики</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="grid grid-cols-3 gap-4">
            <p>
              <span className="text-muted-foreground">Каса:</span>
              <span className={`ml-2 font-mono font-medium ${Number(report.cash_diff) !== 0 ? 'text-destructive' : ''}`}>
                {Number(report.cash_diff).toFixed(2)}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">POS:</span>
              <span className={`ml-2 font-mono font-medium ${Number(report.pos_diff) !== 0 ? 'text-destructive' : ''}`}>
                {Number(report.pos_diff).toFixed(2)}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Общо:</span>
              <span className={`ml-2 font-mono font-medium ${Number(report.total_diff) !== 0 ? 'text-destructive' : ''}`}>
                {Number(report.total_diff).toFixed(2)}
              </span>
            </p>
          </div>
          {report.diff_explanation && (
            <p><span className="text-muted-foreground">Обяснение:</span> {report.diff_explanation}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create DailyReportActions component**

```tsx
// components/finance/DailyReportActions.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import type { UserRole, DailyReportStatus } from '@/types/finance'

interface Props {
  reportId: string
  status: DailyReportStatus
  userRole: UserRole
  isOwner: boolean
}

export function DailyReportActions({ reportId, status, userRole, isOwner }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [showReturn, setShowReturn] = useState(false)

  async function doAction(action: string, body?: Record<string, unknown>) {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/daily-reports/${reportId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка')
        return
      }
      router.refresh()
    } catch {
      setError('Грешка при връзка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {/* DEPT_HEAD: submit draft/returned */}
          {isOwner && (status === 'DRAFT' || status === 'RETURNED') && (
            <Button onClick={() => doAction('submit')} disabled={loading}>
              Изпрати към управител
            </Button>
          )}

          {/* MANAGER: confirm submitted */}
          {userRole === 'MANAGER' && status === 'SUBMITTED' && (
            <>
              <Button onClick={() => doAction('confirm', { manager_comment: comment || null })} disabled={loading}>
                Потвърди
              </Button>
              <Button variant="destructive" onClick={() => setShowReturn(true)} disabled={loading}>
                Върни
              </Button>
            </>
          )}

          {/* CO: approve or return SENT_TO_CO */}
          {(userRole === 'ADMIN_CO' || userRole === 'FINANCE_CO') && status === 'SENT_TO_CO' && (
            <>
              <Button onClick={() => doAction('approve', { co_comment: comment || null })} disabled={loading}>
                Одобри
              </Button>
              <Button variant="destructive" onClick={() => setShowReturn(true)} disabled={loading}>
                Върни
              </Button>
            </>
          )}
        </div>

        {showReturn && (
          <div className="space-y-2">
            <Label>Коментар (задължителен при връщане)</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Причина за връщане..." />
            <Button variant="destructive"
              onClick={() => doAction('return', { comment })}
              disabled={loading || !comment.trim()}>
              Потвърди връщане
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Create the detail page**

```tsx
// app/(finance)/finance/daily-reports/[id]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
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
    .select(`
      *,
      departments(id, name),
      properties(id, name),
      daily_report_lines(*),
      pos_entries(*, pos_terminals(tid, bank, location)),
      z_reports(*)
    `)
    .eq('id', id)
    .single()

  if (!report) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Отчетът не е намерен.</p>
      </div>
    )
  }

  const isOwner = report.created_by_id === user.id

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <DailyReportView report={report} />
      <DailyReportActions
        reportId={report.id}
        status={report.status}
        userRole={user.role}
        isOwner={isOwner}
      />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/finance/DailyReportView.tsx components/finance/DailyReportActions.tsx app/(finance)/finance/daily-reports/
git commit -m "feat: add daily report detail page with view and workflow actions"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Verify all pages load without errors**

1. `/finance/daily-reports` — empty list page
2. `/finance/daily-reports/new` — form (requires DEPT_HEAD role + department access)
3. Create a test report and verify it appears in the list
4. Open the report detail page and verify view renders

- [ ] **Step 2: Verify workflow transitions**

1. DEPT_HEAD creates + submits report (DRAFT → SUBMITTED)
2. MANAGER confirms (SUBMITTED → CONFIRMED)
3. CO approves after consolidation sends to CO (SENT_TO_CO → APPROVED)
4. Test return flows (with mandatory comments)

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: daily report adjustments from e2e verification"
```
