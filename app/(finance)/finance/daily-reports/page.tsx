import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole, getUserPropertyIds } from '@/lib/finance/auth'
import { DailyReportTable } from '@/components/finance/DailyReportTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NewReportButton } from '@/components/finance/NewReportButton'

interface Props {
  searchParams: Promise<{ property_id?: string }>
}

export default async function DailyReportsPage({ searchParams }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const params = await searchParams

  let properties: Array<{ id: string; name: string }> = []
  if (isCORole(user.role)) {
    const { data } = await supabase
      .from('properties')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name')
    properties = data ?? []
  } else {
    const propertyIds = await getUserPropertyIds(user)
    if (propertyIds && propertyIds.length > 0) {
      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .in('id', propertyIds)
        .eq('status', 'ACTIVE')
        .order('name')
      properties = data ?? []
    }
  }

  const selectedPropertyId = params.property_id ?? properties[0]?.id
  if (!selectedPropertyId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <p className="text-muted-foreground text-sm">Няма достъпни обекти.</p>
      </div>
    )
  }

  const [{ data: departments }, { data: propertyInfo }] = await Promise.all([
    supabase
      .from('departments')
      .select('id, name, fiscal_device_id, sort_order')
      .eq('property_id', selectedPropertyId)
      .eq('status', 'ACTIVE')
      .eq('kind', 'REVENUE')
      .order('sort_order')
      .order('name'),
    supabase
      .from('properties')
      .select('active_since')
      .eq('id', selectedPropertyId)
      .single(),
  ])

  // Auto-create missing DRAFT reports for every day from max(active_since, today-30) to today
  const BACKFILL_DAYS = 30
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const windowStart = new Date(today)
  windowStart.setDate(windowStart.getDate() - BACKFILL_DAYS)
  const activeSince = propertyInfo?.active_since ? new Date(propertyInfo.active_since) : windowStart
  const backfillStart = activeSince > windowStart ? activeSince : windowStart
  const backfillStartStr = backfillStart.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const { data: existingDates } = await supabase
    .from('daily_reports')
    .select('date')
    .eq('property_id', selectedPropertyId)
    .gte('date', backfillStartStr)
    .lte('date', todayStr)

  const existingDateSet = new Set((existingDates ?? []).map((r) => r.date))
  const missingDates: string[] = []
  for (let d = new Date(backfillStart); d <= today; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().split('T')[0]
    if (!existingDateSet.has(iso)) missingDates.push(iso)
  }

  if (missingDates.length > 0) {
    await supabase.from('daily_reports').insert(
      missingDates.map((date) => ({
        property_id: selectedPropertyId,
        date,
        created_by_id: user.id,
        status: 'DRAFT',
        total_cash_net: 0,
        total_pos_net: 0,
        cash_diff: 0,
        pos_diff: 0,
        total_diff: 0,
      })),
    )
  }

  const reportsQuery = () => supabase
    .from('daily_reports')
    .select('*, daily_report_lines(*, departments(id, name))')
    .eq('property_id', selectedPropertyId)
    .order('date', { ascending: false })
    .limit(60)

  let { data: reports } = await reportsQuery()

  // Auto-sync: add missing department lines to DRAFT reports
  const activeDeptIds = new Set((departments ?? []).map((d) => d.id))
  if (reports && reports.length > 0 && activeDeptIds.size > 0) {
    const linesToInsert: Array<{ daily_report_id: string; department_id: string }> = []
    for (const report of reports) {
      if (report.status !== 'DRAFT') continue
      const existingDeptIds = new Set(
        (report.daily_report_lines ?? []).map((l: { department_id: string }) => l.department_id)
      )
      for (const deptId of activeDeptIds) {
        if (!existingDeptIds.has(deptId)) {
          linesToInsert.push({ daily_report_id: report.id, department_id: deptId })
        }
      }
    }
    if (linesToInsert.length > 0) {
      await supabase.from('daily_report_lines').insert(linesToInsert)
      const { data: refreshed } = await reportsQuery()
      if (refreshed) reports = refreshed
    }
  }

  // For DEPT_HEAD, fetch which departments they can edit
  let userDepartmentIds: string[] | undefined
  if (user.role === 'DEPT_HEAD' && !user.isSimulating) {
    const { data: deptAccess } = await supabase
      .from('user_department_access')
      .select('department_id')
      .eq('user_id', user.id)
    userDepartmentIds = (deptAccess ?? []).map((a) => a.department_id)
  }

  const canCreate = user.role === 'MANAGER' || user.role === 'ADMIN_CO' || user.role === 'DEPT_HEAD'

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg">Дневни отчети</CardTitle>
            {properties.length > 1 && (
              <div className="flex gap-1">
                {properties.map((p) => (
                  <Link
                    key={p.id}
                    href={`/finance/daily-reports?property_id=${p.id}`}
                    className={`px-2 py-1 rounded text-xs ${
                      p.id === selectedPropertyId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {canCreate && (
            <NewReportButton propertyId={selectedPropertyId} />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <DailyReportTable
            key={selectedPropertyId}
            reports={(reports as Parameters<typeof DailyReportTable>[0]['reports']) ?? []}
            departments={departments ?? []}
            userRole={user.role}
            userDepartmentIds={userDepartmentIds}
            propertyId={selectedPropertyId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
