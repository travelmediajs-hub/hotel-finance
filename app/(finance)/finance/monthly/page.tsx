import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
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

  const propertyIds = await getUserPropertyIds(user)
  if (propertyIds !== null) {
    if (propertyIds.length === 0) {
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
    query = query.in('id', propertyIds)
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
