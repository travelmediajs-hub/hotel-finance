'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { PropertyConsolidation, ConsolidationStatus } from '@/types/finance'
import { fmtDate } from '@/lib/utils'

export type ConsolidationWithJoins = PropertyConsolidation & {
  properties: { name: string }
}

const statusLabels: Record<ConsolidationStatus, string> = {
  IN_PROGRESS: 'В процес',
  SENT_TO_CO: 'Изпратен към ЦО',
  APPROVED: 'Одобрен',
  RETURNED: 'Върнат',
  CORRECTED: 'Коригиран',
}

const statusVariants: Record<ConsolidationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  IN_PROGRESS: 'secondary',
  SENT_TO_CO: 'default',
  APPROVED: 'outline',
  RETURNED: 'destructive',
  CORRECTED: 'outline',
}

interface Props {
  consolidations: ConsolidationWithJoins[]
}

export function ConsolidationList({ consolidations }: Props) {
  if (consolidations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма консолидации
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Обект</TableHead>
          <TableHead className="text-right">Каса нето</TableHead>
          <TableHead className="text-right">POS нето</TableHead>
          <TableHead className="text-right">Разлика</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {consolidations.map(c => (
          <TableRow key={c.id}>
            <TableCell>
              <Link
                href={`/finance/consolidations/${c.id}`}
                className="text-foreground hover:underline font-medium"
              >
                {fmtDate(c.date)}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {c.properties.name}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {c.total_cash_net.toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {c.total_pos_net.toFixed(2)}
            </TableCell>
            <TableCell className={`text-right font-mono ${c.total_diff !== 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {c.total_diff.toFixed(2)}
            </TableCell>
            <TableCell>
              <Badge variant={statusVariants[c.status]}>
                {statusLabels[c.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
