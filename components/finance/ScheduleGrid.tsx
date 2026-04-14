'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import type { Employee, ScheduleEntry } from '@/components/finance/PayrollView'

type ScheduleStatus = ScheduleEntry['status']

interface Props {
  employees: Employee[]
  schedule: ScheduleEntry[]
  month: string
  onChanged: () => void
}

// --- Helpers ---

function getDaysInMonth(month: string): number {
  const [year, mon] = month.split('-').map(Number)
  return new Date(year, mon, 0).getDate()
}

function getBusinessDays(month: string): number {
  const [year, mon] = month.split('-').map(Number)
  const days = new Date(year, mon, 0).getDate()
  let count = 0
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, mon - 1, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

function isWeekend(month: string, day: number): boolean {
  const [year, mon] = month.split('-').map(Number)
  const dow = new Date(year, mon - 1, day).getDay()
  return dow === 0 || dow === 6
}

function buildDateString(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`
}

const statusLabels: Record<ScheduleStatus, string> = {
  WORK: 'Р',
  REST: 'П',
  LEAVE: 'О',
  SICK: 'Б',
}

const statusColors: Record<ScheduleStatus, string> = {
  WORK: 'bg-green-500/20 text-green-700 dark:text-green-400',
  REST: 'bg-muted text-muted-foreground',
  LEAVE: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  SICK: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
}

type ScheduleLookup = Record<string, Record<string, ScheduleEntry>>

function buildLookup(schedule: ScheduleEntry[]): ScheduleLookup {
  const lookup: ScheduleLookup = {}
  for (const entry of schedule) {
    if (!lookup[entry.employee_id]) lookup[entry.employee_id] = {}
    lookup[entry.employee_id][entry.date] = entry
  }
  return lookup
}

// --- Cell Popover ---

interface CellPopoverProps {
  entry: ScheduleEntry | undefined
  employeeId: string
  dateStr: string
  onSave: (entry: { employee_id: string; date: string; status: ScheduleStatus; hours: number | null; overtime_hours: number | null }) => Promise<void>
}

function CellPopover({ entry, employeeId, dateStr, onSave }: CellPopoverProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<ScheduleStatus>(entry?.status ?? 'WORK')
  const [hours, setHours] = useState(String(entry?.hours ?? 8))
  const [overtime, setOvertime] = useState(String(entry?.overtime_hours ?? 0))
  const [saving, setSaving] = useState(false)

  function handleOpen(nextOpen: boolean) {
    if (nextOpen) {
      setStatus(entry?.status ?? 'WORK')
      setHours(String(entry?.hours ?? 8))
      setOvertime(String(entry?.overtime_hours ?? 0))
    }
    setOpen(nextOpen)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        employee_id: employeeId,
        date: dateStr,
        status,
        hours: status === 'WORK' ? parseFloat(hours) || null : null,
        overtime_hours: status === 'WORK' ? parseFloat(overtime) || null : null,
      })
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const displayStatus = entry?.status
  const cellContent = displayStatus ? statusLabels[displayStatus] : ''
  const cellColor = displayStatus ? statusColors[displayStatus] : ''

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger
        className={`w-full h-full min-h-[22px] flex items-center justify-center cursor-pointer rounded-sm text-[11px] font-medium ${cellColor}`}
      >
        {cellContent}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 space-y-2" align="start" side="bottom">
        <div>
          <Label className="text-[11px]">Статус</Label>
          <Select value={status} onValueChange={(v) => v && setStatus(v as ScheduleStatus)}>
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WORK" className="text-[11px]">Р - Работа</SelectItem>
              <SelectItem value="REST" className="text-[11px]">П - Почивка</SelectItem>
              <SelectItem value="LEAVE" className="text-[11px]">О - Отпуска</SelectItem>
              <SelectItem value="SICK" className="text-[11px]">Б - Болничен</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {status === 'WORK' && (
          <>
            <div>
              <Label className="text-[11px]">Часове</Label>
              <Input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="h-7 text-[11px]"
                min={0}
                max={24}
              />
            </div>
            <div>
              <Label className="text-[11px]">Извънреден</Label>
              <Input
                type="number"
                value={overtime}
                onChange={(e) => setOvertime(e.target.value)}
                className="h-7 text-[11px]"
                min={0}
                max={24}
              />
            </div>
          </>
        )}
        <Button size="sm" className="h-7 text-[11px] w-full" onClick={handleSave} disabled={saving}>
          {saving ? 'Запис...' : 'Запази'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

// --- Main Grid ---

export function ScheduleGrid({ employees, schedule, month, onChanged }: Props) {
  const daysInMonth = getDaysInMonth(month)
  const businessDays = getBusinessDays(month)
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth])
  const lookup = useMemo(() => buildLookup(schedule), [schedule])

  async function handleCellSave(entry: {
    employee_id: string
    date: string
    status: ScheduleStatus
    hours: number | null
    overtime_hours: number | null
  }) {
    const res = await fetch('/api/finance/payroll/schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [entry] }),
    })
    if (res.ok) onChanged()
  }

  function getEmployeeSummary(emp: Employee) {
    const empSchedule = lookup[emp.id] ?? {}
    let workedDays = 0
    let totalHours = 0
    let totalOvertime = 0

    for (const entry of Object.values(empSchedule)) {
      if (entry.status === 'WORK') {
        workedDays++
        totalHours += entry.hours ?? 0
        totalOvertime += entry.overtime_hours ?? 0
      }
    }

    const salary = businessDays > 0
      ? emp.actual_salary * (workedDays / businessDays)
      : 0
    const hourlyRate = businessDays > 0 && emp.contract_hours_per_day > 0
      ? emp.actual_salary / businessDays / emp.contract_hours_per_day
      : 0
    const overtimePay = hourlyRate * totalOvertime * 1.5
    const total = salary + overtimePay

    return { workedDays, totalHours, totalOvertime, salary, overtimePay, total }
  }

  if (employees.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Няма активни служители за графика.</p>
    )
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">График</h2>
      <div className="border border-border rounded overflow-x-auto">
        <table className="text-[11px] border-collapse">
          <thead className="bg-muted">
            <tr>
              <th className="px-2 py-1 text-left sticky left-0 bg-muted z-10 min-w-[140px]">
                Служител
              </th>
              {days.map((d) => (
                <th
                  key={d}
                  className={`px-1 py-1 text-center min-w-[28px] ${isWeekend(month, d) ? 'bg-muted-foreground/10' : ''}`}
                >
                  {d}
                </th>
              ))}
              <th className="px-1.5 py-1 text-center border-l border-border">Дни</th>
              <th className="px-1.5 py-1 text-center">Часове</th>
              <th className="px-1.5 py-1 text-center">Извънр.</th>
              <th className="px-1.5 py-1 text-right">Заплата</th>
              <th className="px-1.5 py-1 text-right">Извънр.лв</th>
              <th className="px-1.5 py-1 text-right">Общо</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const summary = getEmployeeSummary(emp)
              return (
                <tr key={emp.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-2 py-0.5 font-medium sticky left-0 bg-background z-10 whitespace-nowrap">
                    {emp.full_name}
                  </td>
                  {days.map((d) => {
                    const dateStr = buildDateString(month, d)
                    const entry = lookup[emp.id]?.[dateStr]
                    return (
                      <td
                        key={d}
                        className={`px-0 py-0 text-center ${isWeekend(month, d) ? 'bg-muted-foreground/10' : ''}`}
                      >
                        <CellPopover
                          entry={entry}
                          employeeId={emp.id}
                          dateStr={dateStr}
                          onSave={handleCellSave}
                        />
                      </td>
                    )
                  })}
                  <td className="px-1.5 py-0.5 text-center tabular-nums border-l border-border">
                    {summary.workedDays}
                  </td>
                  <td className="px-1.5 py-0.5 text-center tabular-nums">
                    {summary.totalHours}
                  </td>
                  <td className="px-1.5 py-0.5 text-center tabular-nums">
                    {summary.totalOvertime}
                  </td>
                  <td className="px-1.5 py-0.5 text-right tabular-nums">
                    {summary.salary.toFixed(2)}
                  </td>
                  <td className="px-1.5 py-0.5 text-right tabular-nums">
                    {summary.overtimePay.toFixed(2)}
                  </td>
                  <td className="px-1.5 py-0.5 text-right tabular-nums font-medium">
                    {summary.total.toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
