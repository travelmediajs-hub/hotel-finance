import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole, getUserPropertyIds } from '@/lib/finance/auth'
import { ExpenseSpreadsheet } from '@/components/finance/ExpenseSpreadsheet'
import type { ExpenseWithJoins } from '@/components/finance/ExpenseSpreadsheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ExpensesPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()

  // --- Expenses ---
  let expenseQuery = supabase
    .from('expenses')
    .select('*, departments(name), properties(name)')
    .order('issue_date', { ascending: false })
    .limit(200)

  if (user.role === 'DEPT_HEAD') {
    expenseQuery = expenseQuery.eq('created_by_id', user.id)
  }

  const { data: expenses } = await expenseQuery

  // --- Properties ---
  let properties: Array<{ id: string; name: string }> = []
  let defaultPropertyId: string | undefined

  if (isCORole(user.role)) {
    const { data: allProps } = await supabase
      .from('properties')
      .select('id, name')
      .eq('status', 'ACTIVE')
      .order('name')
    properties = allProps ?? []
  } else {
    const propertyIds = await getUserPropertyIds(user)
    if (propertyIds && propertyIds.length > 0) {
      const { data: userProps } = await supabase
        .from('properties')
        .select('id, name')
        .in('id', propertyIds)
        .eq('status', 'ACTIVE')
        .order('name')
      properties = userProps ?? []
      defaultPropertyId = properties[0]?.id
    }
  }

  // --- Departments ---
  let deptQuery = supabase
    .from('departments')
    .select('id, name, property_id')
    .eq('status', 'ACTIVE')
    .order('name')

  if (!isCORole(user.role) && defaultPropertyId) {
    deptQuery = deptQuery.eq('property_id', defaultPropertyId)
  } else if (!isCORole(user.role) && properties.length > 0) {
    deptQuery = deptQuery.in('property_id', properties.map((p) => p.id))
  }

  const { data: departments } = await deptQuery

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Разходи</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          <div className="px-4">
            <ExpenseSpreadsheet
              expenses={(expenses as ExpenseWithJoins[]) ?? []}
              properties={properties}
              departments={(departments ?? []) as Array<{ id: string; name: string; property_id: string }>}
              userRole={user.role}
              defaultPropertyId={defaultPropertyId}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
