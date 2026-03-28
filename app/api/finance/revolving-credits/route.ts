import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createRevolvingCreditSchema } from '@/lib/finance/schemas'

export async function GET() {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const [creditsResult, balancesResult] = await Promise.all([
    supabase
      .from('revolving_credits')
      .select('*, bank_accounts(name)')
      .order('status')
      .order('name'),
    supabase.from('revolving_credit_balances').select('*'),
  ])

  if (creditsResult.error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  const balanceMap = new Map(
    (balancesResult.data ?? []).map(b => [b.id, b])
  )

  const data = (creditsResult.data ?? []).map(credit => ({
    ...credit,
    utilized_amount: balanceMap.get(credit.id)?.utilized_amount ?? 0,
    available_amount: balanceMap.get(credit.id)?.available_amount ?? credit.credit_limit,
  }))

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user || user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createRevolvingCreditSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('revolving_credits')
    .insert(parsed.data)
    .select('*, bank_accounts(name)')
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
