'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { UsaliDepartmentalReport } from './UsaliDepartmentalReport'
import { UsaliSummaryReport } from './UsaliSummaryReport'
import { UsaliRevenueAnalysis } from './UsaliRevenueAnalysis'

interface Props {
  properties: Array<{ id: string; name: string }>
}

const tabs = [
  { key: 'departmental', label: 'Департаментален' },
  { key: 'summary', label: 'Обобщен (GOP/NOI)' },
  { key: 'revenue', label: 'Revenue Analysis' },
] as const

type TabKey = typeof tabs[number]['key']

export function UsaliReportsClient({ properties }: Props) {
  const now = new Date()
  const [tab, setTab] = useState<TabKey>('departmental')
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const months = [
    'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
    'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
  ]

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <select
          value={propertyId}
          onChange={e => setPropertyId(e.target.value)}
          className="text-xs bg-background border rounded px-2 py-1.5"
        >
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={month}
          onChange={e => setMonth(parseInt(e.target.value))}
          className="text-xs bg-background border rounded px-2 py-1.5"
        >
          {months.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={e => setYear(parseInt(e.target.value))}
          className="text-xs bg-background border rounded px-2 py-1.5 w-20"
        />
      </div>

      <div className="flex gap-1 mb-4 border-b">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'departmental' && propertyId && (
        <UsaliDepartmentalReport propertyId={propertyId} year={year} month={month} />
      )}
      {tab === 'summary' && propertyId && (
        <UsaliSummaryReport propertyId={propertyId} year={year} month={month} />
      )}
      {tab === 'revenue' && propertyId && (
        <UsaliRevenueAnalysis propertyId={propertyId} year={year} month={month} />
      )}
    </div>
  )
}
