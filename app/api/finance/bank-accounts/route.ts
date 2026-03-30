import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createBankAccountSchema } from '@/lib/finance/schemas'

export async function GET() {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const [accountsResult, balancesResult] = await Promise.all([
    supabase.from('bank_accounts').select('*').order('name'),
    supabase.from('bank_account_balances').select('*'),
  ])

  if (accountsResult.error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  const balanceMap = new Map(
    (balancesResult.data ?? []).map(b => [b.id, b])
  )

  const data = (accountsResult.data ?? []).map(account => ({
    ...account,
    total_income: balanceMap.get(account.id)?.total_income ?? 0,
    total_expense: balanceMap.get(account.id)?.total_expense ?? 0,
    current_balance: balanceMap.get(account.id)?.current_balance ?? account.opening_balance,
  }))

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user || user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createBankAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', message: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', '), details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Check for duplicate IBAN
  const { data: existing } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('iban', parsed.data.iban)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'duplicate', message: 'Банкова сметка с този IBAN вече съществува' },
      { status: 409 }
    )
  }

  const { allowed_payments, ...baseData } = parsed.data
  const insertData: Record<string, unknown> = { ...baseData }
  if (allowed_payments && allowed_payments.length > 0) {
    insertData.allowed_payments = allowed_payments
  }

  const { data, error } = await supabase
    .from('bank_accounts')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'duplicate', message: 'Банкова сметка с този IBAN вече съществува' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
