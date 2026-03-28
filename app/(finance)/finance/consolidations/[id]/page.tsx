import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { ConsolidationView } from '@/components/finance/ConsolidationView'
import { ConsolidationActions } from '@/components/finance/ConsolidationActions'

export default async function ConsolidationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const { id } = await params
  const supabase = await createClient()

  const { data: consolidation } = await supabase
    .from('property_consolidations')
    .select('*, properties(id, name)')
    .eq('id', id)
    .single()

  if (!consolidation) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Консолидацията не е намерена.</p>
      </div>
    )
  }

  const { data: dailyReports } = await supabase
    .from('daily_reports')
    .select('*, departments(name)')
    .eq('property_id', consolidation.property_id)
    .eq('date', consolidation.date)
    .order('created_at')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <ConsolidationView
        consolidation={consolidation}
        dailyReports={dailyReports ?? []}
      />
      <ConsolidationActions
        consolidationId={consolidation.id}
        status={consolidation.status}
        userRole={user.role}
      />
    </div>
  )
}
