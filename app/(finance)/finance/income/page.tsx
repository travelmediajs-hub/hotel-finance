import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { IncomeList } from '@/components/finance/IncomeList'
import type { IncomeEntryWithJoins } from '@/components/finance/IncomeList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'

export default async function IncomePage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()

  let query = supabase
    .from('income_entries')
    .select('*, properties(name)')
    .order('entry_date', { ascending: false })
    .limit(200)

  if (user.role === 'MANAGER') {
    // Filter by properties the manager has access to
    const { data: accessRecords } = await supabase
      .from('user_property_access')
      .select('property_id')
      .eq('user_id', user.id)

    const propertyIds = (accessRecords ?? []).map(r => r.property_id)
    if (propertyIds.length > 0) {
      query = query.in('property_id', propertyIds)
    } else {
      // No properties — return empty result
      return (
        <div className="p-6 max-w-6xl mx-auto">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg">Приходи</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">
                Нямате присвоен обект.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }
  }

  const { data: entries } = await query

  const isCO = user.role === 'ADMIN_CO' || user.role === 'FINANCE_CO'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Приходи</CardTitle>
          {isCO && (
            <Link
              href="/finance/income/new"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Нов запис
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <IncomeList entries={(entries as IncomeEntryWithJoins[]) ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
