# Payroll Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a payroll module with employee registry, monthly schedule grid, and auto salary calculation.

**Architecture:** Two DB tables (employees, employee_schedule) with API routes following existing patterns. Server component page fetches data, client components handle the employee list and schedule grid. Salary calculations happen client-side from schedule data.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), React, shadcn/ui components, Zod validation.

**Spec:** `docs/superpowers/specs/2026-04-14-payroll-module-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260414000000_payroll.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Employees table
CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  contract_salary numeric(12,2) NOT NULL DEFAULT 0,
  actual_salary numeric(12,2) NOT NULL DEFAULT 0,
  contract_hours_per_day smallint NOT NULL DEFAULT 8,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_property ON employees(property_id);
CREATE INDEX idx_employees_department ON employees(department_id);

-- Employee schedule table
CREATE TABLE employee_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('WORK', 'REST', 'LEAVE', 'SICK')),
  hours numeric(4,1),
  overtime_hours numeric(4,1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_employee_schedule_date ON employee_schedule(employee_id, date);

-- RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_auth" ON employees
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "employee_schedule_auth" ON employee_schedule
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push` or apply via Supabase dashboard SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260414000000_payroll.sql
git commit -m "feat: add employees and employee_schedule tables"
```

---

### Task 2: Employees API Routes

**Files:**
- Create: `app/api/finance/payroll/employees/route.ts`
- Create: `app/api/finance/payroll/employees/[id]/route.ts`

- [ ] **Step 1: Create employees list/create route**

```typescript
// app/api/finance/payroll/employees/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { z } from 'zod'

