import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { WithdrawalList } from '@/components/finance/WithdrawalList'
import type { WithdrawalWithJoins } from '@/components/finance/WithdrawalList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'

export default async function WithdrawalsPage() {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()

  let query = supabase
    .from('withdrawals')
    .select('*, properties(name)')
    .order('withdrawal_date', { ascending: false })
    .limit(200)

  if (user.role === 'DEPT_HEAD') {
    query = query.eq('authorized_by_id', user.id)
  }

  const { data: withdrawals } = await query

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Тегления</CardTitle>
          {(user.role === 'MANAGER' || user.role === 'DEPT_HEAD' || user.role === 'ADMIN_CO') && (
            <Link
              href="/finance/withdrawals/new"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-7 px-2.5 text-[0.8rem] font-medium"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ново теглене
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <WithdrawalList withdrawals={(withdrawals as WithdrawalWithJoins[]) ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
