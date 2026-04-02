'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type {
  MoneyReceived, MoneyReceivedStatus, MoneyReceivedPurpose, DeliveryMethod,
} from '@/types/finance'
import { fmtDate } from '@/lib/utils'

export type MoneyReceivedWithJoins = MoneyReceived & {
  properties: { name: string }
}

const statusLabels: Record<MoneyReceivedStatus, string> = {
  SENT: 'Изпратено',
  RECEIVED: 'Получено',
  ACCOUNTED: 'Осчетоводено',
}

const statusColors: Record<MoneyReceivedStatus, string> = {
  SENT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  RECEIVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ACCOUNTED: 'bg-green-500/20 text-green-400 border-green-500/30',
}

const purposeLabels: Record<MoneyReceivedPurpose, string> = {
  OPERATIONAL: 'Оперативни',
  SALARIES: 'Заплати',
  CASH_SUPPLY: 'Захранване каса',
  SPECIFIC_GOAL: 'Конкретна цел',
  ADVANCE: 'Аванс',
}

const deliveryLabels: Record<DeliveryMethod, string> = {
  IN_PERSON: 'На ръка',
  COURIER: 'Куриер',
  BANK_TRANSFER: 'Банков превод',
}

interface Props {
  records: MoneyReceivedWithJoins[]
}

export function MoneyReceivedList({ records }: Props) {
  const router = useRouter()

  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма изпратени средства
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
          <TableHead>Цел</TableHead>
          <TableHead>Метод</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map(rec => (
          <TableRow
            key={rec.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => router.push(`/finance/cash-flow/send/${rec.id}`)}
          >
            <TableCell className="font-medium">{fmtDate(rec.sent_date)}</TableCell>
            <TableCell className="text-muted-foreground">
              {rec.properties.name}
            </TableCell>
            <TableCell className="text-right font-mono">
              {rec.amount.toFixed(2)} €
            </TableCell>
            <TableCell className="text-muted-foreground">
              {purposeLabels[rec.purpose]}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {deliveryLabels[rec.delivery_method]}
            </TableCell>
            <TableCell>
              <Badge className={statusColors[rec.status]}>
                {statusLabels[rec.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
