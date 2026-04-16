'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { DepartmentForm } from './DepartmentForm'
import { Plus, Pencil, Trash2, Power } from 'lucide-react'
import type { Department, FiscalDevice, POSTerminal } from '@/types/finance'

interface Props {
  propertyId: string
  departments: Department[]
  fiscalDevices: FiscalDevice[]
  posTerminals: POSTerminal[]
}

export function DepartmentList({ propertyId, departments, fiscalDevices, posTerminals }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fdMap = new Map(fiscalDevices.map(fd => [fd.id, fd]))
  const ptMap = new Map(posTerminals.map(pt => [pt.id, pt]))

  async function handleDelete(dept: Department) {
    if (!confirm(`Изтрий "${dept.name}"? Това действие е необратимо.`)) return
    setDeletingId(dept.id)
    try {
      const res = await fetch(`/api/finance/departments/${dept.id}`, { method: 'DELETE' })
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}))
        const msg = data.message ?? 'Точката има свързани записи.'
        if (confirm(`${msg}\n\nЖелаеш ли да я деактивираш вместо това?`)) {
          await toggleStatus(dept, 'INACTIVE')
        }
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.message ?? 'Грешка при триене')
        return
      }
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  async function toggleStatus(dept: Department, status: 'ACTIVE' | 'INACTIVE') {
    setDeletingId(dept.id)
    try {
      const res = await fetch(`/api/finance/departments/${dept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.message ?? 'Грешка при промяна на статус')
        return
      }
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Точки на продажба</CardTitle>
        <DepartmentForm
          propertyId={propertyId}
          fiscalDevices={fiscalDevices}
          posTerminals={posTerminals}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Нова точка
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Няма точки на продажба.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Име</TableHead>
                <TableHead>Касов апарат</TableHead>
                <TableHead>POS терминал</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...departments].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(dept => {
                const fd = dept.fiscal_device_id ? fdMap.get(dept.fiscal_device_id) : null
                const pt = dept.pos_terminal_id ? ptMap.get(dept.pos_terminal_id) : null
                return (
                  <TableRow key={dept.id}>
                    <TableCell className="text-muted-foreground text-xs">{dept.sort_order ?? 0}</TableCell>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fd ? `${fd.serial_number}${fd.location ? ` (${fd.location})` : ''}` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {pt ? `${pt.tid} — ${pt.bank}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dept.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {dept.status === 'ACTIVE' ? 'Активна' : 'Неактивна'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DepartmentForm
                          propertyId={propertyId}
                          department={dept}
                          fiscalDevices={fiscalDevices}
                          posTerminals={posTerminals}
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          disabled={deletingId === dept.id}
                          onClick={() => toggleStatus(dept, dept.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                          title={dept.status === 'ACTIVE' ? 'Деактивирай' : 'Активирай'}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={deletingId === dept.id}
                          onClick={() => handleDelete(dept)}
                          title="Изтрий"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
