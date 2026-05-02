import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole, getUserPropertyIds } from '@/lib/finance/auth'
import { ExpenseSpreadsheet } from '@/components/finance/ExpenseSpreadsheet'
import type { ExpenseWithJoins } from '@/components/finance/ExpenseSpreadsheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PageProps {
  searchParams: Promise<{ supplier_id?: string; status?: string; property_id?: string }>
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  const user = await getFinanceUser()
  if (!user) redirect('/finance')

  const supabase = await createClient()
  const { supplier_id, status, property_id: filterPropertyId } = await searchParams

  // Scope for non-CO users — respects the active-property cookie.
  const allowedIds = await getUserPropertyIds(user)

  // --- Expenses ---
  let expenseQuery = supabase
    .from('expenses')
    .select('*, departments(name), properties(name), usali_accounts(code, name), suppliers(name)')
    .order('issue_date', { ascending: false })
    .limit(200)

  if (user.role === 'DEPT_HEAD') {
    expenseQuery = expenseQuery.eq('created_by_id', user.id)
  }
  if (allowedIds !== null) {
    if (allowedIds.length === 0) {
      expenseQuery = expenseQuery.eq('property_id', '00000000-0000-0000-0000-000000000000')
    } else {
      expenseQuery = expenseQuery.in('property_id', allowedIds)
    }
  }

  // Optional filters from query string (e.g. linked from dashboard / property report)
  if (supplier_id) {
    expenseQuery = expenseQuery.eq('supplier_id', supplier_id)
  }
  if (status) {
    const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
    if (statuses.length > 0) {
      expenseQuery = expenseQuery.in('status', statuses)
    }
  }
  // Narrow to a specific property when requested (must intersect with the
  // user's allowed scope — non-CO users can't widen via this param).
  if (filterPropertyId) {
    if (allowedIds === null || allowedIds.includes(filterPropertyId)) {
      expenseQuery = expenseQuery.eq('property_id', filterPropertyId)
    } else {
      // Requested property is outside the user's scope — return empty set
      expenseQuery = expenseQuery.eq('property_id', '00000000-0000-0000-0000-000000000000')
    }
  }

  const { data: expenses, error: expError } = await expenseQuery
  if (expError) console.error('[expenses] query error:', expError.message)

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
  } else if (allowedIds && allowedIds.length > 0) {
    const { data: userProps } = await supabase
      .from('properties')
      .select('id, name')
      .in('id', allowedIds)
      .eq('status', 'ACTIVE')
      .order('name')
    properties = userProps ?? []
    defaultPropertyId = properties[0]?.id
  }

  const [{ data: accounts }, { data: suppliers }, { data: bankAccounts }] = await Promise.all([
    supabase
      .from('usali_accounts')
      .select('id, code, name, level, account_type, parent_id')
      .eq('is_active', true)
      .eq('account_type', 'EXPENSE')
      .order('sort_order'),
    supabase
      .from('suppliers')
      .select('id, name, eik')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('bank_accounts')
      .select('id, name, iban, allowed_payments')
      .eq('status', 'ACTIVE')
      .order('name'),
  ])

  const { data: coCashData } = await supabase.from('co_cash').select('id, name, allowed_payments').order('name')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Разходи</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          <div className="px-4">
            <ExpenseSpreadsheet
              expenses={((expenses ?? []) as ExpenseWithJoins[])}
              properties={properties}
              accounts={(accounts ?? []) as Array<{ id: string; code: string; name: string; level: number; account_type: string; parent_id: string | null }>}
              suppliers={(suppliers ?? []) as Array<{ id: string; name: string; eik: string | null }>}
              bankAccounts={(bankAccounts ?? []).map((ba: Record<string, unknown>) => ({ id: ba.id as string, name: ba.name as string, iban: ba.iban as string, allowed_payments: (ba.allowed_payments as string[] | undefined) ?? [] }))}
              coCash={(coCashData ?? []).map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string, allowed_payments: (c.allowed_payments as string[] | undefined) ?? [] }))}
              userRole={user.role}
              defaultPropertyId={defaultPropertyId}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
