'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { InTransit, InTransitStatus, Currency } from '@/types/finance'

const statusLabels: Record<InTransitStatus, string> = {
  OPEN: 'Отворено',
  PARTIALLY_CLOSED: 'Частично затворено',
  CLOSED: 'Затворено',
}

const statusClasses: Record<InTransitStatus, string> = {
  OPEN: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  PARTIALLY_CLOSED: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  CLOSED: 'bg-green-500/15 text-green-500 border-green-500/30',
}

const currencySymbols: Record<Currency, string> = {
  BGN: 'лв.',
  EUR: '€',
  USD: '$',
}

export type InTransitWithCarrier = InTransit & {
  user_profiles?: { full_name: string } | null
}

interface Props {
  items: InTransitWithCarrier[]
}

export function InTransitList({ items }: Props) {
  const router = useRouter()

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма обръщения
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Носител</TableHead>
          <TableHead className="text-right">Сума</TableHead>
          <TableHead>Валута</TableHead>
          <TableHead className="text-right">Остатък</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(item => (
          <TableRow
            key={item.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => router.push(`/finance/in-transit/${item.id}`)}
          >
            <TableCell className="font-medium">
              {new Date(item.start_date_time).toLocaleString('bg-BG', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {item.user_profiles?.full_name ?? item.carried_by_id}
            </TableCell>
            <TableCell className="text-right font-mono">
              {item.total_amount.toFixed(2)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {item.currency}
            </TableCell>
            <TableCell className="text-right font-mono">
              {item.remaining_amount.toFixed(2)} {currencySymbols[item.currency]}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={statusClasses[item.status]}>
                {statusLabels[item.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
