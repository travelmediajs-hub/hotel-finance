import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { MonthlyReportView } from '@/components/finance/MonthlyReportView'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function MonthlyReportPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()

  let query = supabase
    .from('properties')
    .select('id, name')
    .eq('status', 'ACTIVE')
    .order('name')

  if (!isCORole(user.role)) {
    // MANAGER: only properties they have access to
    const { data: accessRecords } = await supabase
      .from('user_property_access')
      .select('property_id')
      .eq('user_id', user.id)

    const ids = (accessRecords ?? []).map((r: { property_id: string }) => r.property_id)
    if (ids.length === 0) {
      return (
        <div className="p-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Месечен отчет</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Нямате назначени обекти.</p>
            </CardContent>
          </Card>
        </div>
      )
    }
    query = query.in('id', ids)
  }

  const { data: properties } = await query

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Месечен отчет</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyReportView properties={(properties ?? []) as { id: string; name: string }[]} />
        </CardContent>
      </Card>
    </div>
  )
}
