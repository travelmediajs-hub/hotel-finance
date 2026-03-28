import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFinanceUser } from '@/lib/finance/auth'
import { voidWithdrawalSchema } from '@/lib/finance/schemas'

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
  const parsed = voidWithdrawalSchema.safeParse({ ...body, withdrawal_id: id })
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

  if (withdrawal.is_void) {
    return NextResponse.json(
      { error: 'already_void', message: 'Тегленето вече е анулирано' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('withdrawals')
    .update({
      is_void: true,
      void_reason: parsed.data.void_reason,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
