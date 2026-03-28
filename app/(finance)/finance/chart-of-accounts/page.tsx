import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { ChartOfAccountsTree } from '@/components/finance/ChartOfAccountsTree'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ChartOfAccountsPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  if (user.realRole !== 'ADMIN_CO') redirect('/finance')

  const supabase = await createClient()

  const [{ data: accounts }, { data: templates }, { data: properties }] = await Promise.all([
    supabase
      .from('usali_accounts')
      .select('*, usali_department_templates(code, name, category)')
      .order('sort_order'),
    supabase
      .from('usali_department_templates')
      .select('*')
      .order('sort_order'),
    supabase
      .from('properties')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name'),
  ])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Сметкоплан (USALI)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartOfAccountsTree
            accounts={accounts ?? []}
            templates={templates ?? []}
            properties={properties ?? []}
          />
        </CardContent>
      </Card>
    </div>
  )
}
