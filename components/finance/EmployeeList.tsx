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
import { Pencil, Plus, Power } from 'lucide-react'
import type { Employee, UsaliDepartment, Position } from '@/components/finance/PayrollView'

interface Props {
  employees: Employee[]
  usaliDepartments: UsaliDepartment[]
  positions: Position[]
  propertyId: string
  onChanged: () => void
}

interface FormState {
  full_name: string
  position_id: string
  usali_department_id: string
  actual_salary: string
  contract_salary: string
  contract_hours_per_day: string
}

const emptyForm: FormState = {
  full_name: '',
  position_id: '',
  usali_department_id: '',
  actual_salary: '',
  contract_salary: '',
  contract_hours_per_day: '8',
}

export function EmployeeList({ employees, usaliDepartments, positions, propertyId, onChanged }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(emp: Employee) {
    setEditId(emp.id)
    setForm({
      full_name: emp.full_name,
      position_id: emp.position_id ?? '',
      usali_department_id: emp.usali_department_id ?? '',
      actual_salary: String(emp.actual_salary),
      contract_salary: String(emp.contract_salary),
      contract_hours_per_day: String(emp.contract_hours_per_day),
    })
    setError(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        full_name: form.full_name,
        position_id: form.position_id || null,
        usali_department_id: form.usali_department_id,
        actual_salary: parseFloat(form.actual_salary) || 0,
        contract_salary: parseFloat(form.contract_salary) || 0,
        contract_hours_per_day: parseInt(form.contract_hours_per_day, 10) || 8,
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

      if (!res.ok) {
        const body = await res.json()
        setError(body.message ?? 'Грешка при запис')
        return
      }

      setDialogOpen(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(emp: Employee) {
    const res = await fetch(`/api/finance/payroll/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !emp.is_active }),
    })
    if (res.ok) onChanged()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Служители ({employees.length})</h2>
        <Button size="sm" className="h-7 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Добави
        </Button>
      </div>

      <div className="border border-border rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-2 py-1.5">Име</th>
              <th className="px-2 py-1.5">Длъжност</th>
              <th className="px-2 py-1.5">USALI Отдел</th>
              <th className="px-2 py-1.5 text-right">Заплата</th>
              <th className="px-2 py-1.5 text-right">По договор</th>
              <th className="px-2 py-1.5 text-center">Ч/ден</th>
              <th className="px-2 py-1.5">Статус</th>
              <th className="px-2 py-1.5 w-20">Действия</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-2 py-1.5 font-medium">{emp.full_name}</td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {emp.positions?.name ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">
                  {emp.usali_department_templates?.name ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {emp.actual_salary.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {emp.contract_salary.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">
                  {emp.contract_hours_per_day}
                </td>
                <td className="px-2 py-1.5">
                  {emp.is_active ? (
                    <Badge className="text-[10px] bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                      Активен
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Неактивен
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5"
                      title="Редактирай"
                      onClick={() => openEdit(emp)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5"
                      title={emp.is_active ? 'Деактивирай' : 'Активирай'}
                      onClick={() => toggleActive(emp)}
                    >
                      <Power className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-muted-foreground">
                  Няма служители
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
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
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Длъжност</Label>
              <Select
                value={form.position_id}
                onValueChange={(v) => v && setForm({ ...form, position_id: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Избери длъжност" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">USALI Отдел</Label>
              <Select
                value={form.usali_department_id}
                onValueChange={(v) => v && setForm({ ...form, usali_department_id: v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Избери отдел" />
                </SelectTrigger>
                <SelectContent>
                  {usaliDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Реална заплата</Label>
              <Input
                type="number"
                value={form.actual_salary}
                onChange={(e) => setForm({ ...form, actual_salary: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">По договор</Label>
              <Input
                type="number"
                value={form.contract_salary}
                onChange={(e) => setForm({ ...form, contract_salary: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Часове/ден</Label>
              <Input
                type="number"
                value={form.contract_hours_per_day}
                onChange={(e) => setForm({ ...form, contract_hours_per_day: e.target.value })}
                className="h-8 text-xs"
                min={1}
                max={24}
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !form.full_name || !form.usali_department_id}
            >
              {saving ? 'Запазване...' : editId ? 'Запази' : 'Добави'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
