'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { Withdrawal, WithdrawalPurpose, WithdrawalStatus } from '@/types/finance'

export type WithdrawalWithJoins = Withdrawal & {
  properties: { name: string }
}

const purposeLabels: Record<WithdrawalPurpose, string> = {
  PAY_EXP: 'Плащане разход',
  PAY_SAL: 'Заплата',
  ADV_EMP: 'Аванс служител',
  ADV_OPS: 'Аванс оперативен',
  BANK_IN: 'Внасяне в банка',
  CASH_TRANS: 'Прехвърляне каса',
  CO_COLLECT: 'Събиране ЦО',
  OTHER: 'Друго',
}

const statusLabels: Record<WithdrawalStatus, string> = {
  RECORDED: 'Записан',
  PENDING_APPROVAL: 'Чака одобрение',
  APPROVED: 'Одобрен',
  REJECTED: 'Отхвърлен',
  ACCOUNTED: 'Отчетен',
  UNACCOUNTED_ADVANCE: 'Неотчетен аванс',
}

const statusVariants: Record<WithdrawalStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  RECORDED: 'secondary',
  PENDING_APPROVAL: 'default',
  APPROVED: 'outline',
  REJECTED: 'destructive',
  ACCOUNTED: 'outline',
  UNACCOUNTED_ADVANCE: 'destructive',
}

interface Props {
  withdrawals: WithdrawalWithJoins[]
}

export function WithdrawalList({ withdrawals }: Props) {
  if (withdrawals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма тегления
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Обект</TableHead>
          <TableHead>Каса</TableHead>
          <TableHead className="text-right">Сума</TableHead>
          <TableHead>Тегли</TableHead>
          <TableHead>Цел</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {withdrawals.map(w => (
          <TableRow key={w.id}>
            <TableCell className={w.is_void ? 'line-through' : ''}>
              <Link
                href={`/finance/withdrawals/${w.id}`}
                className="text-foreground hover:underline font-medium"
              >
                {w.withdrawal_date}
              </Link>
            </TableCell>
            <TableCell className={`text-muted-foreground ${w.is_void ? 'line-through' : ''}`}>
              {w.properties.name}
            </TableCell>
            <TableCell className={`text-muted-foreground ${w.is_void ? 'line-through' : ''}`}>
              {w.cash_register}
            </TableCell>
            <TableCell className={`text-right font-mono ${w.is_void ? 'line-through' : ''}`}>
              {w.amount.toFixed(2)}
            </TableCell>
            <TableCell className={`text-muted-foreground ${w.is_void ? 'line-through' : ''}`}>
              {w.withdrawn_by}
            </TableCell>
            <TableCell className={`text-muted-foreground ${w.is_void ? 'line-through' : ''}`}>
              {purposeLabels[w.purpose]}
            </TableCell>
            <TableCell>
              {w.is_void ? (
                <Badge variant="destructive">(Анулиран)</Badge>
              ) : (
                <Badge variant={statusVariants[w.status]}>
                  {statusLabels[w.status]}
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
