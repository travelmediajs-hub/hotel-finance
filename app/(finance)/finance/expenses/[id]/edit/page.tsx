import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { ExpenseForm } from '@/components/finance/ExpenseForm'

const UNEDITABLE = ['PAID', 'PARTIAL', 'REJECTED']

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const isCO = user.role === 'ADMIN_CO' || user.role === 'FINANCE_CO'
  if (!isCO) redirect('/finance/expenses')

  const { id } = await params
  const supabase = await createClient()

  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single()

  if (!expense) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">Разходът не е намерен.</p>
      </div>
    )
  }

  if (UNEDITABLE.includes(expense.status)) {
    redirect(`/finance/expenses/${id}`)
  }

  const [accountsResult, suppliersResult] = await Promise.all([
    supabase
      .from('usali_accounts')
      .select('id, code, name, level, account_type, parent_id')
      .eq('is_active', true)
      .eq('account_type', 'EXPENSE')
      .order('sort_order'),
    supabase
      .from('suppliers')
      .select('id, name, eik, vat_number')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-6">Редактиране на разход</h1>
      <ExpenseForm
        propertyId={expense.property_id}
        accounts={(accountsResult.data ?? []) as Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>}
        suppliers={(suppliersResult.data ?? []) as Array<{ id: string; name: string; eik: string | null; vat_number: string | null }>}
        userRole={user.role}
        initialExpense={{
          id: expense.id,
          account_id: expense.account_id,
          supplier_id: expense.supplier_id,
          supplier: expense.supplier,
          supplier_eik: expense.supplier_eik,
          document_type: expense.document_type,
          document_number: expense.document_number,
          issue_date: expense.issue_date,
          due_date: expense.due_date,
          amount_net: Number(expense.amount_net),
          vat_amount: Number(expense.vat_amount),
          payment_method: expense.payment_method,
          attachment_url: expense.attachment_url,
          note: expense.note,
        }}
      />
    </div>
  )
}
