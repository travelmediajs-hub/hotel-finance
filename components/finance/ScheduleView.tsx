'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScheduleGrid } from '@/components/finance/ScheduleGrid'
import type { Employee, ScheduleEntry } from '@/components/finance/payroll-types'
import { getMonthOptions, getCurrentMonth } from '@/components/finance/payroll-types'

interface Props {
  properties: Array<{ id: string; name: string }>
  defaultPropertyId: string | null
}

export function ScheduleView({ properties, defaultPropertyId }: Props) {
  const [propertyId, setPropertyId] = useState<string>(defaultPropertyId ?? '')
  const [month, setMonth] = useState<string>(getCurrentMonth())
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  const monthOptions = useMemo(() => getMonthOptions(), [])

  const fetchEmployees = useCallback(async () => {
    if (!propertyId) return
    setLoadingEmployees(true)
    try {
      const res = await fetch(`/api/finance/payroll/employees?property_id=${propertyId}&include_inactive=true`)
      if (res.ok) {
        const data = await res.json()
        setEmployees(data)
      }
    } finally {
      setLoadingEmployees(false)
    }
  }, [propertyId])

  const fetchSchedule = useCallback(async () => {
    if (!propertyId) return
    setLoadingSchedule(true)
    try {
      const res = await fetch(
        `/api/finance/payroll/schedule?property_id=${propertyId}&month=${month}`,
      )
      if (res.ok) {
        const data = await res.json()
        setSchedule(data)
      }
    } finally {
      setLoadingSchedule(false)
    }
  }, [propertyId, month])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  useEffect(() => {
    fetchSchedule()
  }, [fetchSchedule])

  // Show active employees + inactive ones that have at least one worked day this month
  const visibleEmployees = useMemo(() => {
    const scheduleByEmployee = new Map<string, boolean>()
    for (const entry of schedule) {
      if (entry.status === 'WORK') {
        scheduleByEmployee.set(entry.employee_id, true)
      }
    }
    return employees.filter(
      (e) => e.is_active || scheduleByEmployee.has(e.id),
    )
  }, [employees, schedule])

  const loading = loadingEmployees || loadingSchedule

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">График</h1>
        {properties.length > 1 && (
          <Select value={propertyId} onValueChange={(v) => v && setPropertyId(v)}>
            <SelectTrigger className="h-8 text-xs w-48">
              <SelectValue placeholder="Обект" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={month} onValueChange={(v) => v && setMonth(v)}>
          <SelectTrigger className="h-8 text-xs w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!propertyId ? (
        <p className="text-xs text-muted-foreground">Изберете обект.</p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Зареждане...</p>
      ) : (
        <ScheduleGrid
          employees={visibleEmployees}
          schedule={schedule}
          month={month}
          onChanged={fetchSchedule}
        />
      )}
    </div>
  )
}
