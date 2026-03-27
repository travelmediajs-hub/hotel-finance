'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { DeviceForm } from './DeviceForm'
import { Plus, Trash2 } from 'lucide-react'
import type { FiscalDevice } from '@/types/finance'

interface Props {
  propertyId: string
  devices: FiscalDevice[]
}

export function DeviceList({ propertyId, devices }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Сигурни ли сте, че искате да изтриете това устройство?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/finance/fiscal-devices/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Фискални устройства</CardTitle>
        <DeviceForm
          propertyId={propertyId}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Добави устройство
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Няма добавени фискални устройства.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сериен номер</TableHead>
                <TableHead>Локация</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map(device => (
                <TableRow key={device.id}>
                  <TableCell className="font-mono text-sm">{device.serial_number}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {device.location ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={deletingId === device.id}
                      onClick={() => handleDelete(device.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
