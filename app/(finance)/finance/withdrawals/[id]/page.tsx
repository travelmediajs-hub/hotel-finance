import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { WithdrawalView } from '@/components/finance/WithdrawalView'
import { WithdrawalActions } from '@/components/finance/WithdrawalActions'

export default async function WithdrawalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const { id } = await params
  const supabase = await createClient()

  const { data: withdrawal } = await supabase
    .from('withdrawals')
    .select('*, properties(name)')
    .eq('id', id)
    .single()

  if (!withdrawal) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Теглене не е намерено.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <WithdrawalView withdrawal={withdrawal} />
      <WithdrawalActions withdrawal={withdrawal} userRole={user.role} />
    </div>
  )
}
