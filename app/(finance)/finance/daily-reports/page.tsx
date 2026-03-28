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

  const { data: departments } = await supabase
    .from('departments')
    .select('id, name, fiscal_device_id')
    .eq('property_id', selectedPropertyId)
    .eq('status', 'ACTIVE')
    .order('name')

  const { data: reports } = await supabase
    .from('daily_reports')
    .select('*, daily_report_lines(*, departments(id, name))')
    .eq('property_id', selectedPropertyId)
    .order('date', { ascending: false })
    .limit(60)

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
