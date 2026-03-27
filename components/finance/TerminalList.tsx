'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { TerminalForm } from './TerminalForm'
import { Plus, Trash2 } from 'lucide-react'
import type { POSTerminal } from '@/types/finance'

interface Props {
  propertyId: string
  terminals: POSTerminal[]
}

export function TerminalList({ propertyId, terminals }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Сигурни ли сте, че искате да изтриете този терминал?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/finance/pos-terminals/${id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">ПОС терминали</CardTitle>
        <TerminalForm
          propertyId={propertyId}
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Добави терминал
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {terminals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Няма добавени ПОС терминали.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TID</TableHead>
                <TableHead>Банка</TableHead>
                <TableHead>Локация</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {terminals.map(terminal => (
                <TableRow key={terminal.id}>
                  <TableCell className="font-mono text-sm">{terminal.tid}</TableCell>
                  <TableCell>{terminal.bank}</TableCell>
                  <TableCell className="text-muted-foreground">{terminal.location}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={deletingId === terminal.id}
                      onClick={() => handleDelete(terminal.id)}
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
