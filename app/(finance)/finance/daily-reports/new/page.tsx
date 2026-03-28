import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/finance/auth'
import { createClient } from '@/lib/supabase/server'
import { DailyReportForm } from '@/components/finance/DailyReportForm'
import type { POSTerminal } from '@/types/finance'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  searchParams: Promise<{ property_id?: string; department_id?: string }>
}

export default async function NewDailyReportPage({ searchParams }: Props) {
  const user = await requireRole('DEPT_HEAD', 'ADMIN_CO')
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const params = await searchParams

  let departmentId: string | null = null

  if (user.role === 'ADMIN_CO' || user.isSimulating) {
    // ADMIN_CO: must select property and department via query params
    if (!params.property_id) {
      // Show property picker
      const { data: properties } = await supabase
        .from('properties')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .order('name')

      return (
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-lg font-semibold mb-6">Нов дневен отчет</h1>
          <Card>
            <CardHeader><CardTitle className="text-base">Избери обект</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(properties ?? []).map(p => (
                <Link
                  key={p.id}
                  href={`/finance/daily-reports/new?property_id=${p.id}`}
                  className="block px-3 py-2 rounded-md hover:bg-secondary text-sm"
                >
                  {p.name}
                </Link>
              ))}
              {(!properties || properties.length === 0) && (
                <p className="text-muted-foreground text-sm">Няма активни обекти.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    if (!params.department_id) {
      // Show department picker for selected property
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name')
        .eq('property_id', params.property_id)
        .eq('status', 'ACTIVE')
        .order('name')

      return (
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-lg font-semibold mb-6">Нов дневен отчет</h1>
          <Card>
            <CardHeader><CardTitle className="text-base">Избери отдел</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(departments ?? []).map(d => (
                <Link
                  key={d.id}
                  href={`/finance/daily-reports/new?property_id=${params.property_id}&department_id=${d.id}`}
                  className="block px-3 py-2 rounded-md hover:bg-secondary text-sm"
                >
                  {d.name}
                </Link>
              ))}
              {(!departments || departments.length === 0) && (
                <p className="text-muted-foreground text-sm">Няма активни отдели за този обект.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    departmentId = params.department_id
  } else {
    // DEPT_HEAD: get department from access table
    const { data: accessRecords } = await supabase
      .from('user_department_access')
      .select('department_id')
      .eq('user_id', user.id)

    if (!accessRecords || accessRecords.length === 0) {
      return (
        <div className="p-6 max-w-4xl mx-auto">
          <p className="text-muted-foreground">
            Нямате присвоен отдел. Свържете се с администратор.
          </p>
        </div>
      )
    }
    departmentId = accessRecords[0].department_id
  }

  // Fetch the department
  const { data: department } = await supabase
    .from('departments')
    .select('*')
    .eq('id', departmentId)
    .eq('status', 'ACTIVE')
    .single()

  if (!department) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">
          Отделът не е намерен или не е активен.
        </p>
      </div>
    )
  }

  // Fetch all active departments for this property
  const { data: departments } = await supabase
    .from('departments')
    .select('*')
    .eq('property_id', department.property_id)
    .eq('status', 'ACTIVE')
    .order('name')

  // Get POS terminals assigned to this department
  const { data: deptTerminals } = await supabase
    .from('department_pos_terminals')
    .select('pos_terminal_id')
    .eq('department_id', department.id)

  let posTerminals: POSTerminal[] = []

  if (deptTerminals && deptTerminals.length > 0) {
    const terminalIds = deptTerminals.map((dt) => dt.pos_terminal_id)
    const { data: terminals } = await supabase
      .from('pos_terminals')
      .select('*')
      .in('id', terminalIds)
      .eq('status', 'ACTIVE')

    if (terminals) {
      posTerminals = terminals
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Нов дневен отчет</h1>
      <DailyReportForm
        department={department}
        property_id={department.property_id}
        departments={departments ?? []}
        posTerminals={posTerminals}
      />
    </div>
  )
}
