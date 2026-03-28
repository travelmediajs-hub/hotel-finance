'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

  function numCell(deptId: string, field: keyof LineData, value: number, disabled: boolean) {
    return (
      <td className="px-1 py-1">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={value || ''}
          disabled={disabled}
          onChange={(e) => updateLine(deptId, field, parseFloat(e.target.value) || 0)}
          className="h-7 text-sm w-24 tabular-nums"
        />
      </td>
    )
  }

  function roCell(value: number, colorize = false) {
    return (
      <td className={`px-2 py-1 text-right text-sm tabular-nums font-mono ${colorize ? diffColor(value) : ''}`}>
        {fmt(value)}
      </td>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {/* Main spreadsheet table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Приходи — {propertyName}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-900/50">
                <th className="text-left px-3 py-2 font-medium sticky left-0 bg-zinc-900/50 z-10">Отдел</th>
                <th className="text-center px-1 py-2 font-medium" colSpan={3}>Каса</th>
                <th className="text-center px-1 py-2 font-medium border-l border-zinc-800" colSpan={3}>ПОС</th>
                <th className="text-center px-1 py-2 font-medium border-l border-zinc-800" colSpan={2}>Z-отчет</th>
                <th className="text-center px-1 py-2 font-medium border-l border-zinc-800">ПОС отч.</th>
                <th className="text-center px-1 py-2 font-medium border-l border-zinc-800" colSpan={3}>Разлики</th>
              </tr>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left px-3 py-1 sticky left-0 bg-zinc-950 z-10" />
                <th className="text-right px-1 py-1">Приход</th>
                <th className="text-right px-1 py-1">Сторно</th>
                <th className="text-right px-1 py-1">Нето</th>
                <th className="text-right px-1 py-1 border-l border-zinc-800">Приход</th>
                <th className="text-right px-1 py-1">Сторно</th>
                <th className="text-right px-1 py-1">Нето</th>
                <th className="text-right px-1 py-1 border-l border-zinc-800">Каса</th>
                <th className="text-right px-1 py-1">ПОС</th>
                <th className="text-right px-1 py-1 border-l border-zinc-800">Банка</th>
                <th className="text-right px-1 py-1 border-l border-zinc-800">Каса</th>
                <th className="text-right px-1 py-1">ПОС</th>
                <th className="text-right px-1 py-1">Общо</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const editable = canEditLine(line.department_id)
                const cashNet = line.cash_income - line.cash_refund
                const posNet = line.pos_income - line.pos_refund
                const cashDiff = cashNet - line.z_cash
                const posDiff = posNet - line.pos_report_amount
                const lineDiff = cashDiff + posDiff

                return (
                  <tr key={line.department_id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                    <td className="px-3 py-1 font-medium whitespace-nowrap sticky left-0 bg-zinc-950 z-10">
                      {line.department_name}
                    </td>
                    {numCell(line.department_id, 'cash_income', line.cash_income, !editable)}
                    {numCell(line.department_id, 'cash_refund', line.cash_refund, !editable)}
                    {roCell(cashNet)}
                    {numCell(line.department_id, 'pos_income', line.pos_income, !editable)}
                    {numCell(line.department_id, 'pos_refund', line.pos_refund, !editable)}
                    {roCell(posNet)}
                    {numCell(line.department_id, 'z_cash', line.z_cash, !editable)}
                    {numCell(line.department_id, 'z_pos', line.z_pos, !editable)}
                    {numCell(line.department_id, 'pos_report_amount', line.pos_report_amount, !editable)}
                    {roCell(cashDiff, true)}
                    {roCell(posDiff, true)}
                    {roCell(lineDiff, true)}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700 font-medium">
                <td className="px-3 py-2 sticky left-0 bg-zinc-950 z-10">Общо</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s, l) => s + l.cash_income, 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s, l) => s + l.cash_refund, 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(totalCashNet)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s, l) => s + l.pos_income, 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s, l) => s + l.pos_refund, 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(totalPosNet)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s, l) => s + l.z_cash, 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s, l) => s + l.z_pos, 0))}</td>
                <td className="px-2 py-2 text-right tabular-nums font-mono">{fmt(lines.reduce((s, l) => s + l.pos_report_amount, 0))}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-mono ${diffColor(totalCashDiff)}`}>{fmt(totalCashDiff)}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-mono ${diffColor(totalPosDiff)}`}>{fmt(totalPosDiff)}</td>
                <td className={`px-2 py-2 text-right tabular-nums font-mono font-bold ${diffColor(totalDiff)}`}>{fmt(totalDiff)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Z-report attachments */}
      {lines.some((l) => l.has_fiscal) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Z-отчет файлове</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lines.filter((l) => l.has_fiscal).map((line) => (
                <div key={line.department_id} className="flex items-center gap-3">
                  <Label className="w-32 text-sm">{line.department_name}</Label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={line.z_attachment_url}
                    disabled={!canEditLine(line.department_id)}
                    onChange={(e) => updateLine(line.department_id, 'z_attachment_url', e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diff explanation + general attachment */}
      {canEdit && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {totalDiff !== 0 && (
              <div className="space-y-2">
                <Label>Обяснение за разликата *</Label>
                <Textarea
                  value={diffExplanation}
                  onChange={(e) => setDiffExplanation(e.target.value)}
                  placeholder="Опишете причината за разликата..."
                  rows={3}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Общ прикачен файл (незадължителен)</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={generalAttachment}
                onChange={(e) => setGeneralAttachment(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

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
