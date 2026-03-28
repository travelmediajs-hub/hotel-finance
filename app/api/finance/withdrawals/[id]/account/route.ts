import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { accountWithdrawalSchema } from '@/lib/finance/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const user = await getFinanceUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = accountWithdrawalSchema.safeParse({ ...body, withdrawal_id: id })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: withdrawal, error: fetchError } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !withdrawal) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Only advance withdrawals can be accounted
  if (!['ADV_EMP', 'ADV_OPS'].includes(withdrawal.purpose)) {
    return NextResponse.json(
      { error: 'invalid_purpose', message: 'Само аванси могат да бъдат отчетени' },
      { status: 400 }
    )
  }

  // Do NOT insert returned_amount — it is a generated column
  const { data, error } = await supabase
    .from('withdrawals')
    .update({
      status: 'ACCOUNTED',
      accounted_amount: parsed.data.accounted_amount,
      accounted_date: parsed.data.accounted_date,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
