'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { CashCollection, CashCollectionStatus } from '@/types/finance'

export type CashCollectionWithJoins = CashCollection & {
  properties: { name: string }
  collected_by: { full_name: string }
}

const statusLabels: Record<CashCollectionStatus, string> = {
  SENT: 'Изпратено',
  RECEIVED: 'Получено',
  ACCOUNTED: 'Осчетоводено',
}

const statusColors: Record<CashCollectionStatus, string> = {
  SENT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  RECEIVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ACCOUNTED: 'bg-green-500/20 text-green-400 border-green-500/30',
}

interface Props {
  collections: CashCollectionWithJoins[]
}

export function CashCollectionList({ collections }: Props) {
  const router = useRouter()

  if (collections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма събирания
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Обект</TableHead>
          <TableHead className="text-right">Сума</TableHead>
          <TableHead>Период</TableHead>
          <TableHead>Събрал</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {collections.map(col => (
          <TableRow
            key={col.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => router.push(`/finance/cash-flow/collect/${col.id}`)}
          >
            <TableCell className="font-medium">{col.collection_date}</TableCell>
            <TableCell className="text-muted-foreground">
              {col.properties.name}
            </TableCell>
            <TableCell className="text-right font-mono">
              {col.amount.toFixed(2)} €
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {col.covers_date_from} – {col.covers_date_to}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {col.collected_by.full_name}
            </TableCell>
            <TableCell>
              <Badge className={statusColors[col.status]}>
                {statusLabels[col.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
