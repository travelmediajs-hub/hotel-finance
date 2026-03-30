import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { MoneyReceivedActions } from '@/components/finance/MoneyReceivedActions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { MoneyReceivedStatus, MoneyReceivedPurpose, SourceType, DeliveryMethod } from '@/types/finance'

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

const sourceTypeLabels: Record<SourceType, string> = {
  BANK_ACCOUNT: 'Банкова сметка',
  CO_CASH: 'Каса ЦО',
  OTHER_PROPERTY: 'Друг обект',
  OTHER: 'Друго',
}

const deliveryLabels: Record<DeliveryMethod, string> = {
  IN_PERSON: 'На ръка',
  COURIER: 'Куриер',
  BANK_TRANSFER: 'Банков превод',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function MoneyReceivedDetailPage({ params }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const { id } = await params
  const supabase = await createClient()

  const { data: rec } = await supabase
    .from('money_received')
    .select(`
      *,
      properties(name),
      source_property:properties!source_property_id(name),
      source_bank_account:bank_accounts!source_bank_account_id(name, iban),
      sent_by:user_profiles!sent_by_id(full_name),
      received_by:user_profiles!received_by_id(full_name)
    `)
    .eq('id', id)
    .single()

  if (!rec) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Записът не е намерен.</p>
      </div>
    )
  }

  const status = rec.status as MoneyReceivedStatus

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Изпратени средства към обект</CardTitle>
          <Badge className={statusColors[status]}>
            {statusLabels[status]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Обект</p>
              <p className="font-medium">{rec.properties.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Дата на изпращане</p>
              <p className="font-medium">{rec.sent_date}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Сума</p>
              <p className="font-mono font-medium">{rec.amount.toFixed(2)} €</p>
            </div>
            <div>
              <p className="text-muted-foreground">Цел</p>
              <p className="font-medium">{purposeLabels[rec.purpose as MoneyReceivedPurpose]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Тип източник</p>
              <p className="font-medium">{sourceTypeLabels[rec.source_type as SourceType]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Метод на доставка</p>
              <p className="font-medium">{deliveryLabels[rec.delivery_method as DeliveryMethod]}</p>
            </div>
            {rec.sent_by && (
              <div>
                <p className="text-muted-foreground">Изпратено от</p>
                <p className="font-medium">{rec.sent_by.full_name}</p>
              </div>
            )}
            {rec.delivered_by && (
              <div>
                <p className="text-muted-foreground">Доставено от</p>
                <p className="font-medium">{rec.delivered_by}</p>
              </div>
            )}
            {rec.source_bank_account && (
              <div>
                <p className="text-muted-foreground">Банкова сметка</p>
                <p className="font-medium">
                  {rec.source_bank_account.name} – {rec.source_bank_account.iban}
                </p>
              </div>
            )}
            {rec.source_property && (
              <div>
                <p className="text-muted-foreground">Обект-източник</p>
                <p className="font-medium">{rec.source_property.name}</p>
              </div>
            )}
          </div>

          {rec.purpose_description && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="text-muted-foreground">Описание на целта</p>
                <p>{rec.purpose_description}</p>
              </div>
            </>
          )}

          {(rec.note || rec.attachment_url) && (
            <>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {rec.note && (
                  <div>
                    <p className="text-muted-foreground">Бележка</p>
                    <p>{rec.note}</p>
                  </div>
                )}
                {rec.attachment_url && (
                  <div>
                    <p className="text-muted-foreground">Прикачен файл</p>
                    <a
                      href={rec.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {rec.attachment_url}
                    </a>
                  </div>
                )}
              </div>
            </>
          )}

          {rec.received_by && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Получено от</p>
                  <p className="font-medium">{rec.received_by.full_name}</p>
                </div>
                {rec.received_at && (
                  <div>
                    <p className="text-muted-foreground">Получено на</p>
                    <p className="font-medium">
                      {new Date(rec.received_at).toLocaleString('bg-BG')}
                    </p>
                  </div>
                )}
                {rec.received_in_cash && (
                  <div>
                    <p className="text-muted-foreground">Получено в брой</p>
                    <p className="font-medium">{rec.received_in_cash}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <MoneyReceivedActions
        id={rec.id}
        status={status}
        userRole={user.role}
      />
    </div>
  )
}
