'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { EmployeeList } from '@/components/finance/EmployeeList'
import type { Employee, UsaliDepartment, Position } from '@/components/finance/payroll-types'

// Re-export types for backwards compat with imports elsewhere
export type { Employee, ScheduleEntry, UsaliDepartment, Position } from '@/components/finance/payroll-types'

interface Props {
  properties: Array<{ id: string; name: string }>
  usaliDepartments: UsaliDepartment[]
  positions: Position[]
  defaultPropertyId: string | null
  userRole: string
}

export function PayrollView({ properties, usaliDepartments, positions, defaultPropertyId }: Props) {
  const [propertyId, setPropertyId] = useState<string>(defaultPropertyId ?? '')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)

  const fetchEmployees = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/payroll/employees?property_id=${propertyId}`)
      if (res.ok) {
        const data = await res.json()
        setEmployees(data)
      }
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold">Служители</h1>
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
      </div>

      {!propertyId ? (
        <p className="text-xs text-muted-foreground">Изберете обект.</p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Зареждане...</p>
      ) : (
        <EmployeeList
          employees={employees}
          usaliDepartments={usaliDepartments}
          positions={positions}
          propertyId={propertyId}
          onChanged={fetchEmployees}
        />
      )}
    </div>
  )
}
