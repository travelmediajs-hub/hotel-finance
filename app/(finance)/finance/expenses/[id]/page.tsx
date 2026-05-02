import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { ExpenseView } from '@/components/finance/ExpenseView'
import { ExpenseActions } from '@/components/finance/ExpenseActions'

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const { id } = await params
  const supabase = await createClient()

  const { data: expense } = await supabase
    .from('expenses')
    .select('*, departments(name), properties(name), usali_accounts(code, name)')
    .eq('id', id)
    .single()

  if (!expense) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Разходът не е намерен.</p>
      </div>
    )
  }

  const isOwner = expense.created_by_id === user.id

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <ExpenseView expense={expense} />
      <ExpenseActions
        expenseId={expense.id}
        status={expense.status}
        userRole={user.role}
        isOwner={isOwner}
        remainingAmount={expense.remaining_amount}
        paymentMethod={expense.payment_method}
        propertyId={expense.property_id}
        documentType={expense.document_type}
      />
    </div>
  )
}
