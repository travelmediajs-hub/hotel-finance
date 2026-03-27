import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { DailyReportView } from '@/components/finance/DailyReportView'
import { DailyReportActions } from '@/components/finance/DailyReportActions'

export default async function DailyReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const { id } = await params
  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select(
      '*, departments(id, name), properties(id, name), daily_report_lines(*), pos_entries(*, pos_terminals(tid, bank, location)), z_reports(*)'
    )
    .eq('id', id)
    .single()

  if (!report) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Отчетът не е намерен.</p>
      </div>
    )
  }

  const isOwner = report.created_by_id === user.id

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <DailyReportView report={report} />
      <DailyReportActions
        reportId={report.id}
        status={report.status}
        userRole={user.role}
        isOwner={isOwner}
      />
    </div>
  )
}
