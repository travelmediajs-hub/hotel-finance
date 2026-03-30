'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import type { Department, FiscalDevice, POSTerminal } from '@/types/finance'

interface Props {
  propertyId: string
  department?: Department
  fiscalDevices: FiscalDevice[]
  posTerminals: POSTerminal[]
  trigger: React.ReactNode
}

export function DepartmentForm({ propertyId, department, fiscalDevices, posTerminals, trigger }: Props) {
  const router = useRouter()
  const isEdit = !!department
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fiscalDeviceId, setFiscalDeviceId] = useState(department?.fiscal_device_id ?? '')
  const [posTerminalId, setPosTerminalId] = useState(department?.pos_terminal_id ?? '')
  const [sortOrder, setSortOrder] = useState(department?.sort_order ?? 0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const name = (formData.get('name') as string)?.trim()
    const managerId = (formData.get('manager_id') as string)?.trim() || null

    const body: Record<string, unknown> = isEdit
      ? { name, manager_id: managerId, fiscal_device_id: fiscalDeviceId || null, pos_terminal_id: posTerminalId || null, sort_order: sortOrder }
      : { property_id: propertyId, name, manager_id: managerId, fiscal_device_id: fiscalDeviceId || null, pos_terminal_id: posTerminalId || null, sort_order: sortOrder }

    try {
      const url = isEdit
        ? `/api/finance/departments/${department.id}`
        : '/api/finance/departments'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? data.error ?? 'Грешка при запис')
        return
      }

      setOpen(false)
      router.refresh()
    } catch {
      setError('Грешка при връзка със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const selectCls = 'bg-transparent border border-border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-ring [&_option]:bg-zinc-900 [&_option]:text-zinc-100'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактиране на точка' : 'Нова точка на продажба'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="dept-name">Име *</Label>
            <Input id="dept-name" name="name" required
              defaultValue={department?.name ?? ''} placeholder="напр. Рецепция" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-manager">Управител (ID) *</Label>
            <Input id="dept-manager" name="manager_id" required
              defaultValue={department?.manager_id ?? ''} placeholder="UUID на управител" />
          </div>
          <div className="space-y-2">
            <Label>Касов апарат</Label>
            <select
              value={fiscalDeviceId}
              onChange={e => setFiscalDeviceId(e.target.value)}
              className={selectCls}
            >
              <option value="">— без —</option>
              {fiscalDevices.filter(fd => fd.status === 'ACTIVE').map(fd => (
                <option key={fd.id} value={fd.id}>{fd.serial_number}{fd.location ? ` (${fd.location})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>POS терминал</Label>
            <select
              value={posTerminalId}
              onChange={e => setPosTerminalId(e.target.value)}
              className={selectCls}
            >
              <option value="">— без —</option>
              {posTerminals.filter(pt => pt.status === 'ACTIVE').map(pt => (
                <option key={pt.id} value={pt.id}>{pt.tid} — {pt.bank}{pt.location ? ` (${pt.location})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept-sort">Позиция (подредба)</Label>
            <Input id="dept-sort" type="number" min={0} step={1}
              value={sortOrder}
              onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
              placeholder="0 = първа" />
            <p className="text-[10px] text-muted-foreground">По-малко число = по-напред в отчета</p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отказ
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Запис...' : isEdit ? 'Запази' : 'Създай'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
