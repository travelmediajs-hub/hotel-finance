'use client'

import { useEffect, useState } from 'react'

interface SummaryData {
  property: { id: string; name: string }
  period: { year: number; month: number }
  operatedDepartments: { template: { code: string; name: string }; profit: number; profitYtd: number }[]
  totalDepartmentalProfit: number
  totalDepartmentalProfitYtd: number
  undistributed: { template: { code: string; name: string }; amount: number; amountYtd: number }[]
  totalUndistributed: number
  totalUndistributedYtd: number
  gop: number
  gopYtd: number
  gopPercent: number
  gopPercentYtd: number
  fixedCharges: { template: { code: string; name: string }; amount: number; amountYtd: number }[]
  totalFixed: number
  totalFixedYtd: number
  noi: number
  noiYtd: number
  noiPercent: number
  noiPercentYtd: number
}

interface Props {
  propertyId: string
  year: number
  month: number
}

function fmt(n: number) {
  return n.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function UsaliSummaryReport({ propertyId, year, month }: Props) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/finance/usali-reports/summary?property_id=${propertyId}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [propertyId, year, month])

  if (loading) return <p className="text-xs text-muted-foreground py-4">Зареждане...</p>
  if (!data) return <p className="text-xs text-muted-foreground py-4">Няма данни.</p>

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-3 py-2 font-medium w-1/2"></th>
            <th className="text-right px-3 py-2 font-medium">Текущ месец</th>
            <th className="text-right px-3 py-2 font-medium">YTD</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b bg-green-500/5">
            <td className="px-3 py-1 font-medium" colSpan={3}>ОПЕРАТИВНИ ДЕПАРТАМЕНТИ</td>
          </tr>
          {data.operatedDepartments.map(d => (
            <tr key={d.template.code} className="border-b">
              <td className="px-3 py-1 pl-6">{d.template.name} — Печалба</td>
              <td className="px-3 py-1 text-right">{fmt(d.profit)}</td>
              <td className="px-3 py-1 text-right">{fmt(d.profitYtd)}</td>
            </tr>
          ))}
          <tr className="border-b font-medium bg-muted/30">
            <td className="px-3 py-1.5">ОБЩА ДЕПАРТАМЕНТАЛНА ПЕЧАЛБА</td>
            <td className="px-3 py-1.5 text-right">{fmt(data.totalDepartmentalProfit)}</td>
            <td className="px-3 py-1.5 text-right">{fmt(data.totalDepartmentalProfitYtd)}</td>
          </tr>

          <tr className="border-b bg-yellow-500/5">
            <td className="px-3 py-1 font-medium" colSpan={3}>НЕРАЗПРЕДЕЛЕНИ РАЗХОДИ</td>
          </tr>
          {data.undistributed.map(d => (
            <tr key={d.template.code} className="border-b">
              <td className="px-3 py-1 pl-6">{d.template.name}</td>
              <td className="px-3 py-1 text-right text-red-400">({fmt(d.amount)})</td>
              <td className="px-3 py-1 text-right text-red-400">({fmt(d.amountYtd)})</td>
            </tr>
          ))}
          <tr className="border-b font-medium bg-muted/30">
            <td className="px-3 py-1.5">ОБЩО НЕРАЗПРЕДЕЛЕНИ</td>
            <td className="px-3 py-1.5 text-right text-red-400">({fmt(data.totalUndistributed)})</td>
            <td className="px-3 py-1.5 text-right text-red-400">({fmt(data.totalUndistributedYtd)})</td>
          </tr>

          <tr className="border-b font-medium bg-primary/10">
            <td className="px-3 py-2">GROSS OPERATING PROFIT (GOP) — {data.gopPercent.toFixed(1)}%</td>
            <td className="px-3 py-2 text-right">{fmt(data.gop)}</td>
            <td className="px-3 py-2 text-right">{fmt(data.gopYtd)}</td>
          </tr>

          <tr className="border-b bg-red-500/5">
            <td className="px-3 py-1 font-medium" colSpan={3}>ФИКСИРАНИ РАЗХОДИ</td>
          </tr>
          {data.fixedCharges.map(d => (
            <tr key={d.template.code} className="border-b">
              <td className="px-3 py-1 pl-6">{d.template.name}</td>
              <td className="px-3 py-1 text-right text-red-400">({fmt(d.amount)})</td>
              <td className="px-3 py-1 text-right text-red-400">({fmt(d.amountYtd)})</td>
            </tr>
          ))}
          <tr className="border-b font-medium bg-muted/30">
            <td className="px-3 py-1.5">ОБЩО ФИКСИРАНИ</td>
            <td className="px-3 py-1.5 text-right text-red-400">({fmt(data.totalFixed)})</td>
            <td className="px-3 py-1.5 text-right text-red-400">({fmt(data.totalFixedYtd)})</td>
          </tr>

          <tr className="font-medium bg-primary/10">
            <td className="px-3 py-2">NET OPERATING INCOME (NOI) — {data.noiPercent.toFixed(1)}%</td>
            <td className="px-3 py-2 text-right">{fmt(data.noi)}</td>
            <td className="px-3 py-2 text-right">{fmt(data.noiYtd)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
