'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { OpReportBudgetGrid } from './OpReportBudgetGrid'
import { OpReportView } from './OpReportView'

interface Props {
  propertyId: string
  year: number
}

export function OpReportTab({ propertyId, year }: Props) {
  const [inner, setInner] = useState<'budget' | 'report'>('report')
  const [operatingMonths, setOperatingMonths] = useState<number[]>([1,2,3,4,5,6,7,8,9,10,11,12])

  useEffect(() => {
    let abort = false
    async function load() {
      const r = await fetch(`/api/finance/properties/${propertyId}`).then(r => r.json()).catch(() => null)
      if (abort) return
      if (r && Array.isArray(r.operating_months) && r.operating_months.length > 0) {
        setOperatingMonths(r.operating_months)
      }
    }
    load()
    return () => { abort = true }
  }, [propertyId])

  return (
    <div className="space-y-3">
      <div className="flex gap-1 text-xs">
        <button onClick={() => setInner('report')}
          className={cn('px-3 py-1.5 border rounded-t border-b-0', inner === 'report' ? 'bg-background' : 'bg-muted')}>
          Отчет
        </button>
        <button onClick={() => setInner('budget')}
          className={cn('px-3 py-1.5 border rounded-t border-b-0', inner === 'budget' ? 'bg-background' : 'bg-muted')}>
          Бюджет
        </button>
      </div>
      {inner === 'budget'
        ? <OpReportBudgetGrid propertyId={propertyId} year={year} operatingMonths={operatingMonths} />
        : <OpReportView propertyId={propertyId} year={year} />
      }
    </div>
  )
}
