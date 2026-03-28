# Daily Reports Excel-Style UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace multi-page daily report UI with a single-page Excel-like spreadsheet with inline editing and a right-side drawer for extended fields.

**Architecture:** One page (`/finance/daily-reports`) with a full-width editable table (dates as rows, departments as grouped columns). A Sheet drawer slides in from the right for Z-report, POS report, and diff-related fields. Actions (submit, approve, return) are icon buttons in the last table column. No separate detail/form/view pages.

**Tech Stack:** Next.js 16 App Router, React state management, shadcn/ui Sheet component, Supabase client, native HTML `<table>` for Excel-like grid.

---

### Task 1: DailyReportDrawer component

The right-side drawer showing extended fields (Z-report, POS report, diffs, attachments) for a single report.

**Files:**
- Create: `components/finance/DailyReportDrawer.tsx`

**Context:** This component uses shadcn Sheet (`components/ui/sheet.tsx`). The Sheet exports: `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`. SheetContent accepts `side="right"` and defaults to `sm:max-w-sm` width. The component will be controlled (open/onOpenChange) from the parent table.

**Types from `types/finance.ts`:**
```typescript
export type DailyReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED'

export interface DailyReportLine {
  id: string
  daily_report_id: string
  department_id: string
  cash_income: number
  cash_refund: number
  cash_net: number     // generated
  pos_income: number
  pos_refund: number
  pos_net: number      // generated
  z_cash: number
  z_pos: number
  z_attachment_url: string | null
  pos_report_amount: number
  cash_diff: number    // generated
  pos_diff: number     // generated
  total_diff: number   // generated
  filled_by_id: string | null
}
```

**API for saving lines** — `PATCH /api/finance/daily-reports/[id]/lines` with body:
```json
{
  "department_id": "uuid",
  "z_cash": 100.00,
  "z_pos": 50.00,
  "z_attachment_url": "https://...",
  "pos_report_amount": 150.00
}
```
The PATCH also accepts cash_income, cash_refund, pos_income, pos_refund but the drawer only sends the Z/POS fields. After PATCH, the API recalculates report totals automatically.

- [ ] **Step 1: Create the DailyReportDrawer component**

Create `components/finance/DailyReportDrawer.tsx`:

