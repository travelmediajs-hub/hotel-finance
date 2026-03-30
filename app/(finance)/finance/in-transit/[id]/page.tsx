import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InTransitStatus, InTransitSourceType, Currency } from '@/types/finance'

interface Props {
  params: Promise<{ id: string }>
}

const statusLabels: Record<InTransitStatus, string> = {
  OPEN: 'В движение',
  PARTIALLY_CLOSED: 'Частично приключен',
  CLOSED: 'Приключен',
}

const statusClasses: Record<InTransitStatus, string> = {
  OPEN: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  PARTIALLY_CLOSED: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  CLOSED: 'bg-green-500/15 text-green-500 border-green-500/30',
}

const locTypeLabels: Record<InTransitSourceType, string> = {
  BANK_ACCOUNT: 'Банкова сметка',
  PROPERTY_CASH: 'Каса на обект',
  CO_CASH: 'Каса ЦО',
}

const currencySymbols: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
}

async function resolveLocationName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: InTransitSourceType,
  id: string,
): Promise<string> {
  if (type === 'BANK_ACCOUNT') {
    const { data } = await supabase.from('bank_accounts').select('name, iban').eq('id', id).single()
    return data ? `${data.name} (${data.iban})` : id
  }
  if (type === 'CO_CASH') {
    const { data } = await supabase.from('co_cash').select('name').eq('id', id).single()
    return data?.name ?? id
  }
  if (type === 'PROPERTY_CASH') {
    const { data } = await supabase.from('properties').select('name').eq('id', id).single()
    return data?.name ?? id
  }
  return id
}

export default async function InTransitDetailPage({ params }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')
  if (!isCORole(user.role)) redirect('/finance')

  const { id } = await params
  const supabase = await createClient()

  const { data: inTransit } = await supabase
    .from('in_transits')
    .select('*, user_profiles(full_name), in_transit_sources(*)')
    .eq('id', id)
    .single()

  if (!inTransit) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Трансферът не е намерен.</p>
      </div>
    )
  }

  const status = inTransit.status as InTransitStatus
  const currency = inTransit.currency as Currency
  const currSym = currencySymbols[currency] ?? inTransit.currency
  const sources = (inTransit.in_transit_sources ?? []) as {
    id: string
    source_type: InTransitSourceType
    source_id: string
    amount: number
  }[]

  // Resolve human-readable names
  const sourceName = sources[0]
    ? await resolveLocationName(supabase, sources[0].source_type, sources[0].source_id)
    : '—'
  const sourceTypeLabel = sources[0] ? locTypeLabels[sources[0].source_type] : '—'

  const destType = inTransit.destination_type as InTransitSourceType | null
  const destId = inTransit.destination_id as string | null
  const destName = destType && destId
    ? await resolveLocationName(supabase, destType, destId)
    : null
  const destTypeLabel = destType ? locTypeLabels[destType] : null

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">Паричен трансфер</CardTitle>
          <Badge variant="outline" className={statusClasses[status]}>
            {statusLabels[status]}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Откъде</div>
              <div>{sourceTypeLabel}: <span className="font-medium">{sourceName}</span></div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Накъде</div>
              <div>
                {destTypeLabel && destName
                  ? <>{destTypeLabel}: <span className="font-medium">{destName}</span></>
                  : <span className="text-muted-foreground">—</span>
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Сума</div>
              <div className="font-mono font-medium">
                {inTransit.total_amount.toFixed(2)} {currSym}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Носител</div>
              <div>
                {(inTransit.user_profiles as { full_name: string } | null)?.full_name ?? inTransit.carried_by_id}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Дата и час</div>
              <div>
                {new Date(inTransit.start_date_time).toLocaleString('bg-BG', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Валута</div>
              <div>{inTransit.currency}</div>
            </div>
            {inTransit.closed_at && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Приключен на</div>
                <div>{new Date(inTransit.closed_at).toLocaleString('bg-BG')}</div>
              </div>
            )}
            {inTransit.description && (
              <div className="space-y-1 md:col-span-2">
                <div className="text-muted-foreground">Описание</div>
                <div>{inTransit.description}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Създадено: {new Date(inTransit.created_at).toLocaleString('bg-BG')}</div>
            <div>Последна промяна: {new Date(inTransit.updated_at).toLocaleString('bg-BG')}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
