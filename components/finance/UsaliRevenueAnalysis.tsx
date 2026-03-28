'use client'

import { useEffect, useState } from 'react'

interface KpiSet {
  roomsAvailable: number
  roomsSold: number
  guests: number
  occupancyPercent: number
  adr: number
  revpar: number
  totalRevenuePerRoom: number
  roomRevenue: number
  totalRevenue: number
}

interface RevenueData {
  property: { id: string; name: string }
  period: { year: number; month: number }
  current: KpiSet | null
  previousMonth: KpiSet | null
  previousYear: KpiSet | null
}

interface Props {
  propertyId: string
  year: number
  month: number
}

function fmt(n: number | undefined, decimals = 2) {
  if (n === undefined || n === null) return '—'
  return n.toLocaleString('bg-BG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function pct(n: number | undefined) {
  if (n === undefined || n === null) return '—'
  return n.toFixed(1) + '%'
}

export function UsaliRevenueAnalysis({ propertyId, year, month }: Props) {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/finance/usali-reports/revenue-analysis?property_id=${propertyId}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [propertyId, year, month])

  if (loading) return <p className="text-xs text-muted-foreground py-4">Зареждане...</p>
  if (!data) return <p className="text-xs text-muted-foreground py-4">Няма данни.</p>

  if (!data.current) {
    return (
      <div className="border rounded-md p-4">
        <p className="text-xs text-muted-foreground text-center">
          Няма данни за стаи (property_statistics). Данните ще се попълнят от PMS интеграцията.
        </p>
      </div>
    )
  }

  const rows: { label: string; current: string; prev: string; yoy: string }[] = [
    { label: 'Налични стаи', current: fmt(data.current.roomsAvailable, 0), prev: fmt(data.previousMonth?.roomsAvailable, 0), yoy: fmt(data.previousYear?.roomsAvailable, 0) },
    { label: 'Продадени стаи', current: fmt(data.current.roomsSold, 0), prev: fmt(data.previousMonth?.roomsSold, 0), yoy: fmt(data.previousYear?.roomsSold, 0) },
    { label: 'Гости', current: fmt(data.current.guests, 0), prev: fmt(data.previousMonth?.guests, 0), yoy: fmt(data.previousYear?.guests, 0) },
    { label: 'Заетост %', current: pct(data.current.occupancyPercent), prev: pct(data.previousMonth?.occupancyPercent), yoy: pct(data.previousYear?.occupancyPercent) },
    { label: 'ADR (лв.)', current: fmt(data.current.adr), prev: fmt(data.previousMonth?.adr), yoy: fmt(data.previousYear?.adr) },
    { label: 'RevPAR (лв.)', current: fmt(data.current.revpar), prev: fmt(data.previousMonth?.revpar), yoy: fmt(data.previousYear?.revpar) },
    { label: 'Общ приход/стая (лв.)', current: fmt(data.current.totalRevenuePerRoom), prev: fmt(data.previousMonth?.totalRevenuePerRoom), yoy: fmt(data.previousYear?.totalRevenuePerRoom) },
    { label: 'Приход стаи (лв.)', current: fmt(data.current.roomRevenue), prev: fmt(data.previousMonth?.roomRevenue), yoy: fmt(data.previousYear?.roomRevenue) },
    { label: 'Общ приход (лв.)', current: fmt(data.current.totalRevenue), prev: fmt(data.previousMonth?.totalRevenue), yoy: fmt(data.previousYear?.totalRevenue) },
  ]

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-3 py-2 font-medium w-1/3"></th>
            <th className="text-right px-3 py-2 font-medium">Текущ месец</th>
            <th className="text-right px-3 py-2 font-medium">Предх. месец</th>
            <th className="text-right px-3 py-2 font-medium">Същ. мес. мин. г.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-b hover:bg-muted/20">
              <td className="px-3 py-1.5 font-medium">{row.label}</td>
              <td className="px-3 py-1.5 text-right">{row.current}</td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">{row.prev}</td>
              <td className="px-3 py-1.5 text-right text-muted-foreground">{row.yoy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