```tsx
'use client'

import React, { useState, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

export interface DrawerDepartment {
  id: string
  name: string
  has_fiscal: boolean
}

export interface DrawerLineData {
  department_id: string
  z_cash: number
  z_pos: number
  z_attachment_url: string
  pos_report_amount: number
  cash_diff: number
  pos_diff: number
  total_diff: number
}

export interface DrawerReportData {
  id: string
  date: string
  status: DailyReportStatus
  co_comment: string | null
  diff_explanation: string | null
  general_attachment_url: string | null
  cash_diff: number
  pos_diff: number
  total_diff: number
  lines: DrawerLineData[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: DrawerReportData | null
  departments: DrawerDepartment[]
  canEdit: boolean
  canEditDept: (deptId: string) => boolean
  onSave: (reportId: string, updates: {
    lines: Array<{
      department_id: string
      z_cash: number
      z_pos: number
      z_attachment_url: string | null
      pos_report_amount: number
    }>
    diff_explanation: string | null
    general_attachment_url: string | null
  }) => Promise<void>
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function diffColor(v: number): string {
  return v !== 0 ? 'text-red-500' : 'text-green-500'
}

export function DailyReportDrawer({
  open, onOpenChange, report, departments, canEdit, canEditDept, onSave,
}: Props) {
  const [lines, setLines] = useState<DrawerLineData[]>([])
  const [diffExplanation, setDiffExplanation] = useState('')
  const [generalAttachment, setGeneralAttachment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (report) {
      setLines(report.lines.map((l) => ({ ...l })))
      setDiffExplanation(report.diff_explanation ?? '')
      setGeneralAttachment(report.general_attachment_url ?? '')
      setError(null)
    }
  }, [report])

  if (!report) return null

  function updateLine(deptId: string, field: keyof DrawerLineData, value: number | string) {
    setLines((prev) =>
      prev.map((l) => (l.department_id === deptId ? { ...l, [field]: value } : l))
    )
  }

  async function handleSave() {
    setError(null)
    setLoading(true)
    try {
      await onSave(report!.id, {
        lines: lines.map((l) => ({
          department_id: l.department_id,
          z_cash: l.z_cash,
          z_pos: l.z_pos,
          z_attachment_url: l.z_attachment_url || null,
          pos_report_amount: l.pos_report_amount,
        })),
        diff_explanation: diffExplanation || null,
        general_attachment_url: generalAttachment || null,
      })
    } catch {
      setError('Грешка при запис')
    } finally {
      setLoading(false)
    }
  }

  const fiscalDepts = departments.filter((d) => d.has_fiscal)
  const totalCashDiff = lines.reduce((s, l) => s + l.cash_diff, 0)
  const totalPosDiff = lines.reduce((s, l) => s + l.pos_diff, 0)
  const totalDiff = totalCashDiff + totalPosDiff

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {report.date}
            <Badge variant={statusVariants[report.status]}>
              {statusLabels[report.status]}
            </Badge>
          </SheetTitle>
          <SheetDescription>Z-отчет, ПОС отчет и разлики</SheetDescription>
        </SheetHeader>

        <div className="px-4 space-y-6">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>
          )}

          {/* Z-report section */}
          {fiscalDepts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Z-отчет</h3>
              {fiscalDepts.map((dept) => {
                const line = lines.find((l) => l.department_id === dept.id)
                if (!line) return null
                const editable = canEdit && canEditDept(dept.id)
                return (
                  <div key={dept.id} className="space-y-2 border-b border-zinc-800 pb-3">
                    <p className="text-xs text-muted-foreground">{dept.name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Zк</Label>
                        <Input
                          type="number" step="0.01" min={0}
                          value={line.z_cash || ''}
                          disabled={!editable}
                          onChange={(e) => updateLine(dept.id, 'z_cash', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm tabular-nums"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Zп</Label>
                        <Input
                          type="number" step="0.01" min={0}
                          value={line.z_pos || ''}
                          disabled={!editable}
                          onChange={(e) => updateLine(dept.id, 'z_pos', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm tabular-nums"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Z-файл</Label>
                      <Input
                        type="url" placeholder="https://..."
                        value={line.z_attachment_url}
                        disabled={!editable}
                        onChange={(e) => updateLine(dept.id, 'z_attachment_url', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* POS bank report section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">ПОС банков отчет</h3>
            {departments.map((dept) => {
              const line = lines.find((l) => l.department_id === dept.id)
              if (!line) return null
              const editable = canEdit && canEditDept(dept.id)
              return (
                <div key={dept.id} className="flex items-center gap-2">
                  <Label className="text-xs w-24 shrink-0">{dept.name}</Label>
                  <Input
                    type="number" step="0.01" min={0}
                    value={line.pos_report_amount || ''}
                    disabled={!editable}
                    onChange={(e) => updateLine(dept.id, 'pos_report_amount', parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm tabular-nums"
                  />
                </div>
              )
            })}
          </div>

          {/* Diffs section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Разлики</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-1" />
                  <th className="text-right py-1 px-2">Каса</th>
                  <th className="text-right py-1 px-2">ПОС</th>
                  <th className="text-right py-1 px-2">Общо</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const dept = departments.find((d) => d.id === line.department_id)
                  return (
                    <tr key={line.department_id} className="border-b border-zinc-800/50">
                      <td className="py-1 text-muted-foreground">{dept?.name}</td>
                      <td className={`text-right py-1 px-2 tabular-nums font-mono ${diffColor(line.cash_diff)}`}>{fmt(line.cash_diff)}</td>
                      <td className={`text-right py-1 px-2 tabular-nums font-mono ${diffColor(line.pos_diff)}`}>{fmt(line.pos_diff)}</td>
                      <td className={`text-right py-1 px-2 tabular-nums font-mono ${diffColor(line.total_diff)}`}>{fmt(line.total_diff)}</td>
                    </tr>
                  )
                })}
                <tr className="border-t border-zinc-700 font-medium">
                  <td className="py-1">Общо</td>
                  <td className={`text-right py-1 px-2 tabular-nums font-mono ${diffColor(totalCashDiff)}`}>{fmt(totalCashDiff)}</td>
                  <td className={`text-right py-1 px-2 tabular-nums font-mono ${diffColor(totalPosDiff)}`}>{fmt(totalPosDiff)}</td>
                  <td className={`text-right py-1 px-2 tabular-nums font-mono ${diffColor(totalDiff)}`}>{fmt(totalDiff)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Extra fields */}
          {canEdit && totalDiff !== 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Обяснение за разликата *</Label>
              <Textarea
                value={diffExplanation}
                onChange={(e) => setDiffExplanation(e.target.value)}
                placeholder="Опишете причината за разликата..."
                rows={3}
              />
            </div>
          )}

          {!canEdit && report.diff_explanation && (
            <div className="text-sm">
              <span className="text-muted-foreground">Обяснение: </span>
              {report.diff_explanation}
            </div>
          )}

          {canEdit ? (
            <div className="space-y-2">
              <Label className="text-sm">Общ файл (незадължителен)</Label>
              <Input
                type="url" placeholder="https://..."
                value={generalAttachment}
                onChange={(e) => setGeneralAttachment(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ) : report.general_attachment_url ? (
            <div className="text-sm">
              <a href={report.general_attachment_url} target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline">Общ прикачен файл</a>
            </div>
          ) : null}

          {report.co_comment && (
            <div className="text-sm bg-destructive/10 rounded p-3">
              <span className="text-muted-foreground">Коментар от ЦО: </span>
              {report.co_comment}
            </div>
          )}
        </div>

        {canEdit && (
          <SheetFooter>
            <Button disabled={loading} onClick={handleSave} className="w-full">
              {loading ? 'Запис...' : 'Запази'}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep DailyReportDrawer`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/finance/DailyReportDrawer.tsx
