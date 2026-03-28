import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, getUserPropertyIds } from '@/lib/finance/auth'
import { IncomeSpreadsheet } from '@/components/finance/IncomeSpreadsheet'
import type { IncomeEntryWithJoins } from '@/components/finance/IncomeSpreadsheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function IncomePage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()

  let query = supabase
    .from('income_entries')
    .select('*, properties(name)')
    .order('entry_date', { ascending: false })
    .limit(200)

  const propertyIds = await getUserPropertyIds(user)
  if (propertyIds !== null) {
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

  const [
    { data: entries },
    { data: properties },
    { data: bankAccounts },
    { data: loans },
  ] = await Promise.all([
    query,
    supabase
      .from('properties')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('bank_accounts')
      .select('id, name, iban')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('loans')
      .select('id, bank, contract_number')
      .eq('is_active', true)
      .order('bank'),
  ])

  const isCO = user.role === 'ADMIN_CO' || user.role === 'FINANCE_CO'

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Приходи</CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeSpreadsheet
            entries={(entries as IncomeEntryWithJoins[]) ?? []}
            properties={properties ?? []}
            bankAccounts={bankAccounts ?? []}
            loans={loans ?? []}
            canCreate={isCO}
          />
        </CardContent>
      </Card>
    </div>
  )
}
