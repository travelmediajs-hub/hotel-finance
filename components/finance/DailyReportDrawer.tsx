'use client'

import React, { useState, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fmtDate } from '@/lib/utils'
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
          cash_income: l.z_cash,
          pos_income: l.pos_report_amount,
          z_cash: l.z_cash,
          z_pos: l.z_pos,
          z_attachment_url: l.z_attachment_url || null,
          pos_report_amount: l.pos_report_amount,
        })),
        diff_explanation: hasDiff ? (diffExplanation || null) : null,
        general_attachment_url: generalAttachment || null,
      })
    } catch {
      setError('Грешка при запис')
    } finally {
      setLoading(false)
    }
  }

  const totalCashDiff = lines.reduce((s, l) => s + l.cash_diff, 0)
  const totalPosDiff = lines.reduce((s, l) => s + l.pos_diff, 0)
  const totalDiff = totalCashDiff + totalPosDiff
  const hasDiff = Math.abs(totalDiff) > 0.005

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        {!report ? (
          <SheetHeader>
            <SheetTitle>Зареждане...</SheetTitle>
            <SheetDescription />
          </SheetHeader>
        ) : (<>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {fmtDate(report.date)}
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
          {departments.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Z-отчет</h3>
              {departments.map((dept) => {
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
                      <Label className="text-xs">Z-файл (незадължителен)</Label>
                      <Input
                        placeholder="линк към файл..."
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
          {canEdit && hasDiff && (
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
                placeholder="линк към файл..."
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
        </>)}
      </SheetContent>
    </Sheet>
  )
}