git commit -m "feat: add DailyReportDrawer component for Z-report/POS details"
```

---

### Task 2: Rewrite DailyReportTable as Excel-like editable spreadsheet

The main component: dates as rows, departments as grouped columns, inline editing, auto-save on blur, action icons.

**Files:**
- Rewrite: `components/finance/DailyReportTable.tsx`

**Context:**
- The page passes `reports` (array of report objects with nested `daily_report_lines` and `departments`) and `departments` (active departments for this property).
- Each report has: `id`, `date`, `status`, `property_id`, `total_cash_net`, `total_pos_net`, `total_diff`, `co_comment`, `diff_explanation`, `general_attachment_url`, `cash_diff`, `pos_diff`.
- Each line has: `id`, `department_id`, `cash_income`, `cash_refund`, `pos_income`, `pos_refund`, `cash_net`, `pos_net`, `z_cash`, `z_pos`, `z_attachment_url`, `pos_report_amount`, `cash_diff`, `pos_diff`, `total_diff`, `filled_by_id`, and nested `departments: { id, name }`.
- Editable only when `status === 'DRAFT' || status === 'RETURNED'`.
- DEPT_HEAD can only edit their departments (passed via `userDepartmentIds`).
- Auto-save on blur: PATCH `/api/finance/daily-reports/{reportId}/lines` with `{ department_id, cash_income, cash_refund, pos_income, pos_refund }`.
- Action icons: submit (✉️), approve (✅), return (↩️) — each calls its respective API.
- Uses `DailyReportDrawer` from Task 1.

**API endpoints used:**
- `PATCH /api/finance/daily-reports/[id]/lines` — save cell edits (body includes `department_id` + changed numeric fields)
- `POST /api/finance/daily-reports/[id]/submit` — submit report (body: `{ diff_explanation?, general_attachment_url? }`)
- `POST /api/finance/daily-reports/[id]/approve` — approve report (optional body: `{ co_comment? }`)
- `POST /api/finance/daily-reports/[id]/return` — return report (body: `{ comment: string }`)
- `POST /api/finance/daily-reports` — create new report (body: `{ property_id, date }`)

- [ ] **Step 1: Rewrite DailyReportTable.tsx**

Replace entire contents of `components/finance/DailyReportTable.tsx` with:

```tsx
'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Check, CornerDownLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { DailyReportStatus, UserRole } from '@/types/finance'
import {
  DailyReportDrawer,
  type DrawerReportData,
  type DrawerDepartment,
  type DrawerLineData,
} from './DailyReportDrawer'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DeptInfo {
  id: string
  name: string
  fiscal_device_id: string | null
}

