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
