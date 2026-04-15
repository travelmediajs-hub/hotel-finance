export interface Employee {
  id: string
  property_id: string
  usali_department_id: string | null
  position_id: string | null
  full_name: string
  contract_salary: number
  actual_salary: number
  contract_hours_per_day: number
  contract_days_per_month: number
  contract_type: string
  contract_start_date: string | null
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

export function getMonthOptions(): Array<{ value: string; label: string }> {
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

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
