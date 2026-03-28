import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'
import { createBankTransactionSchema } from '@/lib/finance/schemas'

export async function GET(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const bankAccountId = searchParams.get('bank_account_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const type = searchParams.get('type')
  const direction = searchParams.get('direction')

  const supabase = await createClient()

  let query = supabase
    .from('bank_transactions')
    .select('*, bank_accounts(name), properties(name)')
    .order('transaction_date', { ascending: false })
    .limit(200)

  if (bankAccountId) {
    query = query.eq('bank_account_id', bankAccountId)
  }
  if (dateFrom) {
    query = query.gte('transaction_date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('transaction_date', dateTo)
  }
  if (type) {
    query = query.eq('type', type)
  }
  if (direction) {
    query = query.eq('direction', direction)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createBankTransactionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bank_transactions')
    .insert({ ...parsed.data, created_by_id: user.id })
    .select('*, bank_accounts(name), properties(name)')
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
