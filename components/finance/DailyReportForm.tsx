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

interface POSLine {
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

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function DailyReportForm({ department, property_id, departments, posTerminals }: Props) {
  const router = useRouter()

  const today = toDateString(new Date())
  const yesterday = toDateString(new Date(Date.now() - 86_400_000))

  const [date, setDate] = useState(today)
  const [cashLines, setCashLines] = useState<CashLine[]>(
    departments.map((d) => ({
      department_id: d.id,
      department_name: d.name,
      cash_income: 0,
      cash_return: 0,
    }))
  )
  const [posLines, setPosLines] = useState<POSLine[]>(
    posTerminals.map((t) => ({
      pos_terminal_id: t.id,
      terminal_label: `${t.tid} (${t.bank})`,
      amount: 0,
      return_amount: 0,
    }))
  )
  const [zCash, setZCash] = useState(0)
  const [zPos, setZPos] = useState(0)
  const [zAttachment, setZAttachment] = useState('')
  const [diffExplanation, setDiffExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculated values
  const totalCashNet = cashLines.reduce((s, l) => s + l.cash_income - l.cash_return, 0)
  const totalPOSNet = posLines.reduce((s, l) => s + l.amount - l.return_amount, 0)
  const cashDiff = totalCashNet - zCash
  const posDiff = totalPOSNet - zPos
  const totalDiff = cashDiff + posDiff

  function updateCashLine(index: number, field: 'cash_income' | 'cash_return', value: number) {
    setCashLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  function updatePosLine(index: number, field: 'amount' | 'return_amount', value: number) {
    setPosLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  function formatNum(n: number): string {
    return n.toFixed(2)
  }

  async function handleSave(isDraft: boolean) {
    setError(null)
    setLoading(true)

    const body = {
      department_id: department.id,
      property_id,
      date,
      lines: cashLines.map((l) => ({
        department_id: l.department_id,
        cash_income: l.cash_income,
        cash_return: l.cash_return,
      })),
      pos_entries: posLines.map((l) => ({
        pos_terminal_id: l.pos_terminal_id,
        amount: l.amount,
        return_amount: l.return_amount,
      })),
      z_report: {
        cash_amount: zCash,
        pos_amount: zPos,
        attachment_url: zAttachment,
      },
      diff_explanation: totalDiff !== 0 ? diffExplanation || null : null,
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
        return
      }

      const saved = await res.json()

      if (!isDraft) {
        const submitRes = await fetch(`/api/finance/daily-reports/${saved.id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!submitRes.ok) {
          const submitData = await submitRes.json()
          setError(submitData.message ?? submitData.error ?? 'Грешка при изпращане')
          // Report was saved but not submitted -- redirect to it anyway
          router.push(`/finance/daily-reports/${saved.id}`)
          return
        }
      }

      router.push(`/finance/daily-reports/${saved.id}`)
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const diffColor = (v: number) => (v !== 0 ? 'text-red-500' : 'text-green-500')

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {/* А. Отдел и дата */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Отдел и дата</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department_name">Отдел</Label>
              <Input id="department_name" value={department.name} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report_date">Дата *</Label>
              <Input
                id="report_date"
                type="date"
                value={date}
                min={yesterday}
                max={today}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Б. Приходи в брой */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Б. Приходи в брой</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_120px_120px_100px] gap-2 text-sm">
            <div className="font-medium">Отдел</div>
            <div className="font-medium">Приход</div>
            <div className="font-medium">Сторно</div>
            <div className="font-medium">Нето</div>

            {cashLines.map((line, i) => (
              <div key={line.department_id} className="contents">
                <div className="flex items-center">{line.department_name}</div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.cash_income || ''}
                  onChange={(e) => updateCashLine(i, 'cash_income', parseFloat(e.target.value) || 0)}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.cash_return || ''}
                  onChange={(e) => updateCashLine(i, 'cash_return', parseFloat(e.target.value) || 0)}
                />
                <div className="flex items-center justify-end">
                  {formatNum(line.cash_income - line.cash_return)}
                </div>
              </div>
            ))}

            <Separator className="col-span-4 my-1" />

            <div className="font-medium">Общо каса</div>
            <div />
            <div />
            <div className="flex items-center justify-end font-medium">
              {formatNum(totalCashNet)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* В. Приходи по POS терминали */}
      {posLines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">В. Приходи по POS терминали</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_120px_120px_100px] gap-2 text-sm">
              <div className="font-medium">Терминал</div>
              <div className="font-medium">Сума</div>
              <div className="font-medium">Сторно</div>
              <div className="font-medium">Нето</div>

              {posLines.map((line, i) => (
                <div key={line.pos_terminal_id} className="contents">
                  <div className="flex items-center">{line.terminal_label}</div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.amount || ''}
                    onChange={(e) => updatePosLine(i, 'amount', parseFloat(e.target.value) || 0)}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.return_amount || ''}
                    onChange={(e) => updatePosLine(i, 'return_amount', parseFloat(e.target.value) || 0)}
                  />
                  <div className="flex items-center justify-end">
                    {formatNum(line.amount - line.return_amount)}
                  </div>
                </div>
              ))}

              <Separator className="col-span-4 my-1" />

              <div className="font-medium">Общо POS</div>
              <div />
              <div />
              <div className="flex items-center justify-end font-medium">
                {formatNum(totalPOSNet)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Г. Фискален Z-отчет */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Г. Фискален Z-отчет</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="z_cash">Каса от Z</Label>
              <Input
                id="z_cash"
                type="number"
                min={0}
                step="0.01"
                value={zCash || ''}
                onChange={(e) => setZCash(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="z_pos">POS от Z</Label>
              <Input
                id="z_pos"
                type="number"
                min={0}
                step="0.01"
                value={zPos || ''}
                onChange={(e) => setZPos(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="z_total">Общо Z</Label>
              <Input id="z_total" value={formatNum(zCash + zPos)} disabled />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="z_attachment">URL на прикачен Z-отчет *</Label>
            <Input
              id="z_attachment"
              type="url"
              placeholder="https://..."
              value={zAttachment}
              onChange={(e) => setZAttachment(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Д. Разлики */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Д. Разлики</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Разлика каса</div>
              <div className={`text-lg font-medium ${diffColor(cashDiff)}`}>
                {formatNum(cashDiff)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Разлика POS</div>
              <div className={`text-lg font-medium ${diffColor(posDiff)}`}>
                {formatNum(posDiff)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Обща разлика</div>
              <div className={`text-lg font-medium ${diffColor(totalDiff)}`}>
                {formatNum(totalDiff)}
              </div>
            </div>
          </div>

          {totalDiff !== 0 && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="diff_explanation">Обяснение за разликата *</Label>
              <Textarea
                id="diff_explanation"
                value={diffExplanation}
                onChange={(e) => setDiffExplanation(e.target.value)}
                placeholder="Опишете причината за разликата..."
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Бутони */}
      <div className="flex gap-3">
        <Button disabled={loading} onClick={() => handleSave(false)}>
          {loading ? 'Запис...' : 'Изпрати отчет'}
        </Button>
        <Button variant="outline" disabled={loading} onClick={() => handleSave(true)}>
          {loading ? 'Запис...' : 'Запази чернова'}
        </Button>
        <Button variant="ghost" type="button" onClick={() => router.back()}>
          Отказ
        </Button>
      </div>
    </div>
  )
}
