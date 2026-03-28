import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  searchParams: Promise<{ property_id?: string }>
}

export default async function NewDailyReportPage({ searchParams }: Props) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const params = await searchParams
  const supabase = await createClient()

  if (!params.property_id) {
    let properties: Array<{ id: string; name: string }> = []
    const allowedIds = await getUserPropertyIds(user)
    if (allowedIds) {
      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .in('id', allowedIds)
        .eq('status', 'ACTIVE')
        .order('name')
      properties = data ?? []
    } else {
      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .eq('status', 'ACTIVE')
        .order('name')
      properties = data ?? []
    }

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-lg font-semibold mb-6">Нов дневен отчет — изберете обект</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Обекти</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/finance/daily-reports/new?property_id=${p.id}`}
                className="block px-3 py-2 rounded-md hover:bg-secondary text-sm"
              >
                {p.name}
              </Link>
            ))}
            {properties.length === 0 && (
              <p className="text-muted-foreground text-sm">Няма достъпни обекти.</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check access
  const allowedIds = await getUserPropertyIds(user)
  if (allowedIds && !allowedIds.includes(params.property_id)) {
    redirect('/finance/daily-reports')
  }

  const today = new Date().toISOString().slice(0, 10)

  // Check if report already exists for today
  const { data: existing } = await supabase
    .from('daily_reports')
    .select('id')
    .eq('property_id', params.property_id)
    .eq('date', today)
    .maybeSingle()

  if (existing) {
    redirect(`/finance/daily-reports/${existing.id}`)
  }

  // Create new report via direct DB insert (server component)
  const { data: report, error: reportError } = await supabase
    .from('daily_reports')
    .insert({
      property_id: params.property_id,
      date: today,
      created_by_id: user.id,
      status: 'DRAFT',
      total_cash_net: 0,
      total_pos_net: 0,
      cash_diff: 0,
      pos_diff: 0,
      total_diff: 0,
    })
    .select()
    .single()

  if (reportError || !report) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-destructive text-sm">Грешка при създаване на отчет.</p>
      </div>
    )
  }

  // Create empty lines for all active departments
  const { data: departments } = await supabase
    .from('departments')
    .select('id')
    .eq('property_id', params.property_id)
    .eq('status', 'ACTIVE')

  if (departments && departments.length > 0) {
    await supabase
      .from('daily_report_lines')
      .insert(
        departments.map((d) => ({
          daily_report_id: report.id,
          department_id: d.id,
        }))
      )
  }

  redirect(`/finance/daily-reports/${report.id}`)
}
