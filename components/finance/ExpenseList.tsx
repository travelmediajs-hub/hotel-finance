'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { Expense, ExpenseCategory, ExpenseStatus } from '@/types/finance'

export type ExpenseWithJoins = Expense & {
  departments: { name: string }
  properties: { name: string }
}

const categoryLabels: Record<ExpenseCategory, string> = {
  CONSUMABLES: 'Консумативи',
  SALARIES: 'Заплати',
  FOOD_KITCHEN: 'Кухня',
  FUEL: 'Гориво',
  TAXES_FEES: 'Данъци/Такси',
  MAINTENANCE: 'Поддръжка',
  UTILITIES: 'Комунални',
  MARKETING: 'Маркетинг',
  INSURANCE: 'Застраховки',
  ACCOUNTING: 'Счетоводство',
  OTHER: 'Друго',
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
          <TableHead>Отдел</TableHead>
          <TableHead>Доставчик</TableHead>
          <TableHead>Категория</TableHead>
          <TableHead className="text-right">Сума</TableHead>
          <TableHead className="text-right">Остатък</TableHead>
          <TableHead>Статус</TableHead>
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
                {expense.issue_date}
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
              {categoryLabels[expense.category]}
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
