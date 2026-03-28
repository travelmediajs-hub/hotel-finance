import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { InTransitCloseForm } from '@/components/finance/InTransitCloseForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { InTransitStatus, InTransitSourceType, Currency } from '@/types/finance'

interface Props {
  params: Promise<{ id: string }>
}

const statusLabels: Record<InTransitStatus, string> = {
  OPEN: 'Отворено',
  PARTIALLY_CLOSED: 'Частично затворено',
  CLOSED: 'Затворено',
}

const statusClasses: Record<InTransitStatus, string> = {
  OPEN: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  PARTIALLY_CLOSED: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  CLOSED: 'bg-green-500/15 text-green-500 border-green-500/30',
}

const sourceTypeLabels: Record<InTransitSourceType, string> = {
  BANK_ACCOUNT: 'Банкова сметка',
  PROPERTY_CASH: 'Каса на обект',
  CO_CASH: 'Каса ЦО',
}

const currencySymbols: Record<Currency, string> = {
  BGN: 'лв.',
  EUR: '€',
  USD: '$',
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
        <p className="text-sm text-muted-foreground">Обръщението не е намерено.</p>
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
    withdrawal_id: string | null
  }[]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Заглавие */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <CardTitle className="text-lg">Обръщение</CardTitle>
          <Badge variant="outline" className={statusClasses[status]}>
            {statusLabels[status]}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
              <div className="text-muted-foreground">Обща сума</div>
              <div className="font-mono font-medium">
                {inTransit.total_amount.toFixed(2)} {currSym}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Остатък</div>
              <div className="font-mono font-medium">
                {inTransit.remaining_amount.toFixed(2)} {currSym}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Валута</div>
              <div>{inTransit.currency}</div>
            </div>
            {inTransit.closed_at && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Затворено на</div>
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

      {/* Източници */}
      {sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Източници</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тип</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                  <TableHead>Теглене ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map(src => (
                  <TableRow key={src.id}>
                    <TableCell>{sourceTypeLabels[src.source_type]}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {src.source_id}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {src.amount.toFixed(2)} {currSym}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {src.withdrawal_id ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Метаданни */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Създадено на: {new Date(inTransit.created_at).toLocaleString('bg-BG')}</div>
            <div>Последна промяна: {new Date(inTransit.updated_at).toLocaleString('bg-BG')}</div>
          </div>
        </CardContent>
      </Card>

      {/* Затваряне */}
      {(status === 'OPEN' || status === 'PARTIALLY_CLOSED') && (
        <InTransitCloseForm
          inTransitId={inTransit.id}
          remainingAmount={inTransit.remaining_amount}
        />
      )}
    </div>
  )
}