const createSchema = z.object({
  property_id: z.string().uuid(),
  department_id: z.string().uuid(),
  full_name: z.string().min(1).max(200),
  contract_salary: z.number().min(0),
  actual_salary: z.number().min(0),
  contract_hours_per_day: z.number().int().min(1).max(24).default(8),
})

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const propertyId = request.nextUrl.searchParams.get('property_id')

  let query = supabase
    .from('employees')
    .select('*, departments(name), properties(name)')
    .order('full_name')

  if (propertyId) {
    query = query.eq('property_id', propertyId)
  }

  // MANAGER: scope to own properties
  if (user.role === 'MANAGER') {
    const propIds = await getUserPropertyIds(user)
    if (propIds && propIds.length > 0) {
      query = query.in('property_id', propIds)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })
  }

  // MANAGER: verify property access
  if (user.role === 'MANAGER') {
    const propIds = await getUserPropertyIds(user)
    if (propIds && !propIds.includes(parsed.data.property_id)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create employee update route**

```typescript
// app/api/finance/payroll/employees/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { z } from 'zod'

const updateSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  department_id: z.string().uuid().optional(),
  contract_salary: z.number().min(0).optional(),
  actual_salary: z.number().min(0).optional(),
  contract_hours_per_day: z.number().int().min(1).max(24).optional(),
  is_active: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createClient()

  // MANAGER: verify employee belongs to their property
  if (user.role === 'MANAGER') {
    const { data: emp } = await supabase.from('employees').select('property_id').eq('id', id).single()
    if (!emp) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const propIds = await getUserPropertyIds(user)
    if (propIds && !propIds.includes(emp.property_id)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('employees')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })

  return NextResponse.json(data)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/finance/payroll/employees/
git commit -m "feat: employees CRUD API routes"
```

---

### Task 3: Schedule API Route

**Files:**
- Create: `app/api/finance/payroll/schedule/route.ts`

- [ ] **Step 1: Create schedule GET + PUT route**

```typescript
// app/api/finance/payroll/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { z } from 'zod'

const entrySchema = z.object({
  employee_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['WORK', 'REST', 'LEAVE', 'SICK']),
  hours: z.number().min(0).max(24).nullable().default(null),
  overtime_hours: z.number().min(0).max(24).nullable().default(null),
})

const bulkSchema = z.object({
  entries: z.array(entrySchema).min(1).max(1000),
})

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const propertyId = request.nextUrl.searchParams.get('property_id')
  const month = request.nextUrl.searchParams.get('month') // YYYY-MM

  if (!propertyId || !month) {
    return NextResponse.json({ error: 'missing property_id or month' }, { status: 400 })
  }

  // MANAGER: verify property access
  if (user.role === 'MANAGER') {
    const propIds = await getUserPropertyIds(user)
    if (propIds && !propIds.includes(propertyId)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const startDate = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const lastDay = new Date(year, mon, 0).getDate()
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

  const supabase = await createClient()

  // Get employee IDs for this property
  const { data: employees } = await supabase
    .from('employees')
    .select('id')
    .eq('property_id', propertyId)

  if (!employees || employees.length === 0) {
    return NextResponse.json([])
  }

  const empIds = employees.map((e) => e.id)

  const { data, error } = await supabase
    .from('employee_schedule')
    .select('*')
    .in('employee_id', empIds)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')

  if (error) return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function PUT(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createClient()

  const rows = parsed.data.entries.map((e) => ({
    employee_id: e.employee_id,
    date: e.date,
    status: e.status,
    hours: e.hours,
    overtime_hours: e.overtime_hours,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('employee_schedule')
    .upsert(rows, { onConflict: 'employee_id,date' })

  if (error) return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/finance/payroll/schedule/route.ts
git commit -m "feat: schedule GET and bulk PUT API routes"
```

---

### Task 4: Sidebar Entry

**Files:**
- Modify: `components/finance/FinanceSidebar.tsx`

- [ ] **Step 1: Add Banknote import and nav item**

Add `Banknote` to the lucide-react import.

Add to `navItems` array before the admin entry:

```typescript
{ href: '/finance/payroll', label: 'Заплати', icon: Banknote, roles: ['ADMIN_CO', 'MANAGER'] },
```

- [ ] **Step 2: Commit**

```bash
git add components/finance/FinanceSidebar.tsx
git commit -m "feat: add payroll sidebar entry"
```

---

### Task 5: Payroll Page (Server Component)

**Files:**
- Create: `app/(finance)/finance/payroll/page.tsx`

- [ ] **Step 1: Create page**

```typescript
// app/(finance)/finance/payroll/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole, getUserPropertyIds } from '@/lib/finance/auth'
import { PayrollView } from '@/components/finance/PayrollView'

export default async function PayrollPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/auth/login')
  if (!['ADMIN_CO', 'MANAGER'].includes(user.role)) redirect('/finance/dashboard')

  const supabase = await createClient()

  // Properties
  let properties: Array<{ id: string; name: string }> = []
  if (isCORole(user.role)) {
    const { data } = await supabase
      .from('properties')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name')
    properties = data ?? []
  } else {
    const propIds = await getUserPropertyIds(user)
    if (propIds && propIds.length > 0) {
      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .in('id', propIds)
        .order('name')
      properties = data ?? []
    }
  }

  // Departments (for employee create/edit)
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name, property_id')
    .eq('status', 'ACTIVE')
    .order('name')

  const defaultPropertyId = properties[0]?.id ?? null

  return (
    <div className="p-4 max-w-[1600px] mx-auto">
      <PayrollView
        properties={properties}
        departments={departments ?? []}
        defaultPropertyId={defaultPropertyId}
        userRole={user.role}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(finance\)/finance/payroll/page.tsx
git commit -m "feat: payroll server page with auth and data fetch"
```

---

### Task 6: PayrollView Client Component

**Files:**
- Create: `components/finance/PayrollView.tsx`

- [ ] **Step 1: Create PayrollView**

This is the main client component that holds state for property/month selection and renders EmployeeList + ScheduleGrid.

```typescript
// components/finance/PayrollView.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { EmployeeList } from './EmployeeList'
import { ScheduleGrid } from './ScheduleGrid'

interface Property { id: string; name: string }
interface Department { id: string; name: string; property_id: string }

export interface Employee {
  id: string
  property_id: string
  department_id: string
  full_name: string
  contract_salary: number
  actual_salary: number
  contract_hours_per_day: number
  is_active: boolean
  departments: { name: string } | null
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

interface Props {
  properties: Property[]
  departments: Department[]
  defaultPropertyId: string | null
  userRole: string
}

export function PayrollView({ properties, departments, defaultPropertyId, userRole }: Props) {
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? '')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(false)

  const now = new Date()
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  const filteredDepts = departments.filter((d) => d.property_id === propertyId)

  const fetchEmployees = useCallback(async () => {
    if (!propertyId) return
    const res = await fetch(`/api/finance/payroll/employees?property_id=${propertyId}`)
    if (res.ok) {
      const data = await res.json()
      setEmployees(data)
    }
  }, [propertyId])

  const fetchSchedule = useCallback(async () => {
    if (!propertyId || !month) return
    const res = await fetch(
      `/api/finance/payroll/schedule?property_id=${propertyId}&month=${month}`
    )
    if (res.ok) {
      const data = await res.json()
      setSchedule(data)
    }
  }, [propertyId, month])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchEmployees(), fetchSchedule()]).finally(() => setLoading(false))
  }, [fetchEmployees, fetchSchedule])

  const months: string[] = []
  for (let i = -3; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold">Заплати</h1>
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
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Зареждане...</p>
      ) : (
        <>
          <EmployeeList
            employees={employees}
            departments={filteredDepts}
            propertyId={propertyId}
            onChanged={fetchEmployees}
          />
          <ScheduleGrid
            employees={employees.filter((e) => e.is_active)}
            schedule={schedule}
            month={month}
            propertyId={propertyId}
            onChanged={fetchSchedule}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/finance/PayrollView.tsx
git commit -m "feat: PayrollView client component with state management"
```

---

### Task 7: EmployeeList Component

**Files:**
- Create: `components/finance/EmployeeList.tsx`

- [ ] **Step 1: Create EmployeeList**

Table with employee data + add/edit dialogs. Columns: Име, Отдел, Заплата, По договор, Ч/ден, Статус, Действия.

Dialog for add/edit: full_name, department_id, contract_salary, actual_salary, contract_hours_per_day.

```typescript
// components/finance/EmployeeList.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil } from 'lucide-react'
import type { Employee } from './PayrollView'

interface Department { id: string; name: string }

interface Props {
  employees: Employee[]
  departments: Department[]
  propertyId: string
  onChanged: () => void
}

interface FormState {
  full_name: string
  department_id: string
  contract_salary: string
  actual_salary: string
  contract_hours_per_day: string
}

const emptyForm: FormState = {
  full_name: '',
  department_id: '',
  contract_salary: '',
  actual_salary: '',
  contract_hours_per_day: '8',
}

export function EmployeeList({ employees, departments, propertyId, onChanged }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditId(null)
    setForm({ ...emptyForm, department_id: departments[0]?.id ?? '' })
    setDialogOpen(true)
  }

  function openEdit(e: Employee) {
    setEditId(e.id)
    setForm({
      full_name: e.full_name,
      department_id: e.department_id,
      contract_salary: String(e.contract_salary),
      actual_salary: String(e.actual_salary),
      contract_hours_per_day: String(e.contract_hours_per_day),
    })
    setDialogOpen(true)
  }

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        full_name: form.full_name,
        department_id: form.department_id,
        contract_salary: Number(form.contract_salary),
        actual_salary: Number(form.actual_salary),
        contract_hours_per_day: Number(form.contract_hours_per_day),
        ...(editId ? {} : { property_id: propertyId }),
      }

      const url = editId
        ? `/api/finance/payroll/employees/${editId}`
        : '/api/finance/payroll/employees'
      const method = editId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.message ?? 'Грешка')
        return
      }
      setDialogOpen(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(emp: Employee) {
    await fetch(`/api/finance/payroll/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !emp.is_active }),
    })
    onChanged()
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const canSubmit = form.full_name && form.department_id && form.contract_salary && form.actual_salary

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold">Служители ({employees.length})</h2>
        <Button size="sm" className="h-7 text-xs" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Добави
        </Button>
      </div>

      <div className="border border-border rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-2 py-1.5">Име</th>
              <th className="px-2 py-1.5">Отдел</th>
              <th className="px-2 py-1.5 text-right">Заплата</th>
              <th className="px-2 py-1.5 text-right">По договор</th>
              <th className="px-2 py-1.5 text-center">Ч/ден</th>
              <th className="px-2 py-1.5">Статус</th>
              <th className="px-2 py-1.5 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-2 py-1.5 font-medium">{e.full_name}</td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {e.departments?.name ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {Number(e.actual_salary).toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {Number(e.contract_salary).toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-center">{e.contract_hours_per_day}</td>
                <td className="px-2 py-1.5">
                  {e.is_active ? (
                    <Badge className="text-[10px] bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                      Активен
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Неактивен</Badge>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-1.5"
                      onClick={() => openEdit(e)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={() => toggleActive(e)}
                    >
                      {e.is_active ? 'Деакт.' : 'Акт.'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                  Няма служители
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Редактирай служител' : 'Добави служител'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <Label className="text-xs">Име</Label>
              <Input
                value={form.full_name}
                onChange={(e) => set('full_name', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Отдел</Label>
              <Select value={form.department_id} onValueChange={(v) => set('department_id', v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Избери отдел" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Реална заплата</Label>
                <Input
                  type="number"
                  value={form.actual_salary}
                  onChange={(e) => set('actual_salary', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">По договор</Label>
                <Input
                  type="number"
                  value={form.contract_salary}
                  onChange={(e) => set('contract_salary', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Часове/ден по договор</Label>
              <Input
                type="number"
                value={form.contract_hours_per_day}
                onChange={(e) => set('contract_hours_per_day', e.target.value)}
                className="h-8 text-xs"
                min={1}
                max={24}
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={submit} disabled={saving || !canSubmit}>
              {saving ? 'Запазване...' : editId ? 'Запази' : 'Добави'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/finance/EmployeeList.tsx
git commit -m "feat: EmployeeList component with CRUD"
```

---

### Task 8: ScheduleGrid Component

**Files:**
- Create: `components/finance/ScheduleGrid.tsx`

- [ ] **Step 1: Create ScheduleGrid**

Monthly grid with rows=employees, columns=days. Each cell shows status letter colored by type. Click opens popover to set status/hours/overtime. Right-side summary columns with totals and calculated salary.

```typescript
// components/finance/ScheduleGrid.tsx
'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Employee, ScheduleEntry } from './PayrollView'

interface Props {
  employees: Employee[]
  schedule: ScheduleEntry[]
  month: string // YYYY-MM
  propertyId: string
  onChanged: () => void
}

const STATUS_LABELS: Record<string, string> = {
  WORK: 'Р',
  REST: 'П',
  LEAVE: 'О',
  SICK: 'Б',
}

const STATUS_COLORS: Record<string, string> = {
  WORK: 'bg-green-500/20 text-green-700 dark:text-green-400',
  REST: 'bg-muted text-muted-foreground',
  LEAVE: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  SICK: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
}

function getDaysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function getBusinessDays(month: string): number {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(y, m - 1, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

function isWeekend(month: string, day: number): boolean {
  const [y, m] = month.split('-').map(Number)
  const dow = new Date(y, m - 1, day).getDay()
  return dow === 0 || dow === 6
}

export function ScheduleGrid({ employees, schedule, month, propertyId, onChanged }: Props) {
  const days = getDaysInMonth(month)
  const businessDays = getBusinessDays(month)

  // Build lookup: employeeId -> date -> entry
  const lookup = useMemo(() => {
    const map: Record<string, Record<string, ScheduleEntry>> = {}
    for (const s of schedule) {
      if (!map[s.employee_id]) map[s.employee_id] = {}
      map[s.employee_id][s.date] = s
    }
    return map
  }, [schedule])

  function getEntry(empId: string, day: number): ScheduleEntry | undefined {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`
    return lookup[empId]?.[dateStr]
  }

  function calcSummary(emp: Employee) {
    const entries = Object.values(lookup[emp.id] ?? {})
    const workEntries = entries.filter((e) => e.status === 'WORK')
    const workedDays = workEntries.length
    const totalHours = workEntries.reduce((s, e) => s + (e.hours ?? 0), 0)
    const totalOvertime = entries.reduce((s, e) => s + (e.overtime_hours ?? 0), 0)
    const leaveCount = entries.filter((e) => e.status === 'LEAVE').length
    const sickCount = entries.filter((e) => e.status === 'SICK').length

    const salary = businessDays > 0
      ? (emp.actual_salary * workedDays) / businessDays
      : 0
    const hourlyRate = businessDays > 0 && emp.contract_hours_per_day > 0
      ? emp.actual_salary / businessDays / emp.contract_hours_per_day
      : 0
    const overtimePay = hourlyRate * totalOvertime * 1.5
    const total = salary + overtimePay

    return { workedDays, totalHours, totalOvertime, leaveCount, sickCount, salary, overtimePay, total }
  }

  if (employees.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Няма активни служители за този обект.</p>
    )
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold">
        График — {month} ({businessDays} работни дни)
      </h2>
      <div className="border border-border rounded overflow-x-auto">
        <table className="text-[11px] border-collapse">
          <thead className="bg-muted">
            <tr>
              <th className="px-2 py-1 text-left sticky left-0 bg-muted z-10 min-w-[120px]">
                Служител
              </th>
              {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                <th
                  key={d}
                  className={`px-1 py-1 text-center min-w-[32px] ${isWeekend(month, d) ? 'bg-muted-foreground/10' : ''}`}
                >
                  {d}
                </th>
              ))}
              <th className="px-2 py-1 text-center bg-muted border-l border-border">Дни</th>
              <th className="px-2 py-1 text-center bg-muted">Часове</th>
              <th className="px-2 py-1 text-center bg-muted">Извънр.</th>
              <th className="px-2 py-1 text-right bg-muted">Заплата</th>
              <th className="px-2 py-1 text-right bg-muted">Извънр.лв</th>
              <th className="px-2 py-1 text-right bg-muted">Общо</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const summary = calcSummary(emp)
              return (
                <tr key={emp.id} className="border-t border-border">
                  <td className="px-2 py-1 font-medium sticky left-0 bg-card z-10 whitespace-nowrap">
                    {emp.full_name}
                  </td>
                  {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                    <ScheduleCell
                      key={d}
                      employeeId={emp.id}
                      day={d}
                      month={month}
                      entry={getEntry(emp.id, d)}
                      isWeekend={isWeekend(month, d)}
                      onChanged={onChanged}
                    />
                  ))}
                  <td className="px-2 py-1 text-center tabular-nums border-l border-border font-medium">
                    {summary.workedDays}
                  </td>
                  <td className="px-2 py-1 text-center tabular-nums">{summary.totalHours}</td>
                  <td className="px-2 py-1 text-center tabular-nums">{summary.totalOvertime}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{summary.salary.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{summary.overtimePay.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right tabular-nums font-medium">
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

function ScheduleCell({
  employeeId, day, month, entry, isWeekend: weekend, onChanged,
}: {
  employeeId: string
  day: number
  month: string
  entry: ScheduleEntry | undefined
  isWeekend: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(entry?.status ?? 'WORK')
  const [hours, setHours] = useState(String(entry?.hours ?? '8'))
  const [overtime, setOvertime] = useState(String(entry?.overtime_hours ?? '0'))
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setStatus(entry?.status ?? 'WORK')
    setHours(String(entry?.hours ?? '8'))
    setOvertime(String(entry?.overtime_hours ?? '0'))
  }

  async function save() {
    setSaving(true)
    try {
      const dateStr = `${month}-${String(day).padStart(2, '0')}`
      await fetch('/api/finance/payroll/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: [{
            employee_id: employeeId,
            date: dateStr,
            status,
            hours: status === 'WORK' ? Number(hours) : null,
            overtime_hours: Number(overtime) || null,
          }],
        }),
      })
      setOpen(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const bg = entry ? STATUS_COLORS[entry.status] : (weekend ? 'bg-muted-foreground/5' : '')

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) resetForm() }}>
      <PopoverTrigger asChild>
        <td
          className={`px-1 py-1 text-center cursor-pointer hover:ring-1 hover:ring-primary/50 ${bg}`}
        >
          {entry ? STATUS_LABELS[entry.status] : ''}
        </td>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2 space-y-2" align="start">
        <p className="text-[10px] font-medium text-muted-foreground">
          {day}.{month.split('-')[1]}.{month.split('-')[0]}
        </p>
        <div>
          <Label className="text-[10px]">Статус</Label>
          <Select value={status} onValueChange={(v) => v && setStatus(v as ScheduleEntry['status'])}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WORK" className="text-xs">Р — Работен</SelectItem>
              <SelectItem value="REST" className="text-xs">П — Почивен</SelectItem>
              <SelectItem value="LEAVE" className="text-xs">О — Отпуск</SelectItem>
              <SelectItem value="SICK" className="text-xs">Б — Болничен</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {status === 'WORK' && (
          <div>
            <Label className="text-[10px]">Часове</Label>
            <Input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="h-7 text-xs"
              min={0}
              max={24}
            />
          </div>
        )}
        <div>
          <Label className="text-[10px]">Извънредни</Label>
          <Input
            type="number"
            value={overtime}
            onChange={(e) => setOvertime(e.target.value)}
            className="h-7 text-xs"
            min={0}
            max={24}
          />
        </div>
        <Button size="sm" className="w-full h-7 text-xs" onClick={save} disabled={saving}>
          {saving ? '...' : 'Запази'}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/finance/ScheduleGrid.tsx
git commit -m "feat: ScheduleGrid component with cell editing and salary calc"
```

---

### Task 9: Final Integration & Verify

- [ ] **Step 1: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Final commit with all files**

```bash
git add -A
git commit -m "feat: payroll module - employees, schedule grid, salary calculation"
git push origin master
```
