'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { EmployeeList } from '@/components/finance/EmployeeList'
import { ScheduleGrid } from '@/components/finance/ScheduleGrid'

export interface Employee {
  id: string
  property_id: string
  usali_department_id: string | null
  position_id: string | null
  full_name: string
  contract_salary: number
  actual_salary: number
  contract_hours_per_day: number
  is_active: boolean
  usali_department_templates: { code: string; name: string } | null
  positions: { name: string } | null
  properties: { name: string } | null
}

export interface ScheduleEntry {
  id: string
  employee_id: string
  date: string
  status: 'WORK' | 'REST' | 'LEAVE' | 'SICK'
  hours: number | null
  overtime_hours: number | null
}

export interface UsaliDepartment {
  id: string
  code: string
  name: string
}

export interface Position {
  id: string
  name: string
}

interface Props {
  properties: Array<{ id: string; name: string }>
  usaliDepartments: UsaliDepartment[]
  positions: Position[]
  defaultPropertyId: string | null
  userRole: string
}

function getMonthOptions(): Array<{ value: string; label: string }> {
  const now = new Date()
  const options: Array<{ value: string; label: string }> = []
  const monthNames = [
    'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
    'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
  ]
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
    options.push({ value: val, label })
  }
  return options
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function PayrollView({ properties, usaliDepartments, positions, defaultPropertyId, userRole }: Props) {
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
      const res = await fetch(`/api/finance/payroll/employees?property_id=${propertyId}`)
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

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.is_active),
    [employees],
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Заплати</h1>
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
      ) : loadingEmployees ? (
        <p className="text-xs text-muted-foreground">Зареждане...</p>
      ) : (
        <>
          <EmployeeList
            employees={employees}
            usaliDepartments={usaliDepartments}
            positions={positions}
            propertyId={propertyId}
            onChanged={fetchEmployees}
          />

          {loadingSchedule ? (
            <p className="text-xs text-muted-foreground">Зареждане...</p>
          ) : (
            <ScheduleGrid
              employees={activeEmployees}
              schedule={schedule}
              month={month}
              onChanged={fetchSchedule}
            />
          )}
        </>
      )}
    </div>
  )
}
