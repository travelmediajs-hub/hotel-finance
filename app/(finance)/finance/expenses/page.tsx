import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { ExpenseList } from '@/components/finance/ExpenseList'
import type { ExpenseWithJoins } from '@/components/finance/ExpenseList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'

export default async function ExpensesPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()

  let query = supabase
    .from('expenses')
    .select('*, departments(name), properties(name)')
    .order('issue_date', { ascending: false })
    .limit(200)

  if (user.role === 'DEPT_HEAD') {
    query = query.eq('created_by_id', user.id)
  }

  const { data: expenses } = await query

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Разходи</CardTitle>
          {(user.role === 'MANAGER' || user.role === 'ADMIN_CO') && (
            <Link
              href="/finance/expenses/new"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Нов разход
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <ExpenseList expenses={(expenses as ExpenseWithJoins[]) ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
