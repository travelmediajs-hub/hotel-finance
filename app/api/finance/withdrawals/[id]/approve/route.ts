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

  if (user.role !== 'MANAGER' && !isCORole(user.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
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

  if (withdrawal.status !== 'PENDING_APPROVAL') {
    return NextResponse.json(
      { error: 'invalid_status', message: 'Тегленето трябва да е в статус ЧАКАЩО ОДОБРЕНИЕ' },
      { status: 400 }
    )
  }

  // MANAGER can approve DEPT_HEAD withdrawals up to 200
  if (user.role === 'MANAGER') {
    if (Number(withdrawal.amount) > 200) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Мениджърът не може да одобрява суми над 200' },
        { status: 403 }
      )
    }
  }

  const { data, error } = await supabase
    .from('withdrawals')
    .update({
      status: 'APPROVED',
      co_approved_by_id: user.id,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
