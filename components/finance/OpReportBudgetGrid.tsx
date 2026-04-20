'use client'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { OpReportRowWithAccounts } from '@/types/finance'
import { OpReportCell } from './OpReportCell'

interface Props {
  propertyId: string
  year: number
  operatingMonths: number[]
}

const MONTH_LABELS = ['', 'Яну','Фев','Мар','Апр','Май','Юни','Юли','Авг','Сеп','Окт','Ное','Дек']

export function OpReportBudgetGrid({ propertyId, year, operatingMonths }: Props) {
  const [template, setTemplate] = useState<OpReportRowWithAccounts[]>([])
  const [cells, setCells] = useState<Record<string, Record<number, number>>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    let abort = false
    async function load() {
      setLoading(true)
      const [tmpl, budget] = await Promise.all([
        fetch('/api/finance/opreport/template').then(r => r.json()),
        fetch(`/api/finance/opreport/budget?property_id=${propertyId}&year=${year}`).then(r => r.json()),
      ])
      if (abort) return
      setTemplate(tmpl)
      setCells(budget.cells ?? {})
      setLoading(false)
    }
    load()
    return () => { abort = true }
  }, [propertyId, year])

  const months = useMemo(() => operatingMonths.slice().sort((a, b) => a - b), [operatingMonths])

  async function commitCell(rowKey: string, month: number, newVal: number | null) {
    const key = `${rowKey}_${month}`
    setSavingKey(key)
    setCells(prev => {
      const next = { ...prev, [rowKey]: { ...(prev[rowKey] ?? {}) } }
      if (newVal === null) delete next[rowKey][month]
      else next[rowKey][month] = newVal
      return next
    })
    const amount = newVal ?? 0
    const res = await fetch('/api/finance/opreport/budget', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        cells: [{ property_id: propertyId, year, month, row_key: rowKey, amount }],
      }),
    })
    setSavingKey(null)
    if (!res.ok) {
      const fresh = await fetch(`/api/finance/opreport/budget?property_id=${propertyId}&year=${year}`).then(r => r.json())
      setCells(fresh.cells ?? {})
    }
  }

  const ytdOf = (rowKey: string) =>
    months.reduce((sum, m) => sum + (cells[rowKey]?.[m] ?? 0), 0)

  if (loading) return <div className="text-xs text-muted-foreground p-4">Зареждане...</div>

  return (
    <div className="relative overflow-auto border rounded">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            <th className="text-left px-2 py-1.5 sticky left-0 bg-muted/50 min-w-[240px]">Ред</th>
            {months.map(m => (
              <th key={m} className="px-2 py-1.5 text-right min-w-[100px]">{MONTH_LABELS[m]}</th>
            ))}
            <th className="px-2 py-1.5 text-right min-w-[110px] bg-muted">YTD</th>
          </tr>
        </thead>
        <tbody>
          {template.map(row => (
            <tr
              key={row.row_key}
              className={cn(
                'border-t',
                row.row_type === 'HEADER' && 'bg-muted font-semibold',
              )}
            >
              <td
                className={cn(
                  'px-2 py-1 sticky left-0 bg-background',
                  'border-r',
                )}
                style={{ paddingLeft: `${8 + row.indent_level * 12}px` }}
              >
                {row.label_bg}
              </td>
              {months.map(m => (
                <td key={m} className={cn('border-r', savingKey === `${row.row_key}_${m}` && 'bg-primary/10')}>
                  <OpReportCell
                    value={cells[row.row_key]?.[m] ?? null}
                    editable={row.budgetable}
                    format={row.display_format}
                    onCommit={v => commitCell(row.row_key, m, v)}
                  />
                </td>
              ))}
              <td className="bg-muted/30">
                <OpReportCell value={ytdOf(row.row_key)} editable={false} format={row.display_format} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
