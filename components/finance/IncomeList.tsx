'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { IncomeEntry, IncomeEntryType, IncomeEntryStatus } from '@/types/finance'
import { fmtDate } from '@/lib/utils'

export type IncomeEntryWithJoins = IncomeEntry & {
  properties: { name: string }
  usali_accounts: { code: string; name: string } | null
}

const typeLabels: Record<IncomeEntryType, string> = {
  INC_BANK: 'Банков приход',
  INC_CASH: 'Приход в брой',
  INC_ADV: 'Аванс',
  INC_DEP: 'Депозит',
  INC_OTHER: 'Друг приход',
  CF_CREDIT: 'Усвояване на кредит',
  CF_TRANSFER: 'Вътрешен трансфер',
}

const statusLabels: Record<IncomeEntryStatus, string> = {
  ENTERED: 'Въведен',
  CONFIRMED: 'Потвърден',
  ADVANCE: 'Аванс',
  REALIZED: 'Реализиран',
}

const statusClasses: Record<IncomeEntryStatus, string> = {
  ENTERED: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  CONFIRMED: 'bg-green-500/15 text-green-500 border-green-500/30',
  ADVANCE: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  REALIZED: 'bg-green-500/15 text-green-500 border-green-500/30',
}

interface Props {
  entries: IncomeEntryWithJoins[]
}

export function IncomeList({ entries }: Props) {
  const router = useRouter()

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма приходни записи
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Обект</TableHead>
          <TableHead>Тип</TableHead>
          <TableHead>Категория</TableHead>
          <TableHead className="text-right">Сума</TableHead>
          <TableHead>Платец</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(entry => (
          <TableRow
            key={entry.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => router.push(`/finance/income/${entry.id}`)}
          >
            <TableCell className="font-medium">{fmtDate(entry.entry_date)}</TableCell>
            <TableCell className="text-muted-foreground">
              {entry.properties.name}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {typeLabels[entry.type]}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {entry.usali_accounts?.name ?? '—'}
            </TableCell>
            <TableCell className="text-right font-mono">
              {entry.amount.toFixed(2)} €
            </TableCell>
            <TableCell className="text-muted-foreground">
              {entry.payer}
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={statusClasses[entry.status]}
              >
                {statusLabels[entry.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
