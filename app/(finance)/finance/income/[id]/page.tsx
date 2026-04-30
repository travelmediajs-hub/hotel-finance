import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { IncomeActions } from '@/components/finance/IncomeActions'
import { IncomeEditButton } from '@/components/finance/IncomeEditButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  IncomeEntryType, IncomePaymentMethod, IncomeEntryStatus,
} from '@/types/finance'

interface Props {
  params: Promise<{ id: string }>
}

const typeLabels: Record<IncomeEntryType, string> = {
  INC_BANK: 'Банков приход',
  INC_CASH: 'Приход в брой',
  INC_ADV: 'Аванс',
  INC_DEP: 'Депозит',
  INC_OTHER: 'Друг приход',
  INC_CREDIT_NOTE: 'Кредитно известие',
  CF_CREDIT: 'Усвояване на кредит',
  CF_TRANSFER: 'Вътрешен трансфер',
}

const paymentMethodLabels: Record<IncomePaymentMethod, string> = {
  BANK: 'Банка',
  CASH: 'В брой',
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

export default async function IncomeDetailPage({ params }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const { id } = await params
  const supabase = await createClient()

  const { data: entry } = await supabase
    .from('income_entries')
    .select('*, properties(name), bank_accounts(name, iban), loans(name), usali_accounts(code, name)')
    .eq('id', id)
    .single()

  if (!entry) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Записът не е намерен.</p>
      </div>
    )
  }

  const status = entry.status as IncomeEntryStatus
  const type = entry.type as IncomeEntryType

  const editable = ['ENTERED', 'CONFIRMED', 'ADVANCE'].includes(status)
  const sameDay =
    new Date(entry.created_at).toDateString() === new Date().toDateString()
  const canEdit = isCORole(user.role) && editable && sameDay

  // Load form dependencies only when editing is possible
  let editDeps: {
    properties: { id: string; name: string }[]
    bankAccounts: { id: string; name: string; iban: string }[]
    loans: { id: string; name: string }[]
    accounts: Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>
  } | null = null
  if (canEdit) {
    const [
      { data: properties },
      { data: bankAccounts },
      { data: loans },
      { data: accounts },
    ] = await Promise.all([
      supabase.from('properties').select('id, name').eq('status', 'ACTIVE').order('name'),
      supabase.from('bank_accounts').select('id, name, iban').eq('status', 'ACTIVE').order('name'),
      supabase.from('loans').select('id, name').eq('status', 'ACTIVE').order('name'),
      supabase.from('usali_accounts')
        .select('id, code, name, level, account_type, parent_id')
        .eq('is_active', true)
        .eq('account_type', 'REVENUE')
        .order('sort_order'),
    ])
    editDeps = {
      properties: (properties ?? []) as { id: string; name: string }[],
      bankAccounts: (bankAccounts ?? []) as { id: string; name: string; iban: string }[],
      loans: (loans ?? []) as { id: string; name: string }[],
      accounts: (accounts ?? []) as Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>,
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">
            {typeLabels[type]} — {entry.payer}
          </CardTitle>
          <div className="flex items-center gap-2">
            {canEdit && editDeps && (
              <IncomeEditButton
                entry={entry}
                properties={editDeps.properties}
                bankAccounts={editDeps.bankAccounts}
                loans={editDeps.loans}
                accounts={editDeps.accounts}
              />
            )}
            <Badge variant="outline" className={statusClasses[status]}>
              {statusLabels[status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Обект: </span>
            {entry.properties?.name ?? '—'}
          </div>
          <div>
            <span className="text-muted-foreground">Дата: </span>
            {entry.entry_date}
          </div>
          <div>
            <span className="text-muted-foreground">Тип: </span>
            {typeLabels[type]}
          </div>
          {entry.usali_accounts && (
            <div>
              <span className="text-muted-foreground">Сметка: </span>
              {entry.usali_accounts.name}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Плащане */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Плащане</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Сума</div>
              <div className="font-mono font-medium text-base">
                {entry.amount.toFixed(2)} €
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Начин на плащане</div>
              <div>{paymentMethodLabels[entry.payment_method as IncomePaymentMethod]}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Платец</div>
              <div>{entry.payer}</div>
            </div>
            {entry.bank_accounts && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Банкова сметка</div>
                <div>{entry.bank_accounts.name} — {entry.bank_accounts.iban}</div>
              </div>
            )}
            {entry.loans && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Кредит</div>
                <div>{entry.loans.name}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Период */}
      {(entry.period_from || entry.period_to) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Период</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {entry.period_from && (
                <div className="space-y-1">
                  <div className="text-muted-foreground">От дата</div>
                  <div>{entry.period_from}</div>
                </div>
              )}
              {entry.period_to && (
                <div className="space-y-1">
                  <div className="text-muted-foreground">До дата</div>
                  <div>{entry.period_to}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Забележка */}
      {entry.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Забележка</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{entry.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Прикачен файл */}
      {entry.attachment_url && (
        <Card>
          <CardContent className="pt-6">
            <a
              href={entry.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Прикачен файл
            </a>
          </CardContent>
        </Card>
      )}

      {/* Метаданни */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Въведен на: {new Date(entry.created_at).toLocaleString('bg-BG')}</div>
            <div>Последна промяна: {new Date(entry.updated_at).toLocaleString('bg-BG')}</div>
          </div>
        </CardContent>
      </Card>

      {/* Действия */}
      <IncomeActions
        entryId={entry.id}
        status={status}
        type={type}
        userRole={user.role}
      />
    </div>
  )
}
