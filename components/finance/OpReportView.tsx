'use client'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { OpReportMatrix, OpReportViewMode, OpReportVatMode } from '@/types/finance'

interface Props {
  propertyId: string
  year: number
}

const MONTH_LABELS = ['', 'Яну','Фев','Мар','Апр','Май','Юни','Юли','Авг','Сеп','Окт','Ное','Дек']

function fmtNumber(value: number | null, format: 'NUMBER' | 'PERCENT' | 'CURRENCY'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  if (format === 'PERCENT') return `${value.toFixed(1)}%`
  return value.toLocaleString('bg-BG', { maximumFractionDigits: 2 })
}

function varianceClass(variancePct: number | null, rowType: string): string {
  if (variancePct === null) return ''
  const isExpense = rowType === 'EXPENSE' || rowType === 'PAYROLL' || rowType === 'RENT'
  const exceeded = isExpense ? variancePct > 0 : variancePct < 0
  const abs = Math.abs(variancePct)
  if (abs < 5) return ''
  if (abs < 20) return exceeded ? 'text-red-600' : 'text-green-600'
  return exceeded ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'
}

export function OpReportView({ propertyId, year }: Props) {
  const [vatMode, setVatMode] = useState<OpReportVatMode>('net')
  const [view, setView] = useState<OpReportViewMode>('variance')
  const [matrix, setMatrix] = useState<OpReportMatrix | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let abort = false
    async function load() {
      setLoading(true)
      const m = await fetch(`/api/finance/opreport/report?property_id=${propertyId}&year=${year}&vat_mode=${vatMode}`).then(r => r.json())
      if (!abort) { setMatrix(m); setLoading(false) }
    }
    load()
    return () => { abort = true }
  }, [propertyId, year, vatMode])

  const months = useMemo(() => matrix?.operating_months.slice().sort((a, b) => a - b) ?? [], [matrix])

  const download = (fmt: 'xlsx' | 'print') => {
    if (fmt === 'xlsx') {
      const url = `/api/finance/opreport/export/xlsx?property_id=${propertyId}&year=${year}&view=${view}&vat_mode=${vatMode}`
      window.location.href = url
    } else {
      const url = `/finance/usali-reports/opreport/print?property_id=${propertyId}&year=${year}&vat_mode=${vatMode}`
      window.open(url, '_blank')
    }
  }

  if (loading || !matrix) return <div className="text-xs text-muted-foreground p-4">Зареждане...</div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1 border rounded px-2 py-1 text-xs">
          <label>ДДС:</label>
          <button onClick={() => setVatMode('net')} className={cn('px-2 py-0.5 rounded', vatMode === 'net' && 'bg-primary text-primary-foreground')}>Без</button>
          <button onClick={() => setVatMode('gross')} className={cn('px-2 py-0.5 rounded', vatMode === 'gross' && 'bg-primary text-primary-foreground')}>С</button>
        </div>
        <div className="flex items-center gap-1 border rounded px-2 py-1 text-xs">
          <label>Изглед:</label>
          {(['plan','actual','variance'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn('px-2 py-0.5 rounded capitalize', view === v && 'bg-primary text-primary-foreground')}>
              {v === 'plan' ? 'Бюджет' : v === 'actual' ? 'Факт' : 'План vs Факт'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs ml-auto">
          <button onClick={() => download('xlsx')} className="px-2 py-1 border rounded hover:bg-muted">Excel</button>
          <button onClick={() => download('print')} className="px-2 py-1 border rounded hover:bg-muted">PDF</button>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left px-2 py-1.5 sticky left-0 bg-muted/50 min-w-[240px]">Ред</th>
              {months.map(m => view === 'variance'
                ? [
                    <th key={`${m}p`} className="px-2 py-1.5 text-right min-w-[90px]">{MONTH_LABELS[m]} План</th>,
                    <th key={`${m}a`} className="px-2 py-1.5 text-right min-w-[90px]">{MONTH_LABELS[m]} Факт</th>,
                    <th key={`${m}v`} className="px-2 py-1.5 text-right min-w-[70px]">Δ %</th>,
                  ]
                : <th key={m} className="px-2 py-1.5 text-right min-w-[100px]">{MONTH_LABELS[m]}</th>
              )}
              {view === 'variance'
                ? [
                    <th key="yp" className="px-2 py-1.5 text-right bg-muted">YTD План</th>,
                    <th key="ya" className="px-2 py-1.5 text-right bg-muted">YTD Факт</th>,
                    <th key="yv" className="px-2 py-1.5 text-right bg-muted">Δ %</th>,
                  ]
                : <th className="px-2 py-1.5 text-right bg-muted">YTD</th>}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map(row => (
              <tr key={row.row_key} className="border-t">
                <td className="px-2 py-1 sticky left-0 bg-background border-r"
                    style={{ paddingLeft: `${8 + row.indent_level * 12}px` }}>
                  {row.label_bg}
                </td>
                {months.map(m => {
                  const c = row.cells[m]
                  if (view === 'plan') return <td key={m} className="px-2 py-1 text-right tabular-nums border-r">{fmtNumber(c.plan, row.display_format)}</td>
                  if (view === 'actual') return <td key={m} className="px-2 py-1 text-right tabular-nums border-r">{fmtNumber(c.actual, row.display_format)}</td>
                  return [
                    <td key={`${m}p`} className="px-2 py-1 text-right tabular-nums text-muted-foreground border-r">{fmtNumber(c.plan, row.display_format)}</td>,
                    <td key={`${m}a`} className="px-2 py-1 text-right tabular-nums border-r">{fmtNumber(c.actual, row.display_format)}</td>,
                    <td key={`${m}v`} className={cn('px-2 py-1 text-right tabular-nums border-r', varianceClass(c.variance_pct, row.row_type))}>
                      {c.variance_pct === null ? '' : `${c.variance_pct.toFixed(1)}%`}
                    </td>,
                  ]
                })}
                {view === 'plan' && <td className="px-2 py-1 text-right tabular-nums bg-muted/30">{fmtNumber(row.ytd.plan, row.display_format)}</td>}
                {view === 'actual' && <td className="px-2 py-1 text-right tabular-nums bg-muted/30">{fmtNumber(row.ytd.actual, row.display_format)}</td>}
                {view === 'variance' && [
                  <td key="yp" className="px-2 py-1 text-right tabular-nums bg-muted/30 text-muted-foreground">{fmtNumber(row.ytd.plan, row.display_format)}</td>,
                  <td key="ya" className="px-2 py-1 text-right tabular-nums bg-muted/30">{fmtNumber(row.ytd.actual, row.display_format)}</td>,
                  <td key="yv" className={cn('px-2 py-1 text-right tabular-nums bg-muted/30', varianceClass(row.ytd.variance_pct, row.row_type))}>
                    {row.ytd.variance_pct === null ? '' : `${row.ytd.variance_pct.toFixed(1)}%`}
                  </td>,
                ]}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
