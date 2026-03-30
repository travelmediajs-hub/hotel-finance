import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { CashCollectionActions } from '@/components/finance/CashCollectionActions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { CashCollectionStatus } from '@/types/finance'

const statusLabels: Record<CashCollectionStatus, string> = {
  SENT: 'Изпратено',
  RECEIVED: 'Получено',
  ACCOUNTED: 'Осчетоводено',
}

const statusColors: Record<CashCollectionStatus, string> = {
  SENT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  RECEIVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ACCOUNTED: 'bg-green-500/20 text-green-400 border-green-500/30',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function CashCollectionDetailPage({ params }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const { id } = await params
  const supabase = await createClient()

  const { data: col } = await supabase
    .from('cash_collections')
    .select(`
      *,
      properties(name),
      collected_by:user_profiles!collected_by_id(full_name),
      confirmed_by:user_profiles!confirmed_by_id(full_name)
    `)
    .eq('id', id)
    .single()

  if (!col) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Събирането не е намерено.</p>
      </div>
    )
  }

  const status = col.status as CashCollectionStatus

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Събиране на каса</CardTitle>
          <Badge className={statusColors[status]}>
            {statusLabels[status]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Обект</p>
              <p className="font-medium">{col.properties.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Дата на събиране</p>
              <p className="font-medium">{col.collection_date}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Сума</p>
              <p className="font-mono font-medium">{col.amount.toFixed(2)} €</p>
            </div>
            <div>
              <p className="text-muted-foreground">Период от</p>
              <p className="font-medium">{col.covers_date_from}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Период до</p>
              <p className="font-medium">{col.covers_date_to}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Събрал</p>
              <p className="font-medium">{col.collected_by?.full_name ?? '—'}</p>
            </div>
          </div>

          {(col.note || col.attachment_url) && (
            <>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {col.note && (
                  <div>
                    <p className="text-muted-foreground">Бележка</p>
                    <p>{col.note}</p>
                  </div>
                )}
                {col.attachment_url && (
                  <div>
                    <p className="text-muted-foreground">Прикачен файл</p>
                    <a
                      href={col.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {col.attachment_url}
                    </a>
                  </div>
                )}
              </div>
            </>
          )}

          {col.confirmed_by && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Потвърдено от</p>
                  <p className="font-medium">{col.confirmed_by.full_name}</p>
                </div>
                {col.confirmed_at && (
                  <div>
                    <p className="text-muted-foreground">Потвърдено на</p>
                    <p className="font-medium">
                      {new Date(col.confirmed_at).toLocaleString('bg-BG')}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CashCollectionActions
        collectionId={col.id}
        status={status}
        userRole={user.role}
      />
    </div>
  )
}
