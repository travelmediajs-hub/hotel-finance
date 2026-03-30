'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Department {
  id: string
  name: string
}

interface POSTerminal {
  id: string
  tid: string
  bank: string
}

interface DayData {
  date: string
  day: number
  cash_by_department: Record<string, number>
  reversal_total: number
  cash_total: number
  collected_amount: number
  collected_by: string | null
  cash_difference: number
  pos_by_terminal: Record<string, number>
  pos_reversal_total: number
  pos_total: number
  pos_difference: number
}

interface Totals {
  cash_by_department: Record<string, number>
  reversal_total: number
  cash_total: number
  collected_total: number
  cash_difference_total: number
  pos_by_terminal: Record<string, number>
  pos_reversal_total: number
  pos_total: number
}

interface MonthlyReportData {
  property_id: string
  year: number
  month: number
  departments: Department[]
  pos_terminals: POSTerminal[]
  days: DayData[]
  totals: Totals
}

interface Props {
  properties: { id: string; name: string }[]
  defaultPropertyId?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toFixed(2)
}

function diffClass(v: number): string {
  if (v === 0) return 'text-green-500'
  if (v > 0) return 'text-amber-500'
  return 'text-red-500'
}

function noDiffClass(): string {
  return 'text-muted-foreground'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MonthlyReportView({ properties, defaultPropertyId }: Props) {
  const now = new Date()

  const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId ?? '')
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()))
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1))
  const [data, setData] = useState<MonthlyReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  async function handleLoad() {
    if (!selectedPropertyId || !selectedYear || !selectedMonth) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/finance/monthly-report?property_id=${selectedPropertyId}&year=${selectedYear}&month=${selectedMonth}`
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message ?? body.error ?? 'Грешка при зареждане на отчета')
        setData(null)
      } else {
        const json = await res.json()
        setData(json)
      }
    } catch {
      setError('Грешка при връзка със сървъра')
      setData(null)
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  const hasDepts = data && data.departments.length > 0
  const hasPOS = data && data.pos_terminals.length > 0

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 min-w-[180px]">
          <Label>Обект</Label>
          <Select value={selectedPropertyId} onValueChange={(v) => v && setSelectedPropertyId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Изберете обект" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 w-24">
          <Label>Година</Label>
          <Input
            type="number"
            min={2020}
            max={2099}
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          />
        </div>

        <div className="space-y-1 min-w-[140px]">
          <Label>Месец</Label>
          <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Изберете месец" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleLoad} disabled={loading || !selectedPropertyId}>
          {loading ? 'Зареждане...' : 'Зареди'}
        </Button>
      </div>

      {/* ── Error ── */}
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {/* ── Empty / not yet loaded ── */}
      {!loaded && !loading && (
        <p className="text-sm text-muted-foreground py-4">
          Изберете обект и период, след това натиснете Зареди.
        </p>
      )}

      {loaded && !loading && data && data.days.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          Няма данни за избрания период.
        </p>
      )}

      {/* ── Section 1: Оборот в брой ── */}
      {data && data.days.length > 0 && (
        <>
          <div>
            <h3 className="text-sm font-semibold mt-6 mb-2">СЕКЦИЯ 1: ОБОРОТ В БРОЙ</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Ден</TableHead>
                    {hasDepts && data.departments.map((dept) => (
                      <TableHead key={dept.id} className="text-right">{dept.name}</TableHead>
                    ))}
                    <TableHead className="text-right">Сторно</TableHead>
                    <TableHead className="text-right font-semibold">Общо</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.days.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-mono text-sm">{day.day}</TableCell>
                      {hasDepts && data.departments.map((dept) => (
                        <TableCell key={dept.id} className="text-right font-mono text-sm text-muted-foreground">
                          {fmt(day.cash_by_department[dept.id] ?? 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {fmt(day.reversal_total)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {fmt(day.cash_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="border-t-2">
                    <TableCell className="font-semibold text-sm">ОБЩО</TableCell>
                    {hasDepts && data.departments.map((dept) => (
                      <TableCell key={dept.id} className="text-right font-mono text-sm font-semibold">
                        {fmt(data.totals.cash_by_department[dept.id] ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {fmt(data.totals.reversal_total)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {fmt(data.totals.cash_total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Section 2: Събиране на наличност ── */}
          <div>
            <h3 className="text-sm font-semibold mt-6 mb-2">СЕКЦИЯ 2: СЪБИРАНЕ НА НАЛИЧНОСТ</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Ден</TableHead>
                    <TableHead className="text-right">Събрани (€)</TableHead>
                    <TableHead>Събрал</TableHead>
                    <TableHead className="text-right">Разлика</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.days.map((day) => {
                    const hasCollection = day.collected_by !== null
                    return (
                      <TableRow key={day.date}>
                        <TableCell className="font-mono text-sm">{day.day}</TableCell>
                        <TableCell className={`text-right font-mono text-sm ${hasCollection ? '' : noDiffClass()}`}>
                          {fmt(day.collected_amount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {day.collected_by ?? '—'}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm ${hasCollection ? diffClass(day.cash_difference) : noDiffClass()}`}>
                          {fmt(day.cash_difference)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {/* Totals row */}
                  <TableRow className="border-t-2">
                    <TableCell className="font-semibold text-sm">ОБЩО</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {fmt(data.totals.collected_total)}
                    </TableCell>
                    <TableCell />
                    <TableCell className={`text-right font-mono text-sm font-semibold ${diffClass(data.totals.cash_difference_total)}`}>
                      {fmt(data.totals.cash_difference_total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Section 3: Оборот по POS ── */}
          {hasPOS && (
            <div>
              <h3 className="text-sm font-semibold mt-6 mb-2">СЕКЦИЯ 3: ОБОРОТ ПО POS</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Ден</TableHead>
                      {data.pos_terminals.map((term) => (
                        <TableHead key={term.id} className="text-right">
                          {term.tid} ({term.bank})
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Сторно</TableHead>
                      <TableHead className="text-right font-semibold">Общо</TableHead>
                      <TableHead className="text-right">Разлика</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.days.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell className="font-mono text-sm">{day.day}</TableCell>
                        {data.pos_terminals.map((term) => (
                          <TableCell key={term.id} className="text-right font-mono text-sm text-muted-foreground">
                            {fmt(day.pos_by_terminal[term.id] ?? 0)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {fmt(day.pos_reversal_total)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {fmt(day.pos_total)}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm ${diffClass(day.pos_difference)}`}>
                          {fmt(day.pos_difference)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold text-sm">ОБЩО</TableCell>
                      {data.pos_terminals.map((term) => (
                        <TableCell key={term.id} className="text-right font-mono text-sm font-semibold">
                          {fmt(data.totals.pos_by_terminal[term.id] ?? 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {fmt(data.totals.pos_reversal_total)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {fmt(data.totals.pos_total)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
