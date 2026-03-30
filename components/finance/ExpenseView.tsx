'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { ExpenseStatus, DocumentType, PaymentMethod } from '@/types/finance'

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

const documentTypeLabels: Record<DocumentType, string> = {
  INVOICE: 'Фактура',
  EXPENSE_ORDER: 'Разходен ордер',
  RECEIPT: 'Касова бележка',
  NO_DOCUMENT: 'Без документ',
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Банков превод',
  CASH: 'В брой',
  CARD: 'С карта',
  OTHER: 'Друго',
}

function fmt(n: number): string {
  return n.toFixed(2)
}

interface Props {
  expense: any
}

export function ExpenseView({ expense }: Props) {
  const departmentName = expense.departments?.name ?? '—'
  const propertyName = expense.properties?.name ?? '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">
            {expense.supplier}
          </CardTitle>
          <Badge variant={statusVariants[expense.status as ExpenseStatus]}>
            {statusLabels[expense.status as ExpenseStatus]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Обект: </span>
            {propertyName}
          </div>
          <div>
            <span className="text-muted-foreground">Точка: </span>
            {departmentName}
          </div>
          <div>
            <span className="text-muted-foreground">Сметка: </span>
            {expense.usali_accounts?.name ?? '—'}
          </div>
          {expense.supplier_eik && (
            <div>
              <span className="text-muted-foreground">ЕИК: </span>
              {expense.supplier_eik}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Документ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Тип документ</div>
              <div>{documentTypeLabels[expense.document_type as DocumentType]}</div>
            </div>
            {expense.document_number && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Номер</div>
                <div>{expense.document_number}</div>
              </div>
            )}
            <div className="space-y-1">
              <div className="text-muted-foreground">Дата на издаване</div>
              <div>{expense.issue_date}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Падеж</div>
              <div>{expense.due_date}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Начин на плащане</div>
              <div>{paymentMethodLabels[expense.payment_method as PaymentMethod]}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Amounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Суми</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Нето сума</div>
              <div className="font-mono">{fmt(expense.amount_net)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">ДДС</div>
              <div className="font-mono">{fmt(expense.vat_amount)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Обща сума</div>
              <div className="font-mono font-medium">{fmt(expense.total_amount)}</div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Платена сума</div>
              <div className="font-mono">{fmt(expense.paid_amount)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Остатък</div>
              <div className={`font-mono font-medium ${expense.remaining_amount > 0 ? 'text-red-500' : ''}`}>
                {fmt(expense.remaining_amount)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachment */}
      {expense.attachment_url && (
        <Card>
          <CardContent className="pt-6">
            <a
              href={expense.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Прикачен файл
            </a>
          </CardContent>
        </Card>
      )}

      {/* Note */}
      {expense.note && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Бележка</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{expense.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Comments */}
      {(expense.manager_comment || expense.co_comment) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Коментари</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {expense.manager_comment && (
              <div>
                <span className="text-muted-foreground">Коментар от управител: </span>
                {expense.manager_comment}
              </div>
            )}
            {expense.co_comment && (
              <div>
                <span className="text-muted-foreground">Коментар от ЦО: </span>
                {expense.co_comment}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