interface ReportLine {
  id: string
  department_id: string
  cash_income: number
  cash_refund: number
  cash_net: number
  pos_income: number
  pos_refund: number
  pos_net: number
  z_cash: number
  z_pos: number
  z_attachment_url: string | null
  pos_report_amount: number
  cash_diff: number
  pos_diff: number
  total_diff: number
  filled_by_id: string | null
  departments: { id: string; name: string }
}

interface Report {
  id: string
  date: string
  status: DailyReportStatus
  property_id: string
  total_cash_net: number
  total_pos_net: number
  total_diff: number
  cash_diff: number
  pos_diff: number
  co_comment: string | null
  diff_explanation: string | null
  general_attachment_url: string | null
  daily_report_lines: ReportLine[]
}

interface Props {
  reports: Report[]
  departments: DeptInfo[]
  userRole: UserRole
  userDepartmentIds?: string[]
  propertyId: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const statusIcons: Record<DailyReportStatus, string> = {
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number): string {
  return n === 0 ? '—' : n.toFixed(2)
}

function diffColor(v: number): string {
  return v !== 0 ? 'text-red-500' : 'text-green-500'
}

function isCO(role: UserRole): boolean {
  return role === 'ADMIN_CO' || role === 'FINANCE_CO'
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DailyReportTable({
  reports: initialReports,
  departments,
  userRole,
  userDepartmentIds,
  propertyId,
}: Props) {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [drawerReportId, setDrawerReportId] = useState<string | null>(null)
  const [returnReportId, setReturnReportId] = useState<string | null>(null)
  const [returnComment, setReturnComment] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [cellError, setCellError] = useState<string | null>(null)
  const pendingSaves = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Which report is selected for the drawer
  const drawerReport = reports.find((r) => r.id === drawerReportId) ?? null

  function canEditReport(status: DailyReportStatus): boolean {
    return status === 'DRAFT' || status === 'RETURNED'
  }

  function canEditDept(deptId: string): boolean {
    if (userRole === 'DEPT_HEAD' && userDepartmentIds) {
      return userDepartmentIds.includes(deptId)
    }
    return true
  }

  // ---- Cell save on blur ----

  function updateLocalLine(
    reportId: string,
    deptId: string,
    field: string,
    value: number,
  ) {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id !== reportId) return r
        const newLines = r.daily_report_lines.map((l) => {
          if (l.department_id !== deptId) return l
          const updated = { ...l, [field]: value }
          // Recalc local nets
          updated.cash_net = updated.cash_income - updated.cash_refund
          updated.pos_net = updated.pos_income - updated.pos_refund
          return updated
        })
        // Recalc report totals
        const totalCashNet = newLines.reduce((s, l) => s + l.cash_net, 0)
        const totalPosNet = newLines.reduce((s, l) => s + l.pos_net, 0)
        return {
          ...r,
          daily_report_lines: newLines,
          total_cash_net: totalCashNet,
          total_pos_net: totalPosNet,
        }
      })
    )
  }

  const saveLine = useCallback(async (reportId: string, line: ReportLine) => {
    try {
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
          z_attachment_url: line.z_attachment_url,
          pos_report_amount: line.pos_report_amount,
        }),
      })
      if (!res.ok) {
        setCellError('Грешка при запис')
        setTimeout(() => setCellError(null), 3000)
      } else {
        // Update with server response (includes recalculated diffs)
        const saved = await res.json()
        setReports((prev) =>
          prev.map((r) => {
            if (r.id !== reportId) return r
            return {
              ...r,
              daily_report_lines: r.daily_report_lines.map((l) =>
                l.department_id === saved.department_id
                  ? { ...l, ...saved, departments: l.departments }
                  : l
              ),
            }
          })
        )
        // Refresh to get updated report totals
        router.refresh()
      }
    } catch {
      setCellError('Грешка при връзка')
      setTimeout(() => setCellError(null), 3000)
    }
  }, [router])

  function handleCellBlur(reportId: string, deptId: string) {
    const report = reports.find((r) => r.id === reportId)
    if (!report) return
    const line = report.daily_report_lines.find((l) => l.department_id === deptId)
    if (!line) return

    // Debounce: cancel previous save for same line, schedule new one
    const key = `${reportId}-${deptId}`
    const existing = pendingSaves.current.get(key)
    if (existing) clearTimeout(existing)
    const timeout = setTimeout(() => {
      saveLine(reportId, line)
      pendingSaves.current.delete(key)
    }, 300)
    pendingSaves.current.set(key, timeout)
  }

  // ---- Actions ----

  async function handleSubmit(reportId: string) {
    const report = reports.find((r) => r.id === reportId)
    if (!report) return
    setActionLoading(reportId)
    try {
      const res = await fetch(`/api/finance/daily-reports/${reportId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diff_explanation: report.diff_explanation,
          general_attachment_url: report.general_attachment_url,
        }),
      })
      if (res.ok) {
        router.refresh()
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: 'SUBMITTED' as DailyReportStatus } : r))
        )
      } else {
        const data = await res.json()
        alert(data.message ?? 'Грешка при изпращане')
      }
    } catch {
      alert('Грешка при връзка')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleApprove(reportId: string) {
    setActionLoading(reportId)
    try {
      const res = await fetch(`/api/finance/daily-reports/${reportId}/approve`, {
        method: 'POST',
      })
      if (res.ok) {
        router.refresh()
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: 'APPROVED' as DailyReportStatus } : r))
        )
      } else {
        const data = await res.json()
        alert(data.message ?? 'Грешка при одобрение')
      }
    } catch {
      alert('Грешка при връзка')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReturn(reportId: string) {
    if (!returnComment.trim()) return
    setActionLoading(reportId)
    try {
      const res = await fetch(`/api/finance/daily-reports/${reportId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: returnComment.trim() }),
      })
      if (res.ok) {
        router.refresh()
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: 'RETURNED' as DailyReportStatus } : r))
        )
        setReturnReportId(null)
        setReturnComment('')
      } else {
        const data = await res.json()
        alert(data.message ?? 'Грешка при връщане')
      }
    } catch {
      alert('Грешка при връзка')
    } finally {
      setActionLoading(null)
    }
  }

  // ---- Drawer save handler ----

  async function handleDrawerSave(reportId: string, updates: {
    lines: Array<{
      department_id: string
      z_cash: number
      z_pos: number
      z_attachment_url: string | null
      pos_report_amount: number
    }>
    diff_explanation: string | null
    general_attachment_url: string | null
  }) {
    // Save each line
    for (const lineUpdate of updates.lines) {
      const report = reports.find((r) => r.id === reportId)
      const existingLine = report?.daily_report_lines.find(
        (l) => l.department_id === lineUpdate.department_id
      )
      if (!existingLine) continue

      const res = await fetch(`/api/finance/daily-reports/${reportId}/lines`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: lineUpdate.department_id,
          cash_income: existingLine.cash_income,
          cash_refund: existingLine.cash_refund,
          pos_income: existingLine.pos_income,
          pos_refund: existingLine.pos_refund,
          z_cash: lineUpdate.z_cash,
          z_pos: lineUpdate.z_pos,
          z_attachment_url: lineUpdate.z_attachment_url,
          pos_report_amount: lineUpdate.pos_report_amount,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
    }

    // Update diff_explanation and general_attachment_url on the report
    // These are sent when submitting, but we store them locally for now
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              diff_explanation: updates.diff_explanation,
              general_attachment_url: updates.general_attachment_url,
            }
          : r
      )
    )

    // Refresh to pick up recalculated totals from DB
    router.refresh()
  }

  // ---- Drawer data transform ----

  const drawerDepts: DrawerDepartment[] = departments.map((d) => ({
    id: d.id,
    name: d.name,
    has_fiscal: !!d.fiscal_device_id,
  }))

  const drawerData: DrawerReportData | null = drawerReport
    ? {
        id: drawerReport.id,
        date: drawerReport.date,
        status: drawerReport.status,
        co_comment: drawerReport.co_comment,
        diff_explanation: drawerReport.diff_explanation,
        general_attachment_url: drawerReport.general_attachment_url,
        cash_diff: drawerReport.cash_diff,
        pos_diff: drawerReport.pos_diff,
        total_diff: drawerReport.total_diff,
        lines: drawerReport.daily_report_lines.map((l) => ({
          department_id: l.department_id,
          z_cash: Number(l.z_cash),
          z_pos: Number(l.z_pos),
          z_attachment_url: l.z_attachment_url ?? '',
          pos_report_amount: Number(l.pos_report_amount),
          cash_diff: Number(l.cash_diff),
          pos_diff: Number(l.pos_diff),
          total_diff: Number(l.total_diff),
        })),
      }
    : null

  // ---- Render ----

  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма дневни отчети за този обект
      </p>
    )
  }

  // Cell styling: Excel-like, input fills the whole cell
  const cellBase = 'border border-zinc-800 text-right tabular-nums font-mono text-xs'
  const cellPad = 'px-1.5 py-0'
  const inputClass = 'h-8 w-full bg-transparent border-0 text-right tabular-nums font-mono text-xs px-1.5 py-0 focus:ring-1 focus:ring-primary rounded-none'

  return (
    <>
      {cellError && (
        <div className="text-xs text-destructive bg-destructive/10 px-3 py-1 rounded mb-2">
          {cellError}
        </div>
      )}

      {/* Return comment popover */}
      {returnReportId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="bg-popover border rounded-lg p-4 w-80 space-y-3">
            <p className="text-sm font-medium">Коментар за връщане</p>
            <Textarea
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              placeholder="Причина за връщане..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                size="sm" variant="destructive"
                disabled={!returnComment.trim() || actionLoading === returnReportId}
                onClick={() => handleReturn(returnReportId)}
              >
                Върни
              </Button>
              <Button
                size="sm" variant="ghost"
                onClick={() => { setReturnReportId(null); setReturnComment('') }}
              >
                Отказ
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs" style={{ minWidth: '100%' }}>
          <thead>
            {/* Row 1: Date + department group headers + summary + actions */}
            <tr className="bg-zinc-900/50">
              <th className="sticky left-0 z-10 bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-left font-medium w-24">
                Дата
              </th>
              {departments.map((dept) => (
                <th
                  key={dept.id}
                  colSpan={4}
                  className="border border-zinc-800 px-1 py-1.5 text-center font-medium"
                >
                  {dept.name}
                </th>
              ))}
              <th className="border border-zinc-800 px-1 py-1.5 text-center font-medium">Каса</th>
              <th className="border border-zinc-800 px-1 py-1.5 text-center font-medium">ПОС</th>
              <th className="border border-zinc-800 px-1 py-1.5 text-center font-medium">Разл.</th>
              <th className="border border-zinc-800 px-1 py-1.5 text-center font-medium w-8">Ст</th>
              <th className="border border-zinc-800 px-1 py-1.5 text-center font-medium w-16" />
            </tr>
            {/* Row 2: sub-column labels */}
            <tr className="bg-zinc-900/30 text-[10px] text-muted-foreground">
              <th className="sticky left-0 z-10 bg-zinc-950 border border-zinc-800" />
              {departments.map((dept) => (
                <React.Fragment key={dept.id}>
                  <th className={`${cellBase} ${cellPad}`}>К+</th>
                  <th className={`${cellBase} ${cellPad}`}>К-</th>
                  <th className={`${cellBase} ${cellPad}`}>П+</th>
                  <th className={`${cellBase} ${cellPad}`}>П-</th>
                </React.Fragment>
              ))}
              <th className={`${cellBase} ${cellPad}`}>нето</th>
              <th className={`${cellBase} ${cellPad}`}>нето</th>
              <th className={`${cellBase} ${cellPad}`} />
              <th className="border border-zinc-800" />
              <th className="border border-zinc-800" />
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const editable = canEditReport(report.status)
              const linesByDept = new Map(
                report.daily_report_lines.map((l) => [l.department_id, l])
              )
              const isLoading = actionLoading === report.id

              // Action icons logic
              const showSubmit =
                (report.status === 'DRAFT' || report.status === 'RETURNED') &&
                (userRole === 'MANAGER' || userRole === 'ADMIN_CO')
              const showApprove = report.status === 'SUBMITTED' && isCO(userRole)
              const showReturn = report.status === 'SUBMITTED' && isCO(userRole)

              return (
                <tr key={report.id} className="hover:bg-zinc-900/20">
                  {/* Date cell - sticky */}
                  <td className="sticky left-0 z-10 bg-zinc-950 border border-zinc-800 px-2 py-0 font-medium whitespace-nowrap text-xs">
                    {report.date}
                  </td>

                  {/* Department cells */}
                  {departments.map((dept) => {
                    const line = linesByDept.get(dept.id)
                    const deptEditable = editable && canEditDept(dept.id)

                    if (!line) {
                      return (
                        <React.Fragment key={dept.id}>
                          <td className={`${cellBase} ${cellPad}`}>—</td>
                          <td className={`${cellBase} ${cellPad}`}>—</td>
                          <td className={`${cellBase} ${cellPad}`}>—</td>
                          <td className={`${cellBase} ${cellPad}`}>—</td>
                        </React.Fragment>
                      )
                    }

                    if (deptEditable) {
                      const fields = ['cash_income', 'cash_refund', 'pos_income', 'pos_refund'] as const
                      return (
                        <React.Fragment key={dept.id}>
                          {fields.map((field) => (
                            <td key={field} className="border border-zinc-800 p-0">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={Number(line[field]) || ''}
                                onChange={(e) => {
                                  updateLocalLine(
                                    report.id,
                                    dept.id,
                                    field,
                                    parseFloat(e.target.value) || 0
                                  )
                                }}
                                onBlur={() => handleCellBlur(report.id, dept.id)}
                                className={inputClass}
                              />
                            </td>
                          ))}
                        </React.Fragment>
                      )
                    }

                    // Read-only
                    return (
                      <React.Fragment key={dept.id}>
                        <td className={`${cellBase} ${cellPad}`}>{fmt(Number(line.cash_income))}</td>
                        <td className={`${cellBase} ${cellPad}`}>{fmt(Number(line.cash_refund))}</td>
                        <td className={`${cellBase} ${cellPad}`}>{fmt(Number(line.pos_income))}</td>
                        <td className={`${cellBase} ${cellPad}`}>{fmt(Number(line.pos_refund))}</td>
                      </React.Fragment>
                    )
                  })}

                  {/* Summary cells */}
                  <td className={`${cellBase} ${cellPad} font-medium`}>
                    {fmt(Number(report.total_cash_net))}
                  </td>
                  <td className={`${cellBase} ${cellPad} font-medium`}>
                    {fmt(Number(report.total_pos_net))}
                  </td>
                  <td className={`${cellBase} ${cellPad} font-medium ${diffColor(Number(report.total_diff))}`}>
                    {fmt(Number(report.total_diff))}
                  </td>

                  {/* Status */}
                  <td className={`border border-zinc-800 text-center ${statusColors[report.status]}`}>
                    <span title={report.status}>{statusIcons[report.status]}</span>
                  </td>

                  {/* Actions + drawer toggle */}
                  <td className="border border-zinc-800 px-1 py-0">
                    <div className="flex items-center gap-0.5 justify-center">
                      {showSubmit && (
                        <button
                          title="Изпрати към ЦО"
                          disabled={isLoading}
                          onClick={() => handleSubmit(report.id)}
                          className="p-1 hover:bg-zinc-800 rounded disabled:opacity-50"
                        >
                          <Send className="h-3 w-3" />
                        </button>
                      )}
                      {showApprove && (
                        <button
                          title="Одобри"
                          disabled={isLoading}
                          onClick={() => handleApprove(report.id)}
                          className="p-1 hover:bg-zinc-800 rounded text-green-500 disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      {showReturn && (
                        <button
                          title="Върни"
                          disabled={isLoading}
                          onClick={() => setReturnReportId(report.id)}
                          className="p-1 hover:bg-zinc-800 rounded text-red-500 disabled:opacity-50"
                        >
                          <CornerDownLeft className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        title="Детайли"
                        onClick={() => setDrawerReportId(report.id)}
                        className="p-1 hover:bg-zinc-800 rounded text-muted-foreground"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <DailyReportDrawer
        open={!!drawerReportId}
        onOpenChange={(open) => { if (!open) setDrawerReportId(null) }}
        report={drawerData}
        departments={drawerDepts}
        canEdit={drawerReport ? canEditReport(drawerReport.status) : false}
        canEditDept={canEditDept}
        onSave={handleDrawerSave}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep DailyReportTable`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/finance/DailyReportTable.tsx
git commit -m "feat: rewrite DailyReportTable as Excel-like editable spreadsheet"
```

---

### Task 3: Rewrite the daily-reports page and remove old files

Update the page to pass the new props and remove deleted pages/components.

**Files:**
- Rewrite: `app/(finance)/finance/daily-reports/page.tsx`
- Delete: `app/(finance)/finance/daily-reports/[id]/page.tsx`
- Delete: `app/(finance)/finance/daily-reports/new/page.tsx`
- Delete: `components/finance/DailyReportForm.tsx`
- Delete: `components/finance/DailyReportView.tsx`
- Delete: `components/finance/DailyReportActions.tsx`

**Context:**
- The page is a server component that fetches data and renders `DailyReportTable`.
- `DailyReportTable` now needs: `reports`, `departments` (with `fiscal_device_id`), `userRole`, `userDepartmentIds` (for DEPT_HEAD), `propertyId`.
- The "Нов отчет" button becomes a client action calling POST `/api/finance/daily-reports`.
- Property tabs remain as Link elements with `property_id` query param.

- [ ] **Step 1: Rewrite page.tsx**

Replace entire contents of `app/(finance)/finance/daily-reports/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole, getUserPropertyIds } from '@/lib/finance/auth'
import { DailyReportTable } from '@/components/finance/DailyReportTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NewReportButton } from '@/components/finance/NewReportButton'

interface Props {
  searchParams: Promise<{ property_id?: string }>
}

export default async function DailyReportsPage({ searchParams }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const params = await searchParams

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
      <div className="p-6">
        <p className="text-muted-foreground text-sm">Няма достъпни обекти.</p>
      </div>
    )
  }

  const { data: departments } = await supabase
    .from('departments')
    .select('id, name, fiscal_device_id')
    .eq('property_id', selectedPropertyId)
    .eq('status', 'ACTIVE')
    .order('name')

  const { data: reports } = await supabase
    .from('daily_reports')
    .select('*, daily_report_lines(*, departments(id, name))')
    .eq('property_id', selectedPropertyId)
    .order('date', { ascending: false })
    .limit(60)

  let userDepartmentIds: string[] | undefined
  if (user.role === 'DEPT_HEAD') {
    const { data: access } = await supabase
      .from('user_department_access')
      .select('department_id')
      .eq('user_id', user.id)
    userDepartmentIds = (access ?? []).map((a) => a.department_id)
  }

  const canCreate = user.role === 'MANAGER' || user.role === 'ADMIN_CO' || user.role === 'DEPT_HEAD'

  return (
    <div className="p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg">Дневни отчети</CardTitle>
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
            <NewReportButton propertyId={selectedPropertyId} />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <DailyReportTable
            reports={(reports as any[]) ?? []}
            departments={(departments as any[]) ?? []}
            userRole={user.role}
            userDepartmentIds={userDepartmentIds}
            propertyId={selectedPropertyId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create NewReportButton client component**

Create `components/finance/NewReportButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  propertyId: string
}

export function NewReportButton({ propertyId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch('/api/finance/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, date: today }),
      })

      if (res.status === 409) {
        alert('Вече съществува отчет за днес')
        return
      }

      if (!res.ok) {
        const data = await res.json()
        alert(data.message ?? 'Грешка при създаване')
        return
      }

      router.refresh()
    } catch {
      alert('Грешка при връзка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" disabled={loading} onClick={handleCreate}>
      <Plus className="h-3.5 w-3.5 mr-1" />
      {loading ? 'Създаване...' : 'Нов отчет'}
    </Button>
  )
}
```

- [ ] **Step 3: Delete old files**

```bash
rm -f components/finance/DailyReportForm.tsx
rm -f components/finance/DailyReportView.tsx
rm -f components/finance/DailyReportActions.tsx
rm -rf app/\(finance\)/finance/daily-reports/\[id\]
rm -rf app/\(finance\)/finance/daily-reports/new
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "(daily-reports|DailyReport)" | head -20`
Expected: no errors from these files

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: single-page daily reports with inline editing and drawer

- Rewrite page.tsx to pass new props to DailyReportTable
- Add NewReportButton client component
- Delete DailyReportForm, DailyReportView, DailyReportActions
- Delete [id]/page.tsx and new/page.tsx detail pages"
```

---

### Task 4: Verify full build and fix any remaining issues

- [ ] **Step 1: Check for any remaining imports of deleted files**

Run: `grep -r "DailyReportForm\|DailyReportView\|DailyReportActions" --include="*.tsx" --include="*.ts" app/ components/ lib/`

Expected: no matches. If any remain, update those imports.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: no new errors from daily report files.

- [ ] **Step 3: Run lint**

Run: `npm run lint 2>&1 | head -30`

Fix any lint errors in the new files.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build issues in daily reports Excel UI"
```
