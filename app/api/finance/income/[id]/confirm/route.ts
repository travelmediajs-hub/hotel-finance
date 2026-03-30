import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser, isCORole } from '@/lib/finance/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: entry, error: fetchError } = await supabase
    .from('income_entries')
    .select('id, status, bank_account_id, payment_method, amount, entry_date, payer, property_id, description')
    .eq('id', id)
    .single()

  if (fetchError || !entry) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (entry.status !== 'ENTERED') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Само записи в статус ENTERED могат да бъдат потвърдени' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('income_entries')
    .update({ status: 'CONFIRMED' })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  // Auto-create bank transaction when income is confirmed and has a bank account
  if (entry.bank_account_id && entry.payment_method === 'BANK') {
    await supabase.from('bank_transactions').insert({
      bank_account_id: entry.bank_account_id,
      transaction_date: entry.entry_date,
      direction: 'IN',
      amount: entry.amount,
      counterparty: entry.payer,
      type: 'IN_HOTEL',
      property_id: entry.property_id,
      note: entry.description ?? null,
      created_by_id: user.id,
    })
  }

  return NextResponse.json(data)
}
