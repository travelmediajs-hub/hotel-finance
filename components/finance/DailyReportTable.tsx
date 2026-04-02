'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Check, CornerDownLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { DailyReportStatus, UserRole } from '@/types/finance'
import { fmtDate } from '@/lib/utils'
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
    if (userRole === 'FINANCE_CO') return false
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
          // Recalc local nets and diffs
          updated.cash_net = updated.cash_income - updated.cash_refund
          updated.pos_net = updated.pos_income - updated.pos_refund
          updated.cash_diff = updated.cash_net - updated.z_cash
          updated.pos_diff = updated.pos_net - updated.pos_report_amount
          updated.total_diff = updated.cash_diff + updated.pos_diff
          return updated
        })
        // Recalc report totals
        const totalCashNet = newLines.reduce((s, l) => s + l.cash_net, 0)
        const totalPosNet = newLines.reduce((s, l) => s + l.pos_net, 0)
        const cashDiff = newLines.reduce((s, l) => s + l.cash_diff, 0)
        const posDiff = newLines.reduce((s, l) => s + l.pos_diff, 0)
        const totalDiff = newLines.reduce((s, l) => s + l.total_diff, 0)
        return {
          ...r,
          daily_report_lines: newLines,
          total_cash_net: totalCashNet,
          total_pos_net: totalPosNet,
          cash_diff: cashDiff,
          pos_diff: posDiff,
          total_diff: totalDiff,
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
    if (!confirm('Изпращане на отчета към ЦО?')) return
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
    if (!confirm('Одобряване на отчета?')) return
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
  const inputClass = 'h-8 w-full bg-transparent border-0 text-right tabular-nums font-mono text-xs px-1.5 py-0 focus:ring-1 focus:ring-primary rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

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
                  colSpan={8}
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
                  <th className={`${cellBase} ${cellPad}`}>Z каса</th>
                  <th className={`${cellBase} ${cellPad}`}>К разл</th>
                  <th className={`${cellBase} ${cellPad}`}>П+</th>
                  <th className={`${cellBase} ${cellPad}`}>П-</th>
                  <th className={`${cellBase} ${cellPad}`}>ПОС отч</th>
                  <th className={`${cellBase} ${cellPad}`}>П разл</th>
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
                    {fmtDate(report.date)}
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
                          <td className={`${cellBase} ${cellPad}`}>—</td>
                          <td className={`${cellBase} ${cellPad}`}>—</td>
                          <td className={`${cellBase} ${cellPad}`}>—</td>
                          <td className={`${cellBase} ${cellPad}`}>—</td>
                        </React.Fragment>
                      )
                    }

                    if (deptEditable) {
                      const cashFields = ['cash_income', 'cash_refund'] as const
                      const posFields = ['pos_income', 'pos_refund'] as const
                      return (
                        <React.Fragment key={dept.id}>
                          {cashFields.map((field) => (
                            <td key={field} className="border border-zinc-800 p-0">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={Number(line[field]) || ''}
                                onChange={(e) => {
                                  updateLocalLine(report.id, dept.id, field, parseFloat(e.target.value) || 0)
                                }}
                                onBlur={() => handleCellBlur(report.id, dept.id)}
                                className={inputClass}
                              />
                            </td>
                          ))}
                          <td className="border border-zinc-800 p-0">
                            <input
                              type="number"
                              step="0.01"
                              value={Number(line.z_cash) || ''}
                              onChange={(e) => {
                                updateLocalLine(report.id, dept.id, 'z_cash', parseFloat(e.target.value) || 0)
                              }}
                              onBlur={() => handleCellBlur(report.id, dept.id)}
                              className={inputClass}
                            />
                          </td>
                          <td className={`${cellBase} ${cellPad} ${diffColor(Number(line.cash_diff))}`}>
                            {fmt(Number(line.cash_diff))}
                          </td>
                          {posFields.map((field) => (
                            <td key={field} className="border border-zinc-800 p-0">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={Number(line[field]) || ''}
                                onChange={(e) => {
                                  updateLocalLine(report.id, dept.id, field, parseFloat(e.target.value) || 0)
                                }}
                                onBlur={() => handleCellBlur(report.id, dept.id)}
                                className={inputClass}
                              />
                            </td>
                          ))}
                          <td className="border border-zinc-800 p-0">
                            <input
                              type="number"
                              step="0.01"
                              value={Number(line.pos_report_amount) || ''}
                              onChange={(e) => {
                                updateLocalLine(report.id, dept.id, 'pos_report_amount', parseFloat(e.target.value) || 0)
                              }}
                              onBlur={() => handleCellBlur(report.id, dept.id)}
                              className={inputClass}
                            />
                          </td>
                          <td className={`${cellBase} ${cellPad} ${diffColor(Number(line.pos_diff))}`}>
                            {fmt(Number(line.pos_diff))}
                          </td>
                        </React.Fragment>
                      )
                    }

                    // Read-only
                    return (
                      <React.Fragment key={dept.id}>
                        <td className={`${cellBase} ${cellPad}`}>{fmt(Number(line.cash_income))}</td>
                        <td className={`${cellBase} ${cellPad}`}>{fmt(Number(line.cash_refund))}</td>
                        <td className={`${cellBase} ${cellPad}`}>{fmt(Number(line.z_cash))}</td>
                        <td className={`${cellBase} ${cellPad} ${diffColor(Number(line.cash_diff))}`}>{fmt(Number(line.cash_diff))}</td>
                        <td className={`${cellBase} ${cellPad}`}>{fmt(Number(line.pos_income))}</td>
                        <td className={`${cellBase} ${cellPad}`}>{fmt(Number(line.pos_refund))}</td>
                        <td className={`${cellBase} ${cellPad}`}>{fmt(Number(line.pos_report_amount))}</td>
                        <td className={`${cellBase} ${cellPad} ${diffColor(Number(line.pos_diff))}`}>{fmt(Number(line.pos_diff))}</td>
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
