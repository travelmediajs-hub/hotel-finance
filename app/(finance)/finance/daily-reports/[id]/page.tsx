import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { DailyReportForm } from '@/components/finance/DailyReportForm'
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
    .select('*, properties(id, name), daily_report_lines(*, departments(id, name, fiscal_device_id))')
    .eq('id', id)
    .single()

  if (!report) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Отчетът не е намерен.</p>
      </div>
    )
  }

  const canEdit = report.status === 'DRAFT' || report.status === 'RETURNED'

  let userDepartmentIds: string[] | undefined
  if (user.role === 'DEPT_HEAD') {
    const { data: access } = await supabase
      .from('user_department_access')
      .select('department_id')
      .eq('user_id', user.id)
    userDepartmentIds = (access ?? []).map((a) => a.department_id)
  }

  const departments = (report.daily_report_lines ?? []).map((l: any) => ({
    id: l.departments.id,
    name: l.departments.name,
    fiscal_device_id: l.departments.fiscal_device_id ?? null,
  }))

  if (canEdit) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-lg font-semibold mb-6">
          Дневен отчет — {report.properties?.name} — {report.date}
        </h1>
        <DailyReportForm
          reportId={report.id}
          propertyName={report.properties?.name ?? ''}
          departments={departments}
          initialLines={(report.daily_report_lines ?? []).map((l: any) => ({
            department_id: l.department_id,
            cash_income: Number(l.cash_income),
            cash_refund: Number(l.cash_refund),
            pos_income: Number(l.pos_income),
            pos_refund: Number(l.pos_refund),
            z_cash: Number(l.z_cash),
            z_pos: Number(l.z_pos),
            z_attachment_url: l.z_attachment_url,
            pos_report_amount: Number(l.pos_report_amount),
          }))}
          generalAttachmentUrl={report.general_attachment_url}
          diffExplanation={report.diff_explanation}
          status={report.status}
          userRole={user.role}
          userDepartmentIds={userDepartmentIds}
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <DailyReportView report={report} />
      <DailyReportActions
        reportId={report.id}
        status={report.status}
        userRole={user.role}
      />
    </div>
  )
}
