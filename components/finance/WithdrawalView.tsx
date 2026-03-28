'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { WithdrawalPurpose, WithdrawalStatus } from '@/types/finance'

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

function fmt(n: number): string {
  return n.toFixed(2)
}

interface Props {
  withdrawal: any
}

export function WithdrawalView({ withdrawal }: Props) {
  const propertyName = withdrawal.properties?.name ?? '—'
  const shortId = withdrawal.id.slice(0, 8)
  const purposeLabel = purposeLabels[withdrawal.purpose as WithdrawalPurpose]

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">
            Теглене #{shortId} — {purposeLabel}
          </CardTitle>
          <div className="flex gap-2">
            {withdrawal.is_void && (
              <Badge variant="destructive">(Анулиран)</Badge>
            )}
            <Badge variant={statusVariants[withdrawal.status as WithdrawalStatus]}>
              {statusLabels[withdrawal.status as WithdrawalStatus]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Обект: </span>
            {propertyName}
          </div>
          <div>
            <span className="text-muted-foreground">Каса: </span>
            {withdrawal.cash_register}
          </div>
          <div>
            <span className="text-muted-foreground">Дата: </span>
            {withdrawal.withdrawal_date}
          </div>
          <div>
            <span className="text-muted-foreground">Сума: </span>
            <span className="font-mono font-medium">{fmt(withdrawal.amount)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Тегли: </span>
            {withdrawal.withdrawn_by}
          </div>
          {withdrawal.description && (
            <div>
              <span className="text-muted-foreground">Описание: </span>
              {withdrawal.description}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Links */}
      {(withdrawal.expense_id || withdrawal.employee_id || withdrawal.bank_account_id) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Връзки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {withdrawal.expense_id && (
              <div>
                <span className="text-muted-foreground">Разход: </span>
                <Link
                  href={`/finance/expenses/${withdrawal.expense_id}`}
                  className="text-primary hover:underline"
                >
                  {withdrawal.expense_id.slice(0, 8)}
                </Link>
              </div>
            )}
            {withdrawal.employee_id && (
              <div>
                <span className="text-muted-foreground">Служител: </span>
                {withdrawal.employee_id.slice(0, 8)}
              </div>
            )}
            {withdrawal.bank_account_id && (
              <div>
                <span className="text-muted-foreground">Банкова сметка: </span>
                {withdrawal.bank_account_id.slice(0, 8)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Accounting */}
      {withdrawal.status === 'ACCOUNTED' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Отчитане</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {withdrawal.accounted_date && (
                <div className="space-y-1">
                  <div className="text-muted-foreground">Дата на отчитане</div>
                  <div>{withdrawal.accounted_date}</div>
                </div>
              )}
              {withdrawal.accounted_amount != null && (
                <div className="space-y-1">
                  <div className="text-muted-foreground">Отчетена сума</div>
                  <div className="font-mono">{fmt(withdrawal.accounted_amount)}</div>
                </div>
              )}
              {withdrawal.returned_amount != null && (
                <div className="space-y-1">
                  <div className="text-muted-foreground">Върната сума</div>
                  <div className="font-mono">{fmt(withdrawal.returned_amount)}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attachment */}
      {withdrawal.attachment_url && (
        <Card>
          <CardContent className="pt-6">
            <a
              href={withdrawal.attachment_url}
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
      {withdrawal.note && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Бележка</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{withdrawal.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Void reason */}
      {withdrawal.void_reason && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Причина за анулиране</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{withdrawal.void_reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
