'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { Expense, ExpenseStatus } from '@/types/finance'
import { fmtDate } from '@/lib/utils'

export type ExpenseWithJoins = Expense & {
  departments: { name: string }
  properties: { name: string }
  usali_accounts: { code: string; name: string } | null
}

const statusLabels: Record<ExpenseStatus, string> = {
  DRAFT: 'Чернова',
  UNPAID: 'Неплатен',
  SENT_TO_CO: 'Изпратен към ЦО',
  APPROVED: 'Одобрен',
  PARTIAL: 'Частично платен',
  PAID: 'Платен',
  OVERDUE: 'Просрочен',
  REJECTED: 'Отхвърлен',
  RETURNED: 'Върнат',
}

const statusVariants: Record<ExpenseStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  UNPAID: 'default',
  SENT_TO_CO: 'default',
  APPROVED: 'default',
  PARTIAL: 'default',
  PAID: 'outline',
  OVERDUE: 'destructive',
  REJECTED: 'destructive',
  RETURNED: 'secondary',
}

interface Props {
  expenses: ExpenseWithJoins[]
}

export function ExpenseList({ expenses }: Props) {
  if (expenses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Няма разходи
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Обект</TableHead>
          <TableHead>Точка</TableHead>
          <TableHead>Доставчик</TableHead>
          <TableHead>Категория</TableHead>
          <TableHead className="text-right">Сума</TableHead>
          <TableHead className="text-right">Остатък</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map(expense => (
          <TableRow key={expense.id}>
            <TableCell>
              <Link
                href={`/finance/expenses/${expense.id}`}
                className="text-foreground hover:underline font-medium"
              >
                {fmtDate(expense.issue_date)}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {expense.properties.name}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {expense.departments.name}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {expense.supplier}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {expense.usali_accounts?.name ?? '—'}
            </TableCell>
            <TableCell className="text-right font-mono">
              {expense.total_amount.toFixed(2)}
            </TableCell>
            <TableCell className={`text-right font-mono ${expense.remaining_amount > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {expense.remaining_amount.toFixed(2)}
            </TableCell>
            <TableCell>
              <Badge variant={statusVariants[expense.status]}>
                {statusLabels[expense.status]}
              </Badge>
            </TableCell>
            <TableCell>
              {!['PAID', 'PARTIAL', 'REJECTED'].includes(expense.status) && (
                <Link
                  href={`/finance/expenses/${expense.id}/edit`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  title="Редактирай"
                >
                  <Pencil className="h-3 w-3" />
                  Редактирай
                </Link>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
