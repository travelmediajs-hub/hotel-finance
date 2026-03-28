import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createLoanSchema } from '@/lib/finance/schemas'

export async function GET() {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const [loansResult, balancesResult] = await Promise.all([
    supabase
      .from('loans')
      .select('*, bank_accounts(name)')
      .order('status')
      .order('name'),
    supabase.from('loan_balances').select('*'),
  ])

  if (loansResult.error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  const balanceMap = new Map(
    (balancesResult.data ?? []).map(b => [b.id, b])
  )

  const data = (loansResult.data ?? []).map(loan => ({
    ...loan,
    total_paid: balanceMap.get(loan.id)?.total_paid ?? 0,
    remaining_balance: balanceMap.get(loan.id)?.remaining_balance ?? loan.principal_amount,
  }))

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user || user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createLoanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('loans')
    .insert(parsed.data)
    .select('*, bank_accounts(name)')
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
