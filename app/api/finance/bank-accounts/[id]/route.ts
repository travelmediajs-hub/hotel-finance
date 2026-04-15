import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createBankAccountSchema } from '@/lib/finance/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const [accountResult, balanceResult] = await Promise.all([
    supabase.from('bank_accounts').select('*').eq('id', id).single(),
    supabase.from('bank_account_balances').select('*').eq('id', id).maybeSingle(),
  ])

  if (accountResult.error || !accountResult.data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const data = {
    ...accountResult.data,
    total_income: balanceResult.data?.total_income ?? 0,
    total_expense: balanceResult.data?.total_expense ?? 0,
    current_balance: balanceResult.data?.current_balance ?? accountResult.data.opening_balance,
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user || user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createBankAccountSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bank_accounts')
    .update(parsed.data)
    .eq('id', id)
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

  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user || user.role !== 'ADMIN_CO') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  // Check for linked transactions
  const { count } = await supabase
    .from('bank_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('bank_account_id', id)

  if (count && count > 0) {
    return NextResponse.json(
      { message: 'Сметката има транзакции и не може да бъде изтрита' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('bank_accounts').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
