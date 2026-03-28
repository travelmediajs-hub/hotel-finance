'use client'

import { useEffect, useState } from 'react'

interface DeptData {
  template: { code: string; name: string }
  revenue: { groups: { account: { code: string; name: string }; amount: number; budget: number }[]; total: number; totalBudget: number }
  expenses: { groups: { account: { code: string; name: string }; amount: number; budget: number }[]; total: number; totalBudget: number }
  profit: number
  profitBudget: number
  margin: number
}

interface Report {
  property: { id: string; name: string }
  period: { year: number; month: number }
  departments: DeptData[]
}

interface Props {
  propertyId: string
  year: number
  month: number
}

function fmt(n: number) {
  return n.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function UsaliDepartmentalReport({ propertyId, year, month }: Props) {
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/finance/usali-reports/departmental?property_id=${propertyId}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [propertyId, year, month])

  if (loading) return <p className="text-xs text-muted-foreground py-4">Зареждане...</p>
  if (!data || data.departments.length === 0) return <p className="text-xs text-muted-foreground py-4">Няма данни.</p>

  return (
    <div className="space-y-6">
      {data.departments.map(dept => (
        <div key={dept.template.code} className="border rounded-md overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b">
            <h3 className="text-sm font-medium">{dept.template.name}</h3>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-3 py-1.5 font-medium w-1/2"></th>
                <th className="text-right px-3 py-1.5 font-medium">Факт</th>
                <th className="text-right px-3 py-1.5 font-medium">Бюджет</th>
                <th className="text-right px-3 py-1.5 font-medium">Разлика</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-green-500/5">
                <td className="px-3 py-1 font-medium" colSpan={4}>ПРИХОДИ</td>
              </tr>
              {dept.revenue.groups.map(g => (
                <tr key={g.account.code} className="border-b">
                  <td className="px-3 py-1 pl-6">{g.account.name}</td>
                  <td className="px-3 py-1 text-right">{fmt(g.amount)}</td>
                  <td className="px-3 py-1 text-right text-muted-foreground">{g.budget > 0 ? fmt(g.budget) : '—'}</td>
                  <td className={`px-3 py-1 text-right ${g.amount - g.budget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {g.budget > 0 ? fmt(g.amount - g.budget) : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="px-3 py-1">ОБЩО ПРИХОДИ</td>
                <td className="px-3 py-1 text-right">{fmt(dept.revenue.total)}</td>
                <td className="px-3 py-1 text-right text-muted-foreground">{dept.revenue.totalBudget > 0 ? fmt(dept.revenue.totalBudget) : '—'}</td>
                <td className={`px-3 py-1 text-right ${dept.revenue.total - dept.revenue.totalBudget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {dept.revenue.totalBudget > 0 ? fmt(dept.revenue.total - dept.revenue.totalBudget) : '—'}
                </td>
              </tr>

              <tr className="border-b bg-red-500/5">
                <td className="px-3 py-1 font-medium" colSpan={4}>РАЗХОДИ</td>
              </tr>
              {dept.expenses.groups.map(g => (
                <tr key={g.account.code} className="border-b">
                  <td className="px-3 py-1 pl-6">{g.account.name}</td>
                  <td className="px-3 py-1 text-right">{fmt(g.amount)}</td>
                  <td className="px-3 py-1 text-right text-muted-foreground">{g.budget > 0 ? fmt(g.budget) : '—'}</td>
                  <td className={`px-3 py-1 text-right ${g.amount - g.budget <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {g.budget > 0 ? fmt(g.amount - g.budget) : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="px-3 py-1">ОБЩО РАЗХОДИ</td>
                <td className="px-3 py-1 text-right">{fmt(dept.expenses.total)}</td>
                <td className="px-3 py-1 text-right text-muted-foreground">{dept.expenses.totalBudget > 0 ? fmt(dept.expenses.totalBudget) : '—'}</td>
                <td className={`px-3 py-1 text-right ${dept.expenses.total - dept.expenses.totalBudget <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {dept.expenses.totalBudget > 0 ? fmt(dept.expenses.total - dept.expenses.totalBudget) : '—'}
                </td>
              </tr>

              <tr className="bg-muted/50 font-medium">
                <td className="px-3 py-1.5">ДЕПАРТАМЕНТАЛНА ПЕЧАЛБА ({dept.margin.toFixed(1)}%)</td>
                <td className="px-3 py-1.5 text-right">{fmt(dept.profit)}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">{dept.profitBudget !== 0 ? fmt(dept.profitBudget) : '—'}</td>
                <td className={`px-3 py-1.5 text-right ${dept.profit - dept.profitBudget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {dept.profitBudget !== 0 ? fmt(dept.profit - dept.profitBudget) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
